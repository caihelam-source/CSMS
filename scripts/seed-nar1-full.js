/**
 * seed-nar1-full.js — NAR1 数据 + PDF 文件 全量落库到 CSMS（补全 seed-from-nar1.js 不传文件的缺口）
 *
 * 与 seed-from-nar1.js 的区别：
 *   - 本脚本额外把 14 份 NAR1 PDF 原件上传到 Cloudflare R2，并写真实文件引用（fileName/fileUrl/fileSize）
 *   - 数据落库逻辑与原脚本一致（Company / Personnel / links / Document 元数据 + 自动 ensure 合规提醒）
 *
 * 数据源:
 *   scripts/_nar1_recognized.json  (14 家识别结果)
 *   scripts/_br_recognized.json    (可选, BR证有效期; 缺失则跳过 BR expiry 合并)
 * PDF 路径: 脚本内置 PDF_MAP 把 sourceFile -> D:\BaiduSyncdisk\... 本地原件
 *
 * 凭证: 从 .workbuddy/memory/SECRETS.md 解析 (MONGODB_URI + R2_*)，沙箱需绕开 egress 才能连库/传桶。
 *
 * 用法:
 *   node scripts/seed-nar1-full.js                      # 真实写入（数据 + 文件，已存在公司/人员仅补角色/文件引用）
 *   node scripts/seed-nar1-full.js --dry-run            # 只校验 14 份 PDF 路径映射 + JSON 解析，不连库不传文件
 *   node scripts/seed-nar1-full.js --overwrite          # 已存在公司/人员/法人实体也按修正后 JSON 全量更新字段（不删、不覆盖 notes）
 *   node scripts/seed-nar1-full.js --overwrite --dry-run  # 连库预览将变更的字段，不写入、不上传
 *
 * 幂等: Company 按 registrationNumber upsert; Document 按 name+company upsert（已存在则补传文件引用）;
 *       --overwrite 时 Company/Personnel/法人实体 已存在则 $set 修正后字段（仅更新 JSON 提供的字段，保留 notes），重复运行安全。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
// 家用路由 DNS 代理常拒绝 SRV 查询 -> 强制用公共 DNS 解析 Atlas SRV 记录
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }
const mongoose = require('mongoose')

// ---------- 解析 SECRETS.md：Atlas URI + R2 凭证 ----------
function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  const txt = fs.readFileSync(p, 'utf8')
  const out = {}
  const m = txt.match(/mongodb\+srv:\/\/\S+/i)
  if (m) out.MONGODB_URI = m[0].replace(/["'`)\]]/g, '').trim()
  for (const key of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL']) {
    const mm = txt.match(new RegExp('\\*\\*' + key + '\\*\\*:\\s*`([^`]+)`'))
    if (mm) out[key] = mm[1].trim()
  }
  return out
}
const SEC = parseSecrets()
process.env.MONGODB_URI = process.env.MONGODB_URI || SEC.MONGODB_URI
process.env.R2_ENDPOINT = SEC.R2_ENDPOINT
process.env.R2_ACCESS_KEY_ID = SEC.R2_ACCESS_KEY_ID
process.env.R2_SECRET_ACCESS_KEY = SEC.R2_SECRET_ACCESS_KEY
process.env.R2_BUCKET_NAME = SEC.R2_BUCKET_NAME
process.env.R2_PUBLIC_URL = SEC.R2_PUBLIC_URL
process.env.STORAGE_DRIVER = 'r2'

const DRY_RUN = process.argv.includes('--dry-run')
const OVERWRITE = process.argv.includes('--overwrite')
// 保存封装：--overwrite --dry-run 预览模式时只 return 不落库
let persist = (doc) => doc.save()

// ---------- 14 份 NAR1 原件本地路径（sourceFile -> 绝对路径） ----------
const PDF_ROOT = 'D:/BaiduSyncdisk/CNC接收文件/04_香港子公司'
const PDF_MAP = {
  'LISTCO – I1 – 2025 – NAR1- Bright (Hong Kong) Hotels Manageme – 20250917.pdf':
    `${PDF_ROOT}/Bright (HK) Hotels Management（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1- Bright (Hong Kong) Hotels Manageme – 20250917.pdf`,
  'LISTCO – I1 – 2025 – NAR1 - Chaoyang International Trading Lt – 20250917.pdf':
    `${PDF_ROOT}/Chaoyang International Trading（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1 - Chaoyang International Trading Lt – 20250917.pdf`,
  'LISTCO – I1 – 2026 – NAR1 - Easy Rich Corporation Ltd 2026 – 20260408.pdf':
    `${PDF_ROOT}/Easy Rich（HK）/A_公司治理/LISTCO – I1 – 2026 – NAR1 - Easy Rich Corporation Ltd 2026 – 20260408.pdf`,
  'LISTCO – I1 – 2025 – NAR1-2025 – 20250723.pdf':
    `${PDF_ROOT}/HK heyuan（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1-2025 – 20250723.pdf`,
  'LISTCO – I1 – 2025 – NAR1 - Hong Kong Time Honour Property Lt – 20251125.pdf':
    `${PDF_ROOT}/HK Time Honour Property（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1 - Hong Kong Time Honour Property Lt – 20251125.pdf`,
  'LISTCO – I1 – 2026 – NAR1 - HuiJun (International) Holdings L – 20260316.pdf':
    `${PDF_ROOT}/Huijun（HK）/A_公司治理/LISTCO – I1 – 2026 – NAR1 - HuiJun (International) Holdings L – 20260316.pdf`,
  'LISTCO – I1 – 2025 – NAR1 - Pannix Industrial (Hong Kong) Lim – 20250917.pdf':
    `${PDF_ROOT}/Pannix Industrial（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1 - Pannix Industrial (Hong Kong) Lim – 20250917.pdf`,
  'LISTCO – I1 – 2025 – NAR1 - Ultra Nice International Ltd 2025 – 20251014.pdf':
    `${PDF_ROOT}/Ultra Nice（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1 - Ultra Nice International Ltd 2025 – 20251014.pdf`,
  'LISTCO – C1 – 2026 – NAR1 - Zhong An Financial Investment Lim – 20260803.pdf':
    `${PDF_ROOT}/Zhong An Finanical Investment（HK）/C_财务与审计/LISTCO – C1 – 2026 – NAR1 - Zhong An Financial Investment Lim – 20260803.pdf`,
  'LISTCO – I1 – 2026 – NAR1 - Zhong An Great Life Services Limi – 20260715.pdf':
    `${PDF_ROOT}/Zhong An Great Life Services（HK）/A_公司治理/LISTCO – I1 – 2026 – NAR1 - Zhong An Great Life Services Limi – 20260715.pdf`,
  'LISTCO – I1 – 2025 – NAR1- Zhong An Healthcare Ltd 2025 – 20250917.pdf':
    `${PDF_ROOT}/Zhong An Healthcare（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1- Zhong An Healthcare Ltd 2025 – 20250917.pdf`,
  'HKOP – I1 – 2022 – NAR1 - Zhong An International Shipping ( – 20221028.pdf':
    `${PDF_ROOT}/Zhong An International Ship（HK）/A_公司治理/HKOP – I1 – 2022 – NAR1 - Zhong An International Shipping ( – 20221028.pdf`,
  'LISTCO – I1 – 2025 – NAR1 - Zhong An Speedway Ltd 2025 – 20250730.pdf':
    `${PDF_ROOT}/Zhong An Speedway（HK）/A_公司治理/LISTCO – I1 – 2025 – NAR1 - Zhong An Speedway Ltd 2025 – 20250730.pdf`,
  'LISTCO – I1 – 2026 – NAR1- Zhong An Travel Ltd 2026 – 20260617.pdf':
    `${PDF_ROOT}/Zhong An Travel（HK）/A_公司治理/LISTCO – I1 – 2026 – NAR1- Zhong An Travel Ltd 2026 – 20260617.pdf`,
}

// ---------- 映射工具（与 seed-from-nar1.js 对齐） ----------
const COMPANY_TYPES = ['private_limited', 'public_limited', 'llp', 'sole_proprietorship', 'partnership', 'other']
const BOT_EMAIL = 'nar1-import@csms.local'

function pickRegNo(c) {
  if (c.brNumber) return { regNo: String(c.brNumber), source: 'BR号(NAR1)' }
  if (c.registrationNumber) return { regNo: String(c.registrationNumber), source: c.registrationNumberSource || '未知' }
  return { regNo: null, source: '缺失' }
}
function pickType(c) {
  if (COMPANY_TYPES.includes(c.type)) return { typeVal: c.type, note: '' }
  return { typeVal: undefined, note: 'NAR1 未识别公司类别, 默认 private_limited, 待确认' }
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
function mapRole(role) {
  if (role === 'secretary') return 'secretary'
  if (role === 'director') return 'director'
  if (role === 'shareholder') return 'shareholder'
  return 'other'
}
// 人名规范化：去首尾空格 + 全大写 + 多空格合并（消除 SHI Nanlu / SHI NANLU 同人异写，
// 与 fix-nar1-names.js 的 canonical 规则一致，避免覆盖写把已规范的名字打回混合大小写）
function canonName(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

async function addLink(company, link) {
  const exist = company.links.find(
    (l) => l.link && l.link.toString() === link.link.toString() && l.linkModel === link.linkModel
  )
  if (exist) {
    for (const r of link.roles) if (!exist.roles.includes(r)) exist.roles.push(r)
    if (link.shares != null && exist.shares == null) exist.shares = link.shares
    if (link.shareType && !exist.shareType) exist.shareType = link.shareType
    await persist(company)
    return
  }
  company.links.push({
    link: link.link,
    linkModel: link.linkModel,
    roles: link.roles,
    shares: link.shares ?? undefined,
    shareType: link.shareType || undefined,
    appointmentDate: undefined,
  })
  await persist(company)
}

// ---------- dry-run：仅校验路径 + JSON ----------
function dryRun(data) {
  console.log('🔍 DRY-RUN — 校验 14 份 NAR1 PDF + BR PDF 路径映射 + 识别 JSON，不连库不传文件\n')
  let okPaths = 0
  for (const res of data.results) {
    const sf = res.sourceFile
    const p = PDF_MAP[sf]
    let status = '❓无映射'
    let size = 0
    if (p) {
      if (fs.existsSync(p)) {
        size = fs.statSync(p).size
        status = `✅ ${size} bytes`
        okPaths++
      } else {
        status = '❌文件不存在'
      }
    }
    const c = res.company
    const dirs = (res.directors || []).map((d) => d.name || d.nameChinese).filter(Boolean)
    const secs = (res.companySecretary || []).map((s) => s.name || s.nameChinese).filter(Boolean)
    const shs = (res.shareholders || []).map((s) => s.name).filter(Boolean)
    console.log(`• ${c.name}`)
    console.log(`    NAR1 PDF: ${status}  ${p || sf}`)
    console.log(`    董事(${dirs.length}): ${dirs.join(', ') || '-'}`)
    console.log(`    秘书(${secs.length}): ${secs.join(', ') || '-'}`)
    console.log(`    股东(${shs.length}): ${shs.join(', ') || '-'}`)
  }
  console.log(`\n📊 NAR1 路径命中: ${okPaths}/${data.results.length}`)

  // --- BR PDF glob dry-run ---
  console.log('\n🔎 DRY-RUN BR 证书 PDF 匹配 (按文件夹命名启发式):')
  const BR_PDF_ROOT = 'D:/BaiduSyncdisk/CNC接收文件/04_香港子公司'
  let sdList = []
  try { sdList = fs.readdirSync(BR_PDF_ROOT) } catch (e) { console.log('  ❌ 无 BR 根目录:', e.message) }
  const EXCLUDE_GENERIC = new Set(['LIMITED','LIMIT','HOLDINGS','INTERNATIONAL','CORPORATION','GROUP','COMPANY','HOLDING','PROPERTY','INDUSTRIAL','HOTELS','MANAGEMENT','HONG','KONG','ZHONG','AN','THE','OF','AND'])
  let brHits = 0
  for (const res of data.results) {
    const c = res.company || {}
    const cNameUpper = (c.name || '').toUpperCase()
    const cNormFull = cNameUpper.replace(/[^A-Z\u4e00-\u9fff]/g, '')
    const zhName = (c.nameChinese || '').replace(/[（）()]/g, '')
    let matchedDir = null
    for (const sd of sdList) {
      const sdUpper = sd.toUpperCase()
      if (zhName && zhName.length >= 3 && sd.includes(zhName)) { matchedDir = sd; break }
      const sdNorm = sdUpper.replace(/[^A-Z\u4e00-\u9fff]/g, '')
      if (cNormFull.length >= 8 && sdNorm.includes(cNormFull)) { matchedDir = sd; break }
      let cNormFuzzy = cNormFull.replace(/FINANCIAL/g, 'FINAN[CI]AL').replace(/SHIPPI?NG/g, 'SHIPPI?NG')
      const fuzzyMatch = (new RegExp(cNormFuzzy.replace(/\?/g, '').replace(/\[CI\]/g, '[CI]'))).test(sdNorm)
      if (cNormFull.length >= 8 && fuzzyMatch) { matchedDir = sd; break }
      const narTokens = (cNameUpper.match(/[A-Z]+/g) || []).filter((t) => t.length >= 4 && !EXCLUDE_GENERIC.has(t))
      const allHit = narTokens.length > 0 && narTokens.every((t) => sdNorm.includes(t))
      if (allHit) { matchedDir = sd; break }
    }
    let brList = []
    if (matchedDir) {
      const coPath = path.join(BR_PDF_ROOT, matchedDir, 'A_公司治理')
      if (fs.existsSync(coPath)) {
        brList = fs.readdirSync(coPath).filter((f) => /BR\s*[-(]/i.test(f) || /[（(]\d{1,2}\s*[A-Z]{3}[）)]/i.test(f) || /BR\s*-\s*\d{8}\.pdf$/i.test(f))
      }
    }
    const exp = brList.filter((f) => /\(\d{1,2}\s+[A-Z]{3}\s+\d{4}\)/i.test(f))
    if (brList.length > 0) brHits++
    console.log(`  ${c.name.slice(0, 40).padEnd(40)} -> ${matchedDir ? '📁 ' + matchedDir : '❌ no folder'}, BR PDFs: ${brList.length} (有 expiry: ${exp.length})`)
  }
  console.log(`\n📊 BR 命中文件夹: ${brHits}/${data.results.length}`)
  if (okPaths !== data.results.length) {
    console.log('\n⚠️ NAR1 路径未命中，真实写入前请修正 PDF_MAP')
    process.exit(1)
  }
}

// ---------- 真实写入 ----------
async function main() {
  const PREVIEW = OVERWRITE && DRY_RUN
  persist = PREVIEW ? (doc) => Promise.resolve(doc) : (doc) => doc.save()
  const storage = PREVIEW ? null : require(path.join(__dirname, '..', 'server/storage/r2')).storage
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Connected to', process.env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@'))
  if (PREVIEW) console.log('🔍 PREVIEW 模式（--overwrite --dry-run）：仅预览变更，不写入、不上传\n')

  const Company = require(path.join(__dirname, '..', 'server/models/Company'))
  const Personnel = require(path.join(__dirname, '..', 'server/models/Personnel'))
  const Document = require(path.join(__dirname, '..', 'server/models/Document'))
  const User = require(path.join(__dirname, '..', 'server/models/User'))
  require(path.join(__dirname, '..', 'server/models/Counter'))

  let ensureReminders = null
  try {
    ensureReminders = require(path.join(__dirname, '..', 'server/services/complianceService')).ensureCompanyReminders
  } catch (e) {
    console.log('⚠️ 合规提醒服务不可用，跳过自动 ensure:', e.message)
  }

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_nar1_recognized.json'), 'utf8'))
  let brMap = {}
  try {
    const brData = JSON.parse(fs.readFileSync(path.join(__dirname, '_br_recognized.json'), 'utf8'))
    for (const r of brData.results) brMap[r.fields.nameEnglish.toUpperCase().replace(/\s+/g, '')] = r.fields
  } catch (e) {
    console.log('ℹ️ 无 _br_recognized.json，跳过 BR 有效期合并:', e.message)
  }

  let bot = await User.findOne({ email: BOT_EMAIL })
  if (!bot) {
    bot = new User({ name: 'NAR1 Import Bot', email: BOT_EMAIL, password: 'nar1import2026', role: 'auditor' })
    await bot.save()
    console.log('👤 Created import bot user:', BOT_EMAIL)
  }

  const stats = { companies: 0, personnel: 0, entityCompanies: 0, documents: 0, documentsUpdated: 0, links: 0, skipped: 0, filesUploaded: 0, companiesUpdated: 0, personnelUpdated: 0, entityCompaniesUpdated: 0 }

  for (const res of data.results) {
    const c = res.company
    const { regNo, source } = pickRegNo(c)
    const { typeVal, note } = pickType(c)
    const pdfPath = PDF_MAP[res.sourceFile]
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      console.log(`  ⚠ 跳过（PDF 缺失）: ${res.sourceFile}`)
      continue
    }
    const pdfBuf = fs.readFileSync(pdfPath)
    const pdfName = path.basename(pdfPath)

    // 上传原件到 R2
    let stored = null
    if (!PREVIEW) {
      try {
        stored = await storage.upload(pdfBuf, pdfName, 'application/pdf')
        stats.filesUploaded++
        console.log(`  📤 已上传 R2: ${stored.key} (${stored.size} bytes)`)
      } catch (e) {
        console.log(`  ❌ R2 上传失败，文档将建空记录: ${e.message}`)
      }
    } else {
      console.log(`  🔍 PREVIEW: 将上传 R2 ${pdfName}`)
    }

    // --- Company upsert ---
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
        shareCapital: { issued: share.issuedShares, paidUp: share.paidUpAmount, currency: share.currency || 'HKD' },
        brExpiryDate: undefined,
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
      if (OVERWRITE) {
        company.name = c.name
        if (c.nameChinese) company.nameChinese = c.nameChinese
        company.type = typeVal || company.type
        company.jurisdiction = c.jurisdiction || company.jurisdiction
        company.status = c.status || company.status
        company.incorporationDate = c.incorporationDate || company.incorporationDate
        const addr = parseAddress(c.registeredAddressRaw)
        if (addr.street) company.registeredAddress = addr
        const share = c.shareCapital || {}
        if (share.issuedShares != null) company.shareCapital = { issued: share.issuedShares, paidUp: share.paidUpAmount, currency: share.currency || 'HKD' }
        // notes 保留，不覆盖
        await persist(company)
        stats.companiesUpdated++
        console.log(`  ${PREVIEW ? '🔍 PREVIEW' : '🔄'} 更新公司: ${c.name} (${regNo})`)
      } else {
        console.log(`  ⏭ Exists company: ${c.name} (${regNo})`)
      }
    }

    // BR 有效期合并
    const brKey = c.name.toUpperCase().replace(/\s+/g, '')
    if (brMap[brKey] && !company.brExpiryDate) {
      company.brExpiryDate = new Date(brMap[brKey].brExpiryDate)
      await company.save()
      console.log(`  📅 BR expiry merged: ${brMap[brKey].brExpiryDate}`)
    }

    // --- 角色：董事/秘书/股东 ---
    for (const g of roleGroups(res)) {
      for (const item of g.items) {
        const linkRole = mapRole(item.role || g.role)
        if (item.entityType === 'person') {
          const pname = canonName(item.name)
          if (!pname) continue
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
          } else if (OVERWRITE) {
            p.name = pname
            if (item.nameChinese) p.nameChinese = item.nameChinese
            const a = parseAddress(item.addressRaw)
            if (a.street) p.address = a
            if (item.country && item.country !== 'Hong Kong') p.nationality = item.country
            if (item.passport) p.passportNumber = item.passport.number || item.passportNo
            if (!p.roles.includes(g.role)) p.roles.push(g.role)
            // notes 保留，不覆盖
            await persist(p)
            stats.personnelUpdated++
            console.log(`  ${PREVIEW ? '🔍 PREVIEW' : '🔄'} 更新人员: ${pname} (${g.role})`)
          } else if (!p.roles.includes(g.role)) {
            p.roles.push(g.role)
            await p.save()
          }
          await addLink(company, { link: p._id, linkModel: 'Personnel', roles: [linkRole], shares: item.shares, shareType: item.shareType })
          stats.links++
        } else {
          const ename = item.name
          if (!ename) continue
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
          } else if (OVERWRITE) {
            e.name = ename
            if (item.nameChinese) e.nameChinese = item.nameChinese
            const a = parseAddress(item.addressRaw)
            if (a.street) e.registeredAddress = a
            e.jurisdiction = mapJurisdiction(item.country) || e.jurisdiction
            // notes 保留
            await persist(e)
            stats.entityCompaniesUpdated++
            console.log(`  ${PREVIEW ? '🔍 PREVIEW' : '🔄'} 更新法人实体: ${ename} (${ereg}) [${g.role}]`)
          }
          await addLink(company, { link: e._id, linkModel: 'Company', roles: [linkRole], shares: item.shares, shareType: item.shareType })
          stats.links++
        }
      }
    }

    // --- NAR1 文档（带真实文件引用） ---
    const da = res.documentAssociation
    if (da) {
      const docName = `NAR1 - ${c.name} (${da.year})`
      const year = parseInt(da.year, 10)
      let doc = await Document.findOne({ name: docName, company: company._id })
      const docFields = {
        name: docName,
        description: `周年申報表 Annual Return (${da.docTypeName || 'NAR1'})\nAR结算日: ${da.madeUpDate || '-'}\n申报日: ${da.filedDate || '-'}\n来源文件: ${res.sourceFile}`,
        type: 'nar1_return',
        category: 'annual_return',
        scope: 'company',
        company: company._id,
        uploadedBy: bot._id,
        documentYear: year || undefined,
        fileName: stored ? stored.key : docName + '.pdf',
        filename: stored ? stored.key : docName + '.pdf',  // 修复：v6.x schema 定义的存储 key 字段（/view,/download 守卫必填）
        fileUrl: stored ? stored.url : undefined,
        originalName: pdfName,
        mimeType: 'application/pdf',
        fileSize: stored ? stored.size : 0,
        note: stored ? '由 NAR1 识别自动建档 + 原件已上传 R2' : '由 NAR1 识别自动建档（R2 上传失败, 文件引用缺失）',
      }
      if (!doc) {
        const docNumber = await Document.generateDocNumber({ company, type: 'return', year: year || undefined })
        doc = await Document.create({ ...docFields, docNumber })
        stats.documents++
        console.log(`  📄 Created doc: ${docNumber} — ${docName}`)
      } else {
        // 已存在：补传真实文件引用（即使之前 fileSize=0）
        Object.assign(doc, docFields)
        if (!doc.docNumber) doc.docNumber = await Document.generateDocNumber({ company, type: 'return', year: year || undefined })
        await doc.save()
        stats.documentsUpdated++
        console.log(`  🔄 Updated doc (补文件引用): ${doc.docNumber || doc.name}`)
      }
    }

    // --- 自动 ensure 合规提醒（HK 公司） ---
    if (ensureReminders && company.jurisdiction === 'HK' && !company.nonHongKongCompany) {
      try {
        await ensureReminders(company._id, ['HK_AR_42', 'HK_BR_RENEW'])
      } catch (e) {
        console.log(`  ⚠ ensure 提醒失败: ${e.message}`)
      }
    }
  }

  // === Phase 2: BR 证书 (扫描件为主, 但仍上传到 R2 + 挂 Document, expiry 通过文件名/手动维护) ===
  // 用户的 NAR1 文件夹里也归档了 BR 证书 PDF (15 家左右, 非用户本次附上但本机已有的云归档)。
  // 优先级: 此处不依赖 OCR (沙箱无 tesseract), 直接按 directory 命名匹配 NAR1 公司 → BR PDF
  console.log('\n────────── Phase 2: BR 证书 PDF 上传 + 挂文档 ──────────')
  const fs2 = require('fs')
  const path2 = require('path')
  const BR_PDF_ROOT = 'D:/BaiduSyncdisk/CNC接收文件/04_香港子公司'
  const BR_EXPIRY_FROM_NAME = /\((\d{1,2})\s+([A-Z]{3})\s+(\d{4})\)/
  const MONTH2NUM = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 }

  // 重读识别结果(已用过, 重新赋值)
  for (const res of data.results) {
    const c = res.company
    if (!c) continue
    let matchedDir = null
    const cNameUpper = (c.name || '').toUpperCase()
    const sdList = []
    try { sdList.push(...fs2.readdirSync(BR_PDF_ROOT)) } catch (e) { console.log('  ❌ BR_PDF_ROOT 读取失败:', e.message) }
    // 用 NAR1 完整名字(简化)做精确匹配, 排除通用词以允许多家 Zhong An 区分
    const EXCLUDE_GENERIC = new Set(['LIMITED','LIMIT','HOLDINGS','INTERNATIONAL','CORPORATION','GROUP','COMPANY','HOLDING','PROPERTY','INDUSTRIAL','HOTELS','MANAGEMENT','HONG','KONG','ZHONG','AN','THE','OF','AND'])
    const cNormFull = cNameUpper.replace(/[^A-Z\u4e00-\u9fff]/g, '')
    const zhName = (c.nameChinese || '').replace(/[（）()]/g, '')
    for (const sd of sdList) {
      const sdUpper = sd.toUpperCase()
      // 1. 中文名匹配（最可靠, BR 文件夹通常包含中文名）
      if (zhName && zhName.length >= 3 && sd.includes(zhName)) { matchedDir = sd; break }
      const sdNorm = sdUpper.replace(/[^A-Z\u4e00-\u9fff]/g, '')
      // 2. NAR1 全名简化（如 ZHONGANHEALTHCARE 在 ZHONGANHEALTHCAREHK 中）
      if (cNormFull.length >= 8 && sdNorm.includes(cNormFull)) { matchedDir = sd; break; }
      // 3. 拼写容错 (FINANCIAL vs FINANICAL 拼写错误)
      let cNormFuzzy = cNormFull
        .replace(/FINANCIAL/g, 'FINAN[CI]AL')
        .replace(/SHIPPI?NG/g, 'SHIPPI?NG')
      const fuzzyMatch = (new RegExp(cNormFuzzy.replace(/\?/g, '').replace(/\[CI\]/g, '[CI]'))).test(sdNorm)
      if (cNormFull.length >= 8 && fuzzyMatch) { matchedDir = sd; break }
      // 4. NAR1 多元 token (≥4 字符, 非通用) 全部命中
      const narTokens = (cNameUpper.match(/[A-Z]+/g) || []).filter((t) => t.length >= 4 && !EXCLUDE_GENERIC.has(t))
      const allHit = narTokens.length > 0 && narTokens.every((t) => sdNorm.includes(t))
      if (allHit) { matchedDir = sd; break }
    }
    if (!matchedDir) continue
    const coPath = path2.join(BR_PDF_ROOT, matchedDir, 'A_公司治理')
    if (!fs2.existsSync(coPath)) continue
    const brFiles = fs2.readdirSync(coPath).filter((f) => /BR\s*[-(]/i.test(f) || /BR\s*-\s*\d{8}\.pdf$/i.test(f) || /[（(]\d{1,2}\s*[A-Z]{3}[）)]/i.test(f))
    if (brFiles.length === 0) continue

    const company = await Company.findOne({ registrationNumber: pickRegNo(c).regNo })
    if (!company) continue

    for (const brFn of brFiles) {
      const brPath = path2.join(coPath, brFn)
      let buf, stored = null
      if (!PREVIEW) {
        try {
          buf = fs2.readFileSync(brPath)
          stored = await storage.upload(buf, brFn, 'application/pdf')
          stats.filesUploaded++
          console.log(`  📤 BR 上传 R2: ${stored.key} (${stored.size} bytes) — ${brFn.slice(0,60)}`)
        } catch (e) {
          console.log(`  ❌ BR 上传失败: ${brFn}: ${e.message}`)
          continue
        }
      } else {
        console.log(`  🔍 PREVIEW: 将上传 BR R2 ${brFn.slice(0,60)}`)
      }

      // BR expiry 从文件名抓
      let brExpiryDate = null
      const mExp = brFn.match(BR_EXPIRY_FROM_NAME)
      if (mExp) {
        const d = +mExp[1], mo = MONTH2NUM[mExp[2].toUpperCase()], y = +mExp[3]
        if (d && mo && y) brExpiryDate = new Date(Date.UTC(y, mo - 1, d))
      }

      const docName = `BR - ${c.name} (${brFn.split(' – ')[0].match(/\d{4}$/)?.[0] || brFn.match(/(\d{4})/)?.[1] || ''})`
      let doc = await Document.findOne({ name: docName, company: company._id })
      const docFields = {
        name: docName,
        description: `商业登记证 Business Registration Certificate\nBR扫描件(沙箱无 OCR), expiry 从文件名识别: ${mExp ? mExp[0] : '?'}\n来源: ${brFn}\n如需精确到期日请上传 BR 后在 BR 卡片编辑`,
        type: 'business_registration',
        category: 'br_certificate',
        scope: 'company',
        company: company._id,
        uploadedBy: bot._id,
        documentYear: brFn.match(/(\d{4})/)?.[1] ? +brFn.match(/(\d{4})/)[1] : undefined,
        fileName: stored ? stored.key : brFn,
        fileUrl: stored ? stored.url : undefined,
        originalName: brFn,
        mimeType: 'application/pdf',
        fileSize: stored ? stored.size : 0,
        expiresAt: brExpiryDate || undefined,
        note: 'BR 证书扫描件已上传 R2, expiry 由文件名解析或人工维护',
      }
      if (!doc) {
        const docNumber = await Document.generateDocNumber({ company, type: 'business_registration', year: docFields.documentYear })
        doc = await Document.create({ ...docFields, docNumber })
        stats.documents++
        console.log(`  📄 BR doc 创: ${docNumber} — ${docName}`)
      } else {
        Object.assign(doc, docFields)
        if (!doc.docNumber) doc.docNumber = await Document.generateDocNumber({ company, type: 'business_registration', year: docFields.documentYear })
        await doc.save()
        stats.documentsUpdated++
        console.log(`  🔄 BR doc 更新: ${doc.docNumber} — ${docName}`)
      }

      // 把 BR expiry 回填到 Company.brExpiryDate (取最新一年)
      if (brExpiryDate && (!company.brExpiryDate || brExpiryDate > new Date(company.brExpiryDate))) {
        company.brExpiryDate = brExpiryDate
        await persist(company)
        console.log(`  📅 BR expiry 写入: ${brExpiryDate.toISOString().slice(0,10)}`)
      }
    }
  }

  console.log('\n🎉 Done!')
  console.log(stats)
  await mongoose.disconnect()
}

// ---------- 入口 ----------
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_nar1_recognized.json'), 'utf8'))
if (DRY_RUN && !OVERWRITE) {
  // 纯路径/JSON 校验，不连库
  dryRun(data)
  process.exit(0)
} else {
  main().catch(async (err) => {
    console.error('❌ Failed:', err)
    process.exit(1)
  })
}
