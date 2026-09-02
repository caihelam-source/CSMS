/**
 * nar1Import.js — NAR1 识别结果 -> CSMS 落库（计划 / 冲突检测 / 提交）
 *
 * 数据流向：
 *   Company        registrationNumber = BR 号（决策 09-01；旧版 NAR1 无 BR 号则用 CR 号）
 *   自然人 董/秘/股  Personnel + Company.links
 *   法人   秘/股    Company 实体 + Company.links（带 roles 与持股）
 *   NAR1 原件      Document（scope=company，挂识别出的公司下）
 *
 * 三种导入模式（用户可选，逐条生效）：
 *   skip      整条不处理
 *   create    只补缺失实体（已存在的一律不改动），关联合并
 *   overwrite 已存在实体用 NAR1 数据覆盖字段，关联重建
 *
 * 缺字段策略：BR 有效期 / 公司类别 / 董事任命日 一律"留空待补"，不做猜测填充。
 */
'use strict'

const mongoose = require('mongoose')

const Company = require('../models/Company')
const Personnel = require('../models/Personnel')
const Document = require('../models/Document')
require('../models/Counter') // Document.generateDocNumber 内部依赖
const { ensureCompanyReminders } = require('./complianceService')
const { fuzzyMatch } = require('../utils/dedup')

const COMPANY_TYPES = ['private_limited', 'public_limited', 'llp', 'sole_proprietorship', 'partnership', 'other']

// ---------- 映射工具 ----------
function pickRegNo(c) {
  if (c && c.brNumber) return { regNo: String(c.brNumber), source: 'BR号(NAR1)' }
  if (c && c.registrationNumber) return { regNo: String(c.registrationNumber), source: c.registrationNumberSource || '未知' }
  return { regNo: null, source: '缺失' }
}

function pickType(c) {
  if (c && COMPANY_TYPES.includes(c.type)) return { typeVal: c.type, note: '' }
  return { typeVal: undefined, note: 'NAR1 未识别公司类别，待确认（默认 private_limited）' }
}

function parseCountry(raw) {
  if (!raw) return undefined
  const u = String(raw).toUpperCase()
  if (u.includes('HONG KONG')) return 'Hong Kong'
  if (u.includes('BRITISH VIRGIN') || u === 'BVI') return 'British Virgin Islands'
  if (u.includes('CAYMAN')) return 'Cayman Islands'
  if (u.includes('SINGAPORE')) return 'Singapore'
  if (/CHINA|ZHEJIANG|HANGZHOU|BEIJING|SHANGHAI/.test(u)) return 'China'
  return undefined
}

function parseAddress(raw) {
  return { street: raw || undefined, country: parseCountry(raw) }
}

function mapJurisdiction(country) {
  if (!country) return 'OTHER'
  const u = String(country).toUpperCase()
  if (u.includes('HONG KONG')) return 'HK'
  if (u.includes('BRITISH VIRGIN') || u === 'BVI') return 'BVI'
  if (u.includes('CAYMAN')) return 'Cayman'
  if (u.includes('SINGAPORE')) return 'SG'
  return 'OTHER'
}

// 法人实体稳定占位注册号（无真实号时保证幂等，且不与 BR 号冲突）
function stableEntityRegNo(name) {
  const clean = String(name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean) return `ENT-${clean.slice(0, 18)}`
  return `ENT-${Buffer.from(String(name || ''), 'utf8').toString('hex').toUpperCase().slice(0, 22)}`
}

function roleGroups(res) {
  return [
    { items: (res && res.companySecretary) || [], role: 'secretary' },
    { items: (res && res.directors) || [], role: 'director' },
    { items: (res && res.shareholders) || [], role: 'shareholder' },
  ]
}

function mapRole(role) {
  if (role === 'secretary') return 'secretary'
  if (role === 'director') return 'director'
  if (role === 'shareholder') return 'shareholder'
  return 'other'
}

function isPerson(item) {
  return !item || item.entityType === 'person'
}

/** 把一条识别结果整理成"导入计划"（纯计算，不查库） */
function buildPlan(result) {
  const c = (result && result.company) || {}
  const { regNo, source } = pickRegNo(c)
  const { typeVal, note } = pickType(c)
  const people = []
  const entities = []
  for (const g of roleGroups(result)) {
    for (const item of g.items) {
      if (!item) continue
      if (isPerson(item)) {
        const name = String(item.name || '').trim()
        if (!name && !item.nameChinese) continue
        people.push({ name, nameChinese: item.nameChinese || undefined, role: g.role, raw: item })
      } else {
        const name = String(item.name || '').trim()
        if (!name && !item.nameChinese) continue
        entities.push({
          name,
          nameChinese: item.nameChinese || undefined,
          regNo: item.crNumber ? String(item.crNumber) : stableEntityRegNo(name || item.nameChinese),
          role: g.role,
          country: item.country,
          raw: item,
        })
      }
    }
  }
  const da = (result && result.documentAssociation) || {}
  const year = da.year ? parseInt(da.year, 10) : undefined
  return {
    company: {
      name: c.name || '(未识别公司名)',
      nameChinese: c.nameChinese || undefined,
      registrationNumber: regNo,
      regNoSource: source,
      type: typeVal,
      typeNote: note,
      jurisdiction: c.jurisdiction || 'HK',
      registeredAddress: parseAddress(c.registeredAddressRaw),
      shareCapital: c.shareCapital
        ? {
          issued: c.shareCapital.issuedShares,
          paidUp: c.shareCapital.paidUpAmount,
          currency: c.shareCapital.currency || 'HKD',
        }
        : undefined,
      incorporationDate: c.incorporationDate || undefined,
    },
    people,
    entities,
    document: {
      name: `NAR1 - ${c.name || '(未识别公司名)'} (${da.year || '—'})`,
      year,
      madeUpDate: da.madeUpDate,
      filedDate: da.filedDate,
      docType: da.docType || 'NAR1',
      sourceFile: result && result.sourceFile,
    },
    narVersion: (result && result.narVersion) || undefined,
    scanned: !!(result && result.scanned),
    needsMultimodal: !!(result && result.needsMultimodal),
  }
}

/** 查库检测一条计划的冲突情况（公司 / 自然人 / 法人 / 文档） */
async function detectConflicts(plan) {
  const conflicts = { company: null, people: [], entities: [], document: null }
  if (!plan.company.registrationNumber) {
    conflicts.companyError = '缺少注册号（NAR1 未识别 BR/CR 号），无法可靠匹配'
  } else {
    const exist = await Company.findOne({ registrationNumber: plan.company.registrationNumber })
      .select('_id name nameChinese registrationNumber')
    if (exist) conflicts.company = { id: String(exist._id), name: exist.name, registrationNumber: exist.registrationNumber }
  }
  // 名称模糊补缺：无 BR 号命中（或 NAR1 未识别 BR 号）时按名查重，避免"同名不同号"的公司被当成新建
  if (!conflicts.company) {
    const fm = await findCompanyByNameFuzzy(plan.company.name, plan.company.nameChinese, { excludeRegno: plan.company.registrationNumber })
    if (fm) conflicts.company = { id: String(fm.company._id), name: fm.company.name, registrationNumber: fm.company.registrationNumber, matchType: 'name', score: fm.score }
  }
  for (const p of plan.people) {
    if (!p.name) continue
    const exist = await Personnel.findOne({ name: p.name }).select('_id name')
    if (exist) conflicts.people.push({ name: p.name, role: p.role, id: String(exist._id) })
  }
  for (const e of plan.entities) {
    const exist = await Company.findOne({ registrationNumber: e.regNo }).select('_id name registrationNumber')
    if (exist) conflicts.entities.push({ name: e.name, regNo: e.regNo, role: e.role, id: String(exist._id) })
  }
  if (conflicts.company) {
    const doc = await Document.findOne({ name: plan.document.name, company: conflicts.company.id }).select('_id docNumber')
    if (doc) conflicts.document = { id: String(doc._id), docNumber: doc.docNumber }
  }
  const hasConflict = !!conflicts.company || conflicts.people.length > 0 ||
    conflicts.entities.length > 0 || !!conflicts.document
  return { conflicts, hasConflict }
}

// 名称模糊查公司已存在（与 upsertEntity 对齐）：应对"同名但未填 BR 号 / 旧导入 BR 号不同"的缺口，
// 让 NAR1 导入对已存在的同名公司走更新/合并而非重复新建。excludeRegno 命中不同注册号的公司时跳过，避免误并。
async function findCompanyByNameFuzzy(name, nameChinese, { excludeRegno } = {}) {
  if (!name && !nameChinese) return null
  const candidates = await Company.find({
    status: { $ne: 'merged' },
    $or: [
      { name: { $regex: '^' + String(name || '').slice(0, 16), $options: 'i' } },
      { nameChinese: { $regex: String(nameChinese || name || '').slice(0, 8), $options: 'i' } },
    ],
  }).limit(20).lean()
  for (const cand of candidates) {
    if (excludeRegno && cand.registrationNumber && cand.registrationNumber !== excludeRegno) continue
    const hit = fuzzyMatch({ name, nameChinese }, cand)
    if (hit) return { company: cand, score: hit.score }
  }
  return null
}

// ---------- 落库 ----------
async function upsertCompany(plan, mode, existingId) {
  const data = plan.company
  let company = existingId ? await Company.findById(existingId) : null
  if (company && mode === 'create') return { company, action: 'exists' }
  if (!company && data.registrationNumber) {
    company = await Company.findOne({ registrationNumber: data.registrationNumber })
  }
  // 名称模糊兜底：已有同名公司但未填 BR 号 / 旧导入 BR 号不同时，走更新而非重复新建
  if (!company) {
    const fm = await findCompanyByNameFuzzy(data.name, data.nameChinese, { excludeRegno: data.registrationNumber })
    if (fm) company = await Company.findById(fm.company._id)
  }
  if (company) {
    if (mode === 'create') return { company, action: 'exists' }
    // overwrite：覆盖可识别字段，但保留 BR 有效期等人工补录字段
    company.name = data.name || company.name
    if (data.nameChinese) company.nameChinese = data.nameChinese
    if (data.type) company.type = data.type
    if (data.jurisdiction) company.jurisdiction = data.jurisdiction
    if (data.registeredAddress && (data.registeredAddress.street || data.registeredAddress.country)) {
      company.registeredAddress = data.registeredAddress
    }
    if (data.shareCapital) company.shareCapital = data.shareCapital
    company.notes = [
      `数据来源: NAR1 (${plan.narVersion || '未知版本'})`,
      `registrationNumber 来源: ${data.regNoSource}`,
      data.typeNote,
    ].filter(Boolean).join('\n')
    await company.save()
    return { company, action: 'updated' }
  }
  company = await Company.create({
    name: data.name,
    nameChinese: data.nameChinese,
    registrationNumber: data.registrationNumber,
    type: data.type,
    jurisdiction: data.jurisdiction,
    status: 'active',
    incorporationDate: data.incorporationDate,
    registeredAddress: data.registeredAddress,
    shareCapital: data.shareCapital,
    notes: [
      `数据来源: NAR1 (${plan.narVersion || '未知版本'})`,
      `registrationNumber 来源: ${data.regNoSource}`,
      data.typeNote,
    ].filter(Boolean).join('\n'),
  })
  return { company, action: 'created' }
}

async function upsertPerson(p, mode, plan) {
  if (!p.name) return null
  let person = await Personnel.findOne({ name: p.name })
  if (person && mode === 'create') return { person, action: 'exists' }
  const addr = parseAddress(p.raw && p.raw.addressRaw)
  const passport = (p.raw && p.raw.passport && p.raw.passport.number) || (p.raw && p.raw.passportNo) || undefined
  if (!person) {
    person = await Personnel.create({
      name: p.name,
      nameChinese: p.nameChinese,
      address: addr,
      nationality: p.raw && p.raw.country && p.raw.country !== 'Hong Kong' ? p.raw.country : undefined,
      passportNumber: passport,
      roles: [p.role],
      notes: `来源: NAR1 ${plan.narVersion || ''}`.trim(),
    })
    return { person, action: 'created' }
  }
  // overwrite
  if (p.nameChinese) person.nameChinese = p.nameChinese
  if (addr.street || addr.country) person.address = addr
  if (passport) person.passportNumber = passport
  if (!person.roles.includes(p.role)) person.roles.push(p.role)
  await person.save()
  return { person, action: 'updated' }
}

async function upsertEntity(e, mode, plan) {
  let ent = await Company.findOne({ registrationNumber: e.regNo })
  if (ent && mode === 'create') return { entity: ent, action: 'exists' }
  if (!ent) {
    // v6.x 补强：先按 BR 号查，无则按归一化名 fuzzy 查（应对 UI 手工建过同名公司但未填 BR 号的缺口）
    // 模糊命中阈值取 dedup.DEFAULT_FUZZY_THRESHOLD，避免激进合并误伤；命中后返回 action='merge_candidate'
    // 由 commitOne 上层决定走 merge 还是 create + formerNames
    if (e.name) {
      const candidates = await Company.find({
        status: { $ne: 'merged' },
        $or: [
          { name: { $regex: '^' + (e.name || '').slice(0, 16), $options: 'i' } },
          { nameChinese: { $regex: (e.nameChinese || e.name || '').slice(0, 8), $options: 'i' } },
        ],
      }).limit(20).lean()
      for (const cand of candidates) {
        if (cand.registrationNumber === e.regNo) continue // 已用 BR 号 match 跳过
        const hit = fuzzyMatch({ name: e.name, nameChinese: e.nameChinese }, cand)
        if (hit) {
          // 模糊命中：返回候选信息，但不直接合并；上层可决定走 admin merge 接口
          return {
            entity: cand,
            action: 'merge_candidate',
            mergeCandidate: {
              score: hit.score,
              nameA: hit.nameA,
              nameB: hit.nameB,
              reason: 'fuzzy_name_match (no BR match)',
            },
            pendingCreate: e,
          }
        }
      }
    }
    ent = await Company.create({
      name: e.name,
      nameChinese: e.nameChinese,
      registrationNumber: e.regNo,
      type: 'other',
      jurisdiction: mapJurisdiction(e.country),
      status: 'active',
      notes: `法人实体（来自 NAR1 ${plan.narVersion || ''}）：${e.role}；真实注册号${e.raw && e.raw.crNumber ? '=' + e.raw.crNumber : '待补'}`,
    })
    return { entity: ent, action: 'created' }
  }
  if (e.name) ent.name = e.name
  if (e.nameChinese) ent.nameChinese = e.nameChinese
  await ent.save()
  return { entity: ent, action: 'updated' }
}

function findLink(company, refId, linkModel) {
  return company.links.find((l) => l.link && l.link.toString() === String(refId) && l.linkModel === linkModel)
}

function upsertLink(company, { refId, linkModel, role, shares, shareType, mode }) {
  const exist = findLink(company, refId, linkModel)
  if (exist) {
    if (!exist.roles.includes(role)) exist.roles.push(role)
    if (mode === 'overwrite') {
      if (shares != null) exist.shares = shares
      if (shareType) exist.shareType = shareType
    } else if (exist.shares == null && shares != null) {
      exist.shares = shares
    }
    if (shareType && !exist.shareType) exist.shareType = shareType
    return 'merged'
  }
  company.links.push({
    link: refId,
    linkModel,
    roles: [role],
    shares: shares != null ? shares : undefined,
    shareType: shareType || undefined,
    // 缺字段留空待补：NAR1 常不印董事任命日
  })
  return 'created'
}

/**
 * 提交单条导入
 * @param {object} opts
 * @param {object} opts.result  识别器原始结果
 * @param {'skip'|'create'|'overwrite'} opts.mode
 * @param {string} opts.userId  操作人（Document.uploadedBy 必填）
 * @param {object} [opts.storage] 已上传的 PDF 存储信息 { key, url, size, originalName, mimeType }
 */
async function commitOne({ result, mode, userId, storage }) {
  if (mode === 'skip') return { status: 'skipped' }
  const plan = buildPlan(result)
  const stats = { company: null, peopleCreated: 0, peopleUpdated: 0, entitiesCreated: 0, links: 0, document: null }

  const { company, action } = await upsertCompany(plan, mode, null)
  stats.company = { id: String(company._id), name: company.name, action }

  // 人员 / 法人 -> links
  for (const p of plan.people) {
    const r = await upsertPerson(p, mode, plan)
    if (!r) continue
    if (r.action === 'created') stats.peopleCreated++
    else if (r.action === 'updated') stats.peopleUpdated++
    const upserted = upsertLink(company, {
      refId: r.person._id,
      linkModel: 'Personnel',
      role: mapRole(p.role),
      shares: p.raw && p.raw.shares,
      shareType: p.raw && p.raw.shareType,
      mode,
    })
    if (upserted === 'created') stats.links++
  }
  for (const e of plan.entities) {
    const r = await upsertEntity(e, mode, plan)
    if (r.action === 'created') stats.entitiesCreated++
    upsertLink(company, {
      refId: r.entity._id,
      linkModel: 'Company',
      role: mapRole(e.role),
      shares: e.raw && e.raw.shares,
      shareType: e.raw && e.raw.shareType,
      mode,
    })
  }
  await company.save()

  // NAR1 文档
  const docName = plan.document.name
  let doc = await Document.findOne({ name: docName, company: company._id })
  if (doc && mode === 'create') {
    stats.document = { action: 'exists', docNumber: doc.docNumber }
  } else {
    const description = [
      `周年申報表 Annual Return (${plan.document.docType})`,
      `AR 结算日: ${plan.document.madeUpDate || '-'}`,
      `申报日: ${plan.document.filedDate || '-'}`,
      plan.document.sourceFile ? `来源文件: ${plan.document.sourceFile}` : '',
    ].filter(Boolean).join('\n')
    if (!doc) {
      const docNumber = await Document.generateDocNumber({
        company, type: 'return', year: plan.document.year || undefined,
      })
      doc = await Document.create({
        name: docName,
        description,
        type: 'return',
        category: 'annual_return',
        scope: 'company',
        company: company._id,
        uploadedBy: userId || undefined,
        docNumber,
        documentYear: plan.document.year || undefined,
        filename: storage && storage.key,
        originalName: (storage && storage.originalName) || `${docName}.pdf`,
        filepath: storage && storage.url,
        fileUrl: storage && storage.url,
        mimeType: (storage && storage.mimeType) || 'application/pdf',
        fileSize: (storage && storage.size) || 0,
        note: storage ? '由 NAR1 批量导入自动建立' : '由 NAR1 导入建立（未上传正文）',
      })
      stats.document = { action: 'created', docNumber, id: String(doc._id) }
    } else {
      doc.description = description
      if (storage) {
        doc.filename = storage.key
        doc.filepath = storage.url
        doc.fileUrl = storage.url
        doc.fileSize = storage.size || 0
        doc.mimeType = storage.mimeType || 'application/pdf'
      }
      await doc.save()
      stats.document = { action: 'updated', docNumber: doc.docNumber, id: String(doc._id) }
    }
  }

  // NAR1 导入闭环：HK 本地公司自动 ensure HK_AR_42 + HK_BR_RENEW 提醒
  // ensure 只 generate 不删内部提醒，幂等；失败不阻断主流程（提醒可后补）。
  // 排除 nonHongKongCompany=true（这类公司不报 NAR1 而报 NN3；NN3 提醒待用户在 CompanyDetail
  // 手动标记 nonHongKongCompany=true 后通过 ensureCompanyReminders(['HK_NN3_AR','HK_BR_RENEW']) 启用）。
  if (company.jurisdiction === 'HK' && !company.nonHongKongCompany) {
    try {
      await ensureCompanyReminders(company._id, ['HK_AR_42', 'HK_BR_RENEW'])
    } catch (e) {
      console.warn('[NAR1 import] ensure reminders failed:', e && e.message)
    }
  }

  return { status: 'ok', stats }
}

module.exports = {
  buildPlan,
  detectConflicts,
  commitOne,
  stableEntityRegNo,
  _internals: { pickRegNo, pickType, parseAddress, mapJurisdiction, roleGroups },
  _models: { Company, Personnel, Document, mongoose },
}
