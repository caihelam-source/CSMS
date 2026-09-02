/**
 * exec-merge-personnel.js — 批量执行人员软合并（基于 detection，同源逻辑于 routes/personnel.js POST /merge）
 *
 * ⚠️ 副作用脚本：默认 dry-run，--apply 显式才真合并。
 *
 * 设计：
 *   - 检测：findPersonnelDuplicates（三层匹配）
 *   - 分组：并查集
 *   - target 选择：每组 link 数最多者（保住 Company.links 任职数据）；平手按 nameChinese > roles
 *   - 合并：源 status='merged' + mergedInto=target；迁移全部 7 类引用；formerNames 入 target；保最佳数据
 *   - --rollback：把所有 status='merged' 人员恢复为 'active'（仅清软合并标记；反向引用不回退）
 *
 * 用法：
 *   node scripts/exec-merge-personnel.js              # dry-run 列表
 *   node scripts/exec-merge-personnel.js --apply      # 真合并
 *   node scripts/exec-merge-personnel.js --rollback   # 回滚软合并标记
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

const APPLY = process.argv.includes('--apply')
const ROLLBACK = process.argv.includes('--rollback')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  if (!process.env.MONGODB_URI) { console.error('缺少 MONGODB_URI'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)
  const Personnel = require('../server/models/Personnel')
  const Company = require('../server/models/Company')
  const DirectorEntry = require('../server/models/DirectorEntry')
  const ShareholderEntry = require('../server/models/ShareholderEntry')
  const Meeting = require('../server/models/Meeting')
  const Document = require('../server/models/Document')
  const SignTask = require('../server/models/SignTask')
  const Task = require('../server/models/Task')
  const { findPersonnelDuplicates, extractBracketAliases } = require('../server/utils/personnelDedup')

  if (ROLLBACK) {
    const merged = await Personnel.find({ status: 'merged' }).select('_id name mergedAt mergedInto').lean()
    console.log('⚠️  ROLLBACK 候选：' + merged.length + ' 条 status=merged')
    if (!APPLY) { console.log('DRY-RUN：加 --apply 才真回滚'); await mongoose.disconnect(); return }
    const r = await Personnel.updateMany({ status: 'merged' }, { $set: { status: 'active', mergedInto: null, mergedAt: null, mergedBy: null } })
    console.log('✅ 已恢复 ' + r.modifiedCount + ' 条 status=merged → active')
    await mongoose.disconnect(); return
  }

  const all = await Personnel.find({ status: { $ne: 'merged' } }).lean()
  const pairs = findPersonnelDuplicates(all)

  // 分组
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

  const plans = Object.values(groups).map((ids) => {
    const members = ids.map((id) => byId.get(id)).filter(Boolean)
    const scored = members.map((m) => ({
      m,
      score: (linkCounts[String(m._id)] || 0) * 100 + (m.nameChinese ? 10 : 0) + (m.roles ? m.roles.length : 0),
    }))
    scored.sort((x, y) => y.score - x.score)
    return { target: scored[0].m, sources: scored.slice(1).map((s) => s.m) }
  })

  console.log('=== 检测到 ' + plans.length + ' 个重复组 ===')
  plans.forEach((pl, i) => {
    console.log('#' + (i + 1) + '. target = "' + pl.target.name + '" / ' + (pl.target.nameChinese || '') + ' [links=' + linkCounts[String(pl.target._id)] + ']')
    pl.sources.forEach((s) => console.log('     merge source "' + s.name + '" / ' + (s.nameChinese || '') + ' [links=' + linkCounts[String(s._id)] + '] _id=' + s._id))
  })

  if (!APPLY) { console.log('\n--- DRY-RUN：不修改任何数据；加 --apply 真合并 ---'); await mongoose.disconnect(); return }

  console.log('\n=== 执行合并 ===')
  let success = 0, failed = 0, skipped = 0
  for (let i = 0; i < plans.length; i++) {
    const { target, sources } = plans[i]
    try {
      const targetDoc = await Personnel.findById(target._id)
      if (!targetDoc || targetDoc.status === 'merged') { console.log('#' + (i + 1) + '. SKIP (target gone/merged)'); skipped++; continue }
      const tObj = new mongoose.Types.ObjectId(target._id)
      for (const s of sources) {
        const sourceDoc = await Personnel.findById(s._id)
        if (!sourceDoc || sourceDoc.status === 'merged') { console.log('#' + (i + 1) + '. SKIP source ' + s._id + ' (gone/merged)'); skipped++; continue }
        const sObj = new mongoose.Types.ObjectId(s._id)
        await Promise.all([
          Company.updateMany({ 'links.link': sObj, 'links.linkModel': 'Personnel' }, { $set: { 'links.$[elem].link': tObj } }, { arrayFilters: [{ 'elem.link': sObj, 'elem.linkModel': 'Personnel' }] }),
          DirectorEntry.updateMany({ personnelRef: s._id }, { $set: { personnelRef: target._id } }),
          ShareholderEntry.updateMany({ personnelRef: s._id }, { $set: { personnelRef: target._id } }),
          Meeting.updateMany({ 'attendees.ref': s._id }, { $set: { 'attendees.$.ref': target._id, 'attendees.$.name': targetDoc.name } }),
          Document.updateMany({ personnel: s._id }, { $set: { personnel: target._id } }),
          SignTask.updateMany({ signer: s._id }, { $set: { signer: target._id, signerName: targetDoc.name } }),
          SignTask.updateMany({ 'signers.signer': s._id }, { $set: { 'signers.$[x].signer': target._id } }, { arrayFilters: [{ 'x.signer': sObj }] }),
          Task.updateMany({ personnel: s._id }, { $set: { personnel: target._id } }),
        ])
        // roles 重算
        const targetCos = await Company.find({ 'links.link': tObj, 'links.linkModel': 'Personnel' }, 'links')
        targetDoc.roles = [...new Set(targetCos.flatMap((c) => (c.links || []).filter((l) => l.linkModel === 'Personnel' && l.link?.toString() === String(target._id)).flatMap((l) => l.roles || [])))]
        // 最佳数据
        if (!targetDoc.nric && sourceDoc.nric) targetDoc.nric = sourceDoc.nric
        if (!targetDoc.email && sourceDoc.email) targetDoc.email = sourceDoc.email
        if (!targetDoc.phone && sourceDoc.phone) targetDoc.phone = sourceDoc.phone
        if (!targetDoc.nameChinese && sourceDoc.nameChinese) targetDoc.nameChinese = sourceDoc.nameChinese
        if (!targetDoc.nationality && sourceDoc.nationality) targetDoc.nationality = sourceDoc.nationality
        if (sourceDoc.notes && !targetDoc.notes) targetDoc.notes = sourceDoc.notes
        else if (sourceDoc.notes) targetDoc.notes += '\n[来自合并] ' + sourceDoc.notes
        // formerNames
        const newFormer = [{ name: sourceDoc.name, nameChinese: sourceDoc.nameChinese || undefined, changedAt: new Date(), source: 'merger', mergedFromPersonnelId: sourceDoc._id }]
        for (const al of extractBracketAliases(sourceDoc.name)) {
          if (!targetDoc.formerNames?.some((f) => (f.nameChinese || f.name) === al)) {
            newFormer.push({ name: al, nameChinese: al, changedAt: new Date(), source: 'merger', mergedFromPersonnelId: sourceDoc._id })
          }
        }
        targetDoc.formerNames = [...(targetDoc.formerNames || []), ...newFormer]
        await targetDoc.save()
        // 软关 source
        sourceDoc.status = 'merged'
        sourceDoc.mergedInto = targetDoc._id
        sourceDoc.mergedAt = new Date()
        sourceDoc.mergedBy = null
        await sourceDoc.save()
        console.log('#' + (i + 1) + '. ✅ ' + sourceDoc.name + ' → ' + targetDoc.name)
      }
      success++
    } catch (e) {
      console.log('#' + (i + 1) + '. ❌ ERR: ' + e.message)
      failed++
    }
    await sleep(120)
  }
  console.log('\n=== 汇总: 成功 ' + success + ' 组 / 失败 ' + failed + ' / 跳过 ' + skipped + ' ===')
  await mongoose.disconnect()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
