/**
 * dedup-personnel-dry-run.js — 仅检测人员重复组（不改数据）
 *
 * 使用 server/utils/personnelDedup.findPersonnelDuplicates（三层：exact_nric / exact_chinese / alias / pinyin）
 * 识别「纯中文 ↔ 拼音+中文」变体，并查每组 link 数给出建议 target。
 *
 * 用法：node scripts/dedup-personnel-dry-run.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch { /* best-effort DNS resolver */ }
const mongoose = require('mongoose')
const parseSecrets = () => {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  const m = fs.readFileSync(p, 'utf8').match(/mongodb\+srv:\/\/\S+/i)
  return m ? m[0].replace(/["'`)\]]/g, '').trim() : ''
}
process.env.MONGODB_URI = process.env.MONGODB_URI || parseSecrets()

;(async () => {
  if (!process.env.MONGODB_URI) { console.error('缺少 MONGODB_URI'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)
  const Personnel = require('../server/models/Personnel')
  const Company = require('../server/models/Company')
  const { findPersonnelDuplicates } = require('../server/utils/personnelDedup')

  const all = await Personnel.find({ status: { $ne: 'merged' } }).lean()
  const pairs = findPersonnelDuplicates(all)
  console.log('=== 人员去重检测：' + all.length + ' 条记录，命中 ' + pairs.length + ' 对 ===')

  if (!pairs.length) { console.log('✅ 无重复'); await mongoose.disconnect(); return }

  // union-find 分组
  const parent = {}
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const union = (a, b) => { parent[find(a)] = find(b) }
  const idSet = new Set()
  pairs.forEach((p) => {
    const a = String(p.a._id), b = String(p.b._id)
    idSet.add(a); idSet.add(b)
    if (!parent[a]) parent[a] = a
    if (!parent[b]) parent[b] = b
    union(a, b)
  })
  const groups = {}
  idSet.forEach((id) => { const r = find(id); (groups[r] = groups[r] || []).push(id) })

  const linkCounts = {}
  await Promise.all([...idSet].map(async (id) => {
    linkCounts[id] = await Company.countDocuments({ 'links.link': id, 'links.linkModel': 'Personnel' })
  }))
  const byId = new Map(all.map((r) => [String(r._id), r]))

  let gi = 0
  Object.values(groups).forEach((ids) => {
    gi++
    const members = ids.map((id) => byId.get(id)).filter(Boolean)
    const scored = members.map((m) => ({
      m,
      score: (linkCounts[String(m._id)] || 0) * 100 + (m.nameChinese ? 10 : 0) + (m.roles ? m.roles.length : 0),
    }))
    scored.sort((x, y) => y.score - x.score)
    const target = scored[0].m
    console.log('\n# 组 ' + gi + ' (' + members.length + ' 条 → 建议合并为 1 人)')
    console.log('  target(建议) = "' + target.name + '" / ' + (target.nameChinese || '') + ' [links=' + linkCounts[String(target._id)] + '] _id=' + target._id)
    members.forEach((m) => {
      const mark = m._id === target._id ? '  → TARGET' : '  → merge into target'
      console.log('   - "' + m.name + '" / ' + (m.nameChinese || '') + ' [links=' + linkCounts[String(m._id)] + '] _id=' + m._id + mark)
    })
  })
  const mergedSources = idSet.size - gi
  console.log('\n=== 共 ' + gi + ' 个重复组，合并 ' + mergedSources + ' 条源；合并后人员数 = ' + (all.length - mergedSources) + ' ===')
  await mongoose.disconnect()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
