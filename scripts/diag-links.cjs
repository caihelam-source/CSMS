// 直连 Atlas 验证 14 家公司链接的 Personnel.name 是否为空
require('dns').setServers(['8.8.8.8', '1.1.1.1'])
require('../server/models/Company') // 注册
require('../server/models/Personnel')
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

// 读 SECRETS.md
const secretsPath = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
const txt = fs.readFileSync(secretsPath, 'utf8')
const m = txt.match(/MONGODB_URI[^\n]*?(mongodb[^\s`]+)/i)
const URI = m ? m[1] : process.env.MONGODB_URI
if (!URI) { console.error('no MONGODB_URI'); process.exit(1) }

;(async () => {
  await mongoose.connect(URI)
  const Company = mongoose.model('Company')
  const Personnel = mongoose.model('Personnel')
  const cos = await Company.find({ status: { $ne: 'merged' } }).select('name registrationNumber links').lean()
  console.log('Active companies:', cos.length)
  // 取首 3 家，看每家的 links 结构
  for (const c of cos.slice(0, 3)) {
    console.log('\n===', c.name, '|', c.registrationNumber, '|', c.links.length, 'links ===')
    for (const l of c.links) {
      const p = await Personnel.findById(l.link).select('name nameChinese').lean()
      console.log(`  role=${(l.roles||[]).join('|')}, linkType=${l.linkModel}, linkId=${l.link}, personnel.name="${p?.name || '(NULL)'}", personnel.nameChinese="${p?.nameChinese || ''}"`)
    }
  }
  // 全局统计
  let totalLinks = 0, emptyName = 0, brokenLink = 0
  for (const c of cos) {
    for (const l of c.links) {
      totalLinks++
      if (!l.link) { brokenLink++; continue }
      const p = await Personnel.findById(l.link).select('name').lean()
      if (!p || !p.name) emptyName++
    }
  }
  console.log('\n=== TOTALS ===')
  console.log('totalLinks:', totalLinks, 'brokenLink(null linkId):', brokenLink, 'emptyName(Personnel w/o name):', emptyName)
  await mongoose.disconnect()
})().catch(e => { console.error(e); process.exit(1) })
