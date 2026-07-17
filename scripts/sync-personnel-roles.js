#!/usr/bin/env node
/**
 * sync-personnel-roles.js — 让 stored Personnel.roles 与读时派生(Company.links)一致
 *
 * 背景：v5.0 读时聚合已使 API 列表/详情返回从 Company.links 派生的 roles（事实源）。
 * 但 Personnel.roles 作为缓存字段，在某些写路径（如合并）后可能滞后。本脚本一次性
 * 将每个 Personnel 的 roles 重算为「所有 Company.links 中指向该人员的 roles 并集」，
 * 保证 stored == derived，幂等可重复执行。
 *
 * 用法：
 *   node scripts/sync-personnel-roles.js                # 默认 dry-run（不写库，仅统计）
 *   node scripts/sync-personnel-roles.js --apply        # 写库
 *   MONGODB_URI=mongodb+srv://... node scripts/sync-personnel-roles.js --apply
 *
 * 生产护栏：库名含 prod|production|live|主 时，即使 --apply 也会被拦，
 *           需追加 --i-know-this-is-prod 显式放行。
 */
const mongoose = require('mongoose')

const APPLY = process.argv.includes('--apply')
const FORCE_PROD = process.argv.includes('--i-know-this-is-prod')
const URI = process.env.MONGODB_URI

function assertSafeToWrite(dbName) {
  if (!APPLY) return
  if (/prod|production|live|主/i.test(dbName) && !FORCE_PROD) {
    console.error('⛔ 拒绝写生产库。如需执行，追加 --i-know-this-is-prod')
    process.exit(1)
  }
}

async function main() {
  if (!URI) {
    console.error('⛔ 未设置 MONGODB_URI')
    process.exit(1)
  }
  await mongoose.connect(URI)
  const dbName = mongoose.connection.db.databaseName
  console.log(`连接库: ${dbName}${APPLY ? ' (APPLY)' : ' (DRY RUN)'}`)
  assertSafeToWrite(dbName)

  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies')
  const Personnel = mongoose.model('Personnel', new mongoose.Schema({}, { strict: false }), 'personnel')

  const agg = await Company.aggregate([
    { $unwind: '$links' },
    { $match: { 'links.linkModel': 'Personnel' } },
    { $unwind: { path: '$links.roles', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$links.link', roles: { $addToSet: '$links.roles' } } },
  ])
  const roleMap = new Map(agg.map((r) => [r._id.toString(), r.roles.filter(Boolean)]))

  const all = await Personnel.find({}, '_id roles')
  let changed = 0
  for (const p of all) {
    const derived = roleMap.get(p._id.toString()) || []
    const current = (p.roles || []).slice().sort()
    const next = derived.slice().sort()
    const same = current.length === next.length && current.every((v, i) => v === next[i])
    if (same) continue
    changed++
    if (APPLY) {
      await Personnel.updateOne({ _id: p._id }, { $set: { roles: derived } })
    } else {
      console.log(`  [dry] ${p._id}: ${JSON.stringify(current)} -> ${JSON.stringify(next)}`)
    }
  }

  console.log(`\n角色同步${APPLY ? '已写入' : '预览'}: ${changed} 人需更新 / 共 ${all.length} 人`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
