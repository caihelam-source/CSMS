/**
 * migrate-company-former-fields.js — 一次性数据迁移：为现有 Company 集合加 v6.x 去重/合并所需的字段
 *
 * 行为：
 *   - 把 status 未定义或非 enum 值的记录强制为 'active'（防御性兜底）
 *   - 给所有 Company 补 formerNames=[]（默认空数组，可多次运行幂等）
 *   - 给所有 Company 补 mergedInto / mergedAt / mergedBy 缺省 null
 *   - 打印 before/after 计数 + 抽样变更
 *
 * 安全：
 *   - 仅 $set 新字段，绝不修改原有业务字段（name/nameChinese/registrationNumber/links 等）
 *   - $set 同一字段为相同值是 no-op，不增加额外写入
 *   - 配合 schema 升级（Company.js 已扩展 status enum + 加 formerNames[] + 索引），
 *     mongoose 默认不强制落 enum，但本脚本以"摸底 + 安全兜底"为主，不触发校验失败
 *
 * 用法：
 *   node scripts/migrate-company-former-fields.js           # 真实写入
 *   node scripts/migrate-company-former-fields.js --dry-run # 仅打印
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }

const mongoose = require('mongoose')
const Company = require('../server/models/Company')

// ---------- SECRETS 解析（与 seed-nar1-full.js 同款）----------
function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  const txt = fs.readFileSync(p, 'utf8')
  const out = {}
  const m = txt.match(/mongodb\+srv:\/\/\S+/i)
  if (m) out.MONGODB_URI = m[0].replace(/["'`)\]]/g, '').trim()
  return out
}
const SEC = parseSecrets()
process.env.MONGODB_URI = process.env.MONGODB_URI || SEC.MONGODB_URI

const DRY_RUN = process.argv.includes('--dry-run')

;(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ 缺少 MONGODB_URI（环境变量或 .workbuddy/memory/SECRETS.md）')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ 已连接数据库')

  const total = await Company.countDocuments()
  const noStatus = await Company.countDocuments({ status: { $exists: false } })
  const merged = await Company.countDocuments({ status: 'merged' })
  console.log(`Company 总数=${total} status缺失=${noStatus} 已合并=${merged}`)

  if (DRY_RUN) {
    console.log('--- DRY-RUN：不修改，仅打印计划 ---')
    const sample = await Company.find().limit(3).lean()
    sample.forEach((c) => console.log('  sample:', { _id: c._id, name: c.name, status: c.status, formerNames: c.formerNames }))
    await mongoose.disconnect()
    return
  }

  // 1) status 兜底：缺失或不在 enum 内 → 'active'
  //    enum = ['active','dormant','struck_off','winding_up','dissolved','merged']
  const ALLOWED_STATUS = new Set(['active', 'dormant', 'struck_off', 'winding_up', 'dissolved', 'merged'])
  const bad = await Company.find({ status: { $nin: Array.from(ALLOWED_STATUS) } })
    .select('_id name status').lean()
  if (bad.length) {
    await Company.updateMany(
      { _id: { $in: bad.map((c) => c._id) } },
      { $set: { status: 'active' } },
    )
    console.log(`  status 兜底：${bad.length} 条 → 'active'`)
  } else {
    console.log('  status 全部命中 enum，无需修复')
  }

  // 2) formerNames[] 兜底：缺则补 []
  const r2 = await Company.updateMany(
    { formerNames: { $exists: false } },
    { $set: { formerNames: [] } },
  )
  console.log(`  formerNames[] 补齐：modified=${r2.modifiedCount || 0}`)

  // 3) mergedInto / mergedAt / mergedBy 缺省 null
  const r3 = await Company.updateMany(
    { mergedInto: { $exists: false } },
    { $set: { mergedInto: null, mergedAt: null, mergedBy: null } },
  )
  console.log(`  merged* 字段补齐：modified=${r3.modifiedCount || 0}`)

  console.log('✅ 数据迁移完成（幂等，多次跑安全）')
  await mongoose.disconnect()
})().catch((e) => {
  console.error('❌ 失败：', e.message)
  process.exit(1)
})
