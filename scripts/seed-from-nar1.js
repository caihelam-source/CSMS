/**
 * seed-from-nar1.js — 把 NAR1 识别结果全量落库到 CSMS
 *
 * 数据源: scripts/_nar1_recognized.json (14 家) + scripts/_br_recognized.json (BR 证有效期)
 * 落库:
 *   - Company (registrationNumber = BR号; 旧版无BR号用CR号)
 *   - 自然人 董事/秘书/股东 -> Personnel + Company.links
 *   - 法人 股东/秘书       -> Company 实体 + Company.links(roles + 持股)
 *   - NAR1 文档元数据 (scope=company, 不传PDF, 沙箱无文件)
 * 缺字段(BR有效期/公司类别/董事任命日) 按 Vincent 决策"留空待补"。
 *
 * 用法:
 *   node scripts/seed-from-nar1.js            # 真实写入 (需 MONGODB_URI, 或项目根 .env)
 *   node scripts/seed-from-nar1.js --dry-run  # 只解析统计, 不连库 (沙箱可跑验证映射)
 *
 * 幂等: 全部 upsert (by registrationNumber / name)，重复运行不重复创建。
 * 注意: 沙箱 egress 拦 mongodb.net, 真实写入须在本机执行。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

// ---------- env 兜底 (本机 .env 可能含 MONGODB_URI) ----------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const out = {}
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return out
}
const ENV = loadEnv()

// ---------- Atlas URI 兜底 (优先于 .env 的 localhost 残留, 让本机一键落库到生产库) ----------
function readSecretsAtlasUri() {
  const secPath = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(secPath)) return null
  for (const line of fs.readFileSync(secPath, 'utf8').split('\n')) {
    const m = line.match(/mongodb(\+srv)?:\/\/\S+/i)
    if (m) return m[0].replace(/["'`)\]]/g, '').trim()
  }
  return null
}
const SECRETS_ATLAS = readSecretsAtlasUri()

// 优先级: 环境变量 > SECRETS.md(Atlas 生产库) > .env(localhost 残留) > 兜底 localhost
const MONGODB_URI = process.env.MONGODB_URI || SECRETS_ATLAS || ENV.MONGODB_URI || 'mongodb://localhost:27017/claw'
const DRY_RUN = process.argv.includes('--dry-run')

// ---------- 常量 ----------
const COMPANY_TYPES = ['private_limited', 'public_limited', 'llp', 'sole_proprietorship', 'partnership', 'other']
const BOT_EMAIL = 'nar1-import@csms.local'

// ---------- 映射工具 ----------
function pickRegNo(c) {
  if (c.brNumber) return { regNo: String(c.brNumber), source: 'BR号(NAR1)' }
  if (c.registrationNumber) return { regNo: String(c.registrationNumber), source: c.registrationNumberSource || '未知' }
  return { regNo: null, source: '缺失' }
}

function pickType(c) {
  if (COMPANY_TYPES.includes(c.type)) return { typeVal: c.type, note: '' }
  return { typeVal: undefined, note: 'NAR1 未识别公司类别, 待确认(默认 private_limited)' }
}

function mapRole(role) {
  if (role === 'secretary') return 'secretary'
  if (role === 'director') return 'director'
  if (role === 'shareholder') return 'shareholder'
  return 'other'
}

function parseCountry(raw) {
  if (!raw) return undefined
  const u = String(raw).toUpperCase()
  if (u.includes('HONG KONG')) return 'Hong Kong'
  if (u.includes('BRITISH VIRGIN') || u === 'BVI') return 'British Virgin Islands'
  if (u.includes('CAYMAN')) return 'Cayman Islands'
  if (u.includes('SINGAPORE')) return 'Singapore'
  if (u.includes('CHINA') || u.includes('ZHEJIANG') || u.includes('HANGZHOU') || u.includes('BEIJING') || u.includes('SHANGHAI')) return 'China'
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

// 法人实体稳定占位注册号 (无真实号时, 保证幂等且不与 BR 号冲突)
function stableEntityRegNo(name) {
  const clean = String(name).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean) return `ENT-${clean.slice(0, 18)}`
  const hex = Buffer.from(String(name), 'utf8').toString('hex').toUpperCase().slice(0, 22)
  return `ENT-${hex}`
}

function roleGroups(res) {
  return [
    { items: res.companySecretary || [], role: 'secretary' },
    { items: res.directors || [], role: 'director' },
    { items: res.shareholders || [], role: 'shareholder' },
  ]
}

// ---------- dry-run: 只解析统计 ----------
function dryRun(data, brData) {
  const brMap = {}
  for (const r of brData.results) brMap[r.fields.nameEnglish.toUpperCase().replace(/\s+/g, '')] = r.fields

  let stats = { companies: 0, personnel: 0, entityCompanies: 0, documents: 0, links: 0 }
  console.log('🔍 DRY-RUN — 不连库, 仅校验映射\n')

  for (const res of data.results) {
    const c = res.company
    const { regNo, source } = pickRegNo(c)
    const { typeVal, note } = pickType(c)
    const brKey = c.name.toUpperCase().replace(/\s+/g, '')
    const hasBR = !!brMap[brKey]
    stats.companies++

    const persons = []
    const entities = []
    for (const g of roleGroups(res)) {
      for (const item of g.items) {
        if (item.entityType === 'person') {
          persons.push(`${item.name}(${g.role})`)
          stats.personnel++
        } else {
          const ereg = item.crNumber || stableEntityRegNo(item.name)
          entities.push(`${item.name}(${g.role},${ereg})`)
          stats.entityCompanies++
        }
        stats.links++
      }
    }
    stats.documents++

    console.log(`• ${c.name} [${regNo}] src=${source} type=${typeVal || 'private_limited*'} BRexpiry=${hasBR ? 'YES' : 'no'}`)
    if (note) console.log(`    ⚠ ${note}`)
    if (persons.length) console.log(`    自然人: ${persons.join(', ')}`)
    if (entities.length) console.log(`    法人实体: ${entities.join(', ')}`)
  }
  console.log('\n📊 统计:', stats)
  console.log('(* = NAR1 未识别类别, 模型 default 生效, 待你确认后改)')
}

// ---------- 真实写入 ----------
async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to', MONGODB_URI.replace(/\/\/[^@]*@/, '//***@'))

  const Company = require(path.join(__dirname, '..', 'server/models/Company'))
  const Personnel = require(path.join(__dirname, '..', 'server/models/Personnel'))
  const Document = require(path.join(__dirname, '..', 'server/models/Document'))
  const User = require(path.join(__dirname, '..', 'server/models/User'))
  require(path.join(__dirname, '..', 'server/models/Counter')) // generateDocNumber 内部用

  // 导入 bot 用户 (作为 Document.uploadedBy, required)
  let bot = await User.findOne({ email: BOT_EMAIL })
  if (!bot) {
    bot = new User({ name: 'NAR1 Import Bot', email: BOT_EMAIL, password: 'nar1import2026', role: 'auditor' })
    await bot.save() // 触发 bcrypt hash
    console.log('👤 Created import bot user:', BOT_EMAIL)
  } else {
    console.log('👤 Reuse import bot user:', BOT_EMAIL)
  }

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_nar1_recognized.json'), 'utf8'))
  const brData = JSON.parse(fs.readFileSync(path.join(__dirname, '_br_recognized.json'), 'utf8'))
  const brMap = {}
  for (const r of brData.results) brMap[r.fields.nameEnglish.toUpperCase().replace(/\s+/g, '')] = r.fields

  const stats = { companies: 0, personnel: 0, entityCompanies: 0, documents: 0, links: 0, skipped: 0 }

  for (const res of data.results) {
    const c = res.company
    const { regNo, source } = pickRegNo(c)
    const { typeVal, note } = pickType(c)

    // --- Company (upsert) ---
    let company = await Company.findOne({ registrationNumber: regNo })
    if (!company) {
      const share = c.shareCapital || {}
      const addr = parseAddress(c.registeredAddressRaw)
      company = await Company.create({
        name: c.name,
        nameChinese: c.nameChinese || undefined,
        registrationNumber: regNo,
        type: typeVal,
        jurisdiction: c.jurisdiction || 'HK',
        status: c.status || 'active',
        incorporationDate: c.incorporationDate || undefined,
        registeredAddress: addr,
        shareCapital: {
          issued: share.issuedShares,
          paidUp: share.paidUpAmount,
          currency: share.currency || 'HKD',
        },
        brExpiryDate: undefined, // 缺字段留空待补
        notes: [
          `数据来源: NAR1 (${res.narVersion})`,
          `registrationNumber 来源: ${source}`,
          note,
          c.gaps ? '已知缺口: ' + Object.values(c.gaps).join('; ') : '',
        ].filter(Boolean).join('\n'),
      })
      stats.companies++
      console.log(`  🏢 Created company: ${c.name} (${regNo})`)
    } else {
      stats.skipped++
      console.log(`  ⏭ Exists company: ${c.name} (${regNo})`)
    }

    // BR 有效期合并 (仅 EasyRich 有证)
    const brKey = c.name.toUpperCase().replace(/\s+/g, '')
    if (brMap[brKey] && !company.brExpiryDate) {
      company.brExpiryDate = new Date(brMap[brKey].brExpiryDate)
      await company.save()
      console.log(`  📅 BR expiry merged: ${brMap[brKey].brExpiryDate}`)
    }

    // --- 角色: 董事/秘书/股东 ---
    for (const g of roleGroups(res)) {
      for (const item of g.items) {
        const linkRole = mapRole(item.role || g.role)
        if (item.entityType === 'person') {
          const pname = String(item.name || '').trim()
          let p = await Personnel.findOne({ name: pname })
          if (!p) {
            const addr = parseAddress(item.addressRaw)
            p = await Personnel.create({
              name: pname,
              nameChinese: item.nameChinese || undefined,
              address: addr,
              nationality: item.country && item.country !== 'Hong Kong' ? item.country : undefined,
              passportNumber: item.passport ? item.passport.number : (item.passportNo || undefined),
              roles: [g.role],
              notes: `来源: NAR1 ${res.narVersion}`,
            })
            stats.personnel++
            console.log(`  👤 Created personnel: ${pname} (${g.role})`)
          } else if (!p.roles.includes(g.role)) {
            p.roles.push(g.role)
            await p.save()
          }
          await addLink(company, { link: p._id, linkModel: 'Personnel', roles: [linkRole], shares: item.shares, shareType: item.shareType })
          stats.links++
        } else {
          // 法人实体 -> Company
          const ename = item.name
          const ereg = item.crNumber ? String(item.crNumber) : stableEntityRegNo(ename)
          let e = await Company.findOne({ registrationNumber: ereg })
          if (!e) {
            const addr = parseAddress(item.addressRaw)
            e = await Company.create({
              name: ename,
              nameChinese: item.nameChinese || undefined,
              registrationNumber: ereg,
              type: 'other',
              jurisdiction: mapJurisdiction(item.country),
              status: 'active',
              registeredAddress: addr,
              notes: `法人实体(来自 NAR1 ${res.narVersion}): ${g.role}; 真实注册号${item.crNumber ? '=' + item.crNumber : '待补'}`,
            })
            stats.entityCompanies++
            console.log(`  🏢 Created entity-company: ${ename} (${ereg}) [${g.role}]`)
          }
          await addLink(company, { link: e._id, linkModel: 'Company', roles: [linkRole], shares: item.shares, shareType: item.shareType })
          stats.links++
        }
      }
    }

    // --- NAR1 文档元数据 ---
    const da = res.documentAssociation
    if (da) {
      const docName = `NAR1 - ${c.name} (${da.year})`
      const existing = await Document.findOne({ name: docName, company: company._id })
      if (!existing) {
        const year = parseInt(da.year, 10)
        const docNumber = await Document.generateDocNumber({ company, type: 'return', year: year || undefined })
        await Document.create({
          name: docName,
          description: `周年申報表 Annual Return (${da.docTypeName || 'NAR1'})\nAR结算日: ${da.madeUpDate || '-'}\n申报日: ${da.filedDate || '-'}\n来源文件: ${res.sourceFile}`,
          type: 'return',
          category: 'annual_return',
          scope: 'company',
          company: company._id,
          uploadedBy: bot._id,
          docNumber,
          documentYear: year || undefined,
          fileName: `${docNumber}.pdf`,
          originalName: `${docName}.pdf`,
          mimeType: 'application/pdf',
          fileSize: 0,
          note: '由 NAR1 识别自动建记录(沙箱无PDF, 未上传正文; 待补传)',
        })
        stats.documents++
        console.log(`  📄 Created doc: ${docNumber} — ${docName}`)
      } else {
        console.log(`  ⏭ Exists doc: ${docName}`)
      }
    }
  }

  console.log('\n🎉 Done!')
  console.log(stats)
  await mongoose.disconnect()
}

async function addLink(company, link) {
  const exist = company.links.find(
    (l) => l.link && l.link.toString() === link.link.toString() && l.linkModel === link.linkModel
  )
  if (exist) {
    // 同实体同公司已存在 -> 合并 roles / 补持股, 不丢角色(如既是秘书又是董事)
    for (const r of link.roles) if (!exist.roles.includes(r)) exist.roles.push(r)
    if (link.shares != null && exist.shares == null) exist.shares = link.shares
    if (link.shareType && !exist.shareType) exist.shareType = link.shareType
    await company.save()
    return
  }
  company.links.push({
    link: link.link,
    linkModel: link.linkModel,
    roles: link.roles,
    shares: link.shares ?? undefined,
    shareType: link.shareType || undefined,
    appointmentDate: undefined, // 缺字段留空待补
  })
  await company.save()
}

// ---------- 入口 ----------
if (DRY_RUN) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_nar1_recognized.json'), 'utf8'))
  const brData = JSON.parse(fs.readFileSync(path.join(__dirname, '_br_recognized.json'), 'utf8'))
  dryRun(data, brData)
  process.exit(0)
} else {
  main().catch(async (err) => {
    console.error('❌ Failed:', err)
    process.exit(1)
  })
}
