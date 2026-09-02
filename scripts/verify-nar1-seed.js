/**
 * verify-nar1-seed.js — 独立回读 Atlas，验证 NAR1 + BR 闭环落库：
 *   - 14 家 NAR1 公司落地
 *   - 14 份 NAR1 文档带真实 R2 文件引用
 *   - 16 份 BR 文档带真实 R2 文件引用、归类 br_certificate
 *   - Company.brExpiryDate 从 BR 文件名识别后回填
 *   - Personnel 自然人 + 公司 links 落地
 *   - 合规提醒已 ensure (HK_AR_42 / HK_BR_RENEW)
 *   - 抽查 R2 上文件可下载
 */
'use strict'
const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('  ⚠️ DNS set:', e.message) }
const mongoose = require('mongoose')

function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  const txt = fs.readFileSync(p, 'utf8')
  const m = txt.match(/mongodb\+srv:\/\/\S+/i)
  return m ? m[0].replace(/["'`)\]]/g, '').trim() : null
}

async function checkR2(url) {
  // HEAD 请求看 content-length + content-type
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? require('https') : require('http')
    const req = lib.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      resolve({ status: res.statusCode, contentLength: +res.headers['content-length'], contentType: res.headers['content-type'] })
    })
    req.on('error', (e) => resolve({ error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }) })
    req.end()
  })
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || parseSecrets())
  const Company = require(path.join(__dirname, '..', 'server/models/Company'))
  const Personnel = require(path.join(__dirname, '..', 'server/models/Personnel'))
  const Document = require(path.join(__dirname, '..', 'server/models/Document'))
  const ComplianceReminder = require(path.join(__dirname, '..', 'server/models/ComplianceReminder'))

  console.log('═'.repeat(60))
  console.log('📊 NAR1 + BR 闭环 独立验证（直读 Atlas claw_prod）')
  console.log('═'.repeat(60))

  const companies = await Company.find({ jurisdiction: 'HK', notes: /NAR1/ }).sort({ registrationNumber: 1 }).lean()
  console.log(`\n公司(NAR1 HK):               ${companies.length}/14`)

  const narDocs = await Document.find({ type: 'return', category: 'annual_return' }).lean()
  const brDocs = await Document.find({ type: 'certificate', category: 'br_certificate' }).lean()
  console.log(`NAR1 文档总数:                ${narDocs.length}/14`)
  console.log(`  ├─ 带真实文件引用:          ${narDocs.filter((d) => d.fileUrl && d.fileSize > 0).length}`)
  console.log(`  └─ 文件引用齐全率:          ${narDocs.length ? ((narDocs.filter((d) => d.fileUrl && d.fileSize > 0).length / narDocs.length) * 100).toFixed(1) : 0}%`)
  console.log(`BR 证书文档总数:              ${brDocs.length}`)
  console.log(`  ├─ 带真实文件引用:          ${brDocs.filter((d) => d.fileUrl && d.fileSize > 0).length}`)

  const personnel = await Personnel.find({ notes: /NAR1/ }).lean()
  const naturalPersonnel = personnel.filter((p) => !p.name?.toUpperCase()?.includes?.('LIMITED') && !p.name?.toUpperCase()?.includes?.('CORPORATION'))
  console.log(`自然人(Personnel):            ${naturalPersonnel.length}`)

  const totalLinks = companies.reduce((s, c) => s + (c.links ? c.links.length : 0), 0)
  console.log(`Company.links 总数:           ${totalLinks}`)

  const reminders = await ComplianceReminder.find({}).lean()
  console.log(`ComplianceReminder 总数:      ${reminders.length}`)

  // BR expiry 落库情况
  const withBrExpiry = companies.filter((c) => c.brExpiryDate)
  console.log(`Company.brExpiryDate 已填:    ${withBrExpiry.length}/${companies.length}`)

  // ── 逐公司核对 ──
  console.log('\n' + '─'.repeat(60))
  console.log('逐公司核对:')
  for (const c of companies) {
    const myNars = narDocs.filter((d) => String(d.company) === String(c._id))
    const myBrs = brDocs.filter((d) => String(d.company) === String(c._id))
    const myRem = reminders.filter((r) => String(r.company) === String(c._id))
    console.log(`  ${c.name.padEnd(45)} reg=${c.registrationNumber}  NAR1=${myNars.length}  BR=${myBrs.length}  reminder=${myRem.length}  brExpiry=${c.brExpiryDate ? c.brExpiryDate.toISOString().slice(0, 10) : '-'}`)
  }

  // ── 抽查 R2 文件可访问性 ──
  console.log('\n' + '─'.repeat(60))
  console.log('抽样验证 R2 文件可访问性 (HEAD request, 1/2 NAR1 + 1/2 BR):')
  const samples = [
    narDocs[0],
    narDocs[Math.floor(narDocs.length / 2)],
    brDocs[0],
    brDocs[Math.floor(brDocs.length / 2)],
  ].filter(Boolean)
  for (const d of samples) {
    if (!d.fileUrl) continue
    const r = await checkR2(d.fileUrl)
    const ok = r.status === 200 && (r.contentLength === d.fileSize || (d.fileSize && Math.abs((r.contentLength || 0) - d.fileSize) < 1024))
    console.log(`  ${ok ? '✅' : '❌'} ${d.fileUrl.slice(-50).padEnd(52)} status=${r.status} size=${r.contentLength}/${d.fileSize}`)
  }

  // ── 缺失总结 ──
  console.log('\n' + '─'.repeat(60))
  const missing = narDocs.filter((d) => !d.fileUrl || !d.fileSize)
  if (missing.length) {
    console.log('⚠️ NAR1 文档缺文件引用:')
    for (const d of missing) console.log(`   - ${d.name} (${d.docNumber})`)
  }
  const missingBr = brDocs.filter((d) => !d.fileUrl || !d.fileSize)
  if (missingBr.length) {
    console.log('⚠️ BR 文档缺文件引用:')
    for (const d of missingBr) console.log(`   - ${d.name} (${d.docNumber})`)
  }
  if (!missing.length && !missingBr.length) console.log('✅ 全部文档带真实文件引用')

  await mongoose.disconnect()
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
