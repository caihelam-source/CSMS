/**
 * migrate-docnumber-index.js — 把 Document.docNumber 从「全局唯一」改为「公司内唯一」
 *
 * 背景：v6.x 文件编号 <entityCode>-<year>-<type>-<seq>（如 HKOP-2026-BR-0001）按设计是
 *       公司内序列，同一 entityCode 的多家公司各自从 0001 起。但原 schema 给 docNumber
 *       建了全局唯一索引 docNumber_1，导致公司合并重编号时不同 HKOP 公司争抢同一编号 → E11000。
 *
 * 动作：
 *   1) 先查 (company, docNumber) 是否已存在重复（有则中止，避免建索引失败）
 *   2) 删除旧全局唯一索引 docNumber_1
 *   3) 建复合唯一索引 company_docnumber_unique = { company:1, docNumber:1 } (sparse)
 *
 * 默认 dry-run 仅检查 + 打印计划；--apply 才真改索引。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }

const mongoose = require('mongoose')
const Document = require('../server/models/Document')

function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  const txt = fs.readFileSync(p, 'utf8')
  return (txt.match(/mongodb\+srv:\/\/\S+/i) || [])[0]?.replace(/["'`)\]]/g, '').trim() || {}
}
process.env.MONGODB_URI = process.env.MONGODB_URI || parseSecrets()

const APPLY = process.argv.includes('--apply')

;(async () => {
  if (!process.env.MONGODB_URI) { console.error('❌ 缺少 MONGODB_URI'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ 已连接数据库')

  const coll = Document.collection

  // 1) 查公司内重复
  const dupes = await coll.aggregate([
    { $match: { docNumber: { $exists: true, $ne: null }, company: { $exists: true, $ne: null } } },
    { $group: { _id: { company: '$company', docNumber: '$docNumber' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 50 },
  ]).toArray()
  if (dupes.length) {
    console.error(`❌ 发现 ${dupes.length} 处 (company, docNumber) 重复，先手工去重再建索引：`)
    dupes.forEach((d) => console.error('   ', JSON.stringify(d._id), 'x', d.n))
    await mongoose.disconnect()
    process.exit(1)
  }
  console.log('✅ 无公司内 docNumber 重复')

  // 现有索引
  const indexes = await coll.indexes()
  const hasGlobal = indexes.find((i) => i.name === 'docNumber_1')
  const hasCompound = indexes.find((i) => i.name === 'company_docnumber_unique')
  console.log(`   旧全局索引 docNumber_1: ${hasGlobal ? '存在' : '不存在'}`)
  console.log(`   新复合索引 company_docnumber_unique: ${hasCompound ? '已存在' : '不存在'}`)

  if (!APPLY) {
    console.log('\n--- DRY-RUN：不加 --apply 不改索引 ---')
    console.log('   计划：drop docNumber_1（若存在）→ create company_docnumber_unique')
    await mongoose.disconnect()
    return
  }

  // 2) 删旧
  if (hasGlobal) {
    await coll.dropIndex('docNumber_1')
    console.log('✅ 已删除 docNumber_1')
  } else {
    console.log('ℹ️  docNumber_1 不存在，跳过删除')
  }
  // 3) 建新
  if (!hasCompound) {
    await coll.createIndex({ company: 1, docNumber: 1 }, { unique: true, sparse: true, name: 'company_docnumber_unique' })
    console.log('✅ 已创建 company_docnumber_unique')
  } else {
    console.log('ℹ️  company_docnumber_unique 已存在')
  }

  await mongoose.disconnect()
  console.log('\n✅ 索引迁移完成')
})().catch((e) => { console.error('❌ 失败：', e.message); process.exit(1) })
