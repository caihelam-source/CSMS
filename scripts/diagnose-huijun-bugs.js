// scripts/diagnose-huijun-bugs.js
// 直连 Atlas,核对 Huijun (35387857) 的 4 个真实状态
process.env.NODE_NO_WARNINGS = '1'

// 强制公共 DNS 绕过家用路由拒绝 SRV
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const mongoose = require('mongoose')

;(async () => {
  let uri = process.env.MONGODB_URI || ''
  if (!uri) {
    const fs = require('fs'), path = require('path')
    const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
    const txt = fs.readFileSync(p, 'utf8')
    // 解析 Atlas URI: 可能在 ```围栏``` 中, 也可能裸写一行
    let m = txt.match(/```[a-z]*\n(mongodb\+srv:\/\/[^\n`]+)\n```/)
    if (!m) m = txt.match(/mongodb\+srv:\/\/[^\s\n`]+/)
    if (m) uri = m[1] || m[0]
  }
  if (!uri) { console.error('no uri'); process.exit(2) }

  console.log('connecting...')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 })
  console.log('connected\n')

  const Company = require('../server/models/Company')
  const Document = require('../server/models/Document')

  const co = await Company.findOne({ registrationNumber: '35387857' }).lean()
  if (!co) { console.log('NO COMPANY'); process.exit(0) }
  console.log('=== Company 35387857 ===')
  console.log({
    _id: co._id.toString(),
    name: co.name,
    registrationNumber: co.registrationNumber,
    jurisdiction: co.jurisdiction,
    incorporationDate: co.incorporationDate,
    brExpiryDate: co.brExpiryDate,
    nonHongKongCompany: co.nonHongKongCompany,
    shareCapital: co.shareCapital,
    companyType: co.companyType || co.type,
    address: co.address || co.registeredAddress,
    linksCount: Array.isArray(co.links) ? co.links.length : 0,
  })

  const docs = await Document.find({ company: co._id }).lean()
  console.log('\n=== Documents for 35387857 (by company) ===  count =', docs.length)
  for (const d of docs) console.log({
    _id: d._id.toString(),
    docNumber: d.docNumber,
    name: d.name,
    type: d.type,
    category: d.category,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    hasFile: !!d.fileUrl && d.fileSize > 0,
  })

  // 公司详情"文件 Tab"读哪里?也许是按 scope/companyId
  const allDocs35387857 = await Document.find({ $or: [{ company: co._id }, { companyId: co._id }, { scope: 'company', company: co._id }, { company: co._id.toString() }] }).lean()
  console.log('docs by $or count:', allDocs35387857.length)

  // 查 ComplianceReminder 的 BR/NAR1 reminder
  const ComplianceReminder = require('../server/models/ComplianceReminder')
  const rms = await ComplianceReminder.find({ $or: [{ company: co._id }, { companyId: co._id }] }).lean()
  console.log('\n=== Reminders for 35387857 ===  count =', rms.length)
  for (const r of rms) console.log({
    ruleId: r.ruleId,
    status: r.status,
    dueDate: r.dueDate,
    baseDate: r.baseDate,
    sourceField: r.sourceField,
  })

  await mongoose.disconnect()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
