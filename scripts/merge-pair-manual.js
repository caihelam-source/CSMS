/**
 * merge-pair-manual.js — 手动指定一对公司做软合并（供 fuzzy<1.0 等需人工定方向的对）
 *
 * 与 exec-merge-plan.js / routes/companies.js 的 merge 等价：引用迁移 → formerNames 入 target
 * → 源 nameChinese 补到 target（若 target 缺）→ 文件两遍写重编号 → 软关 source(status='merged')。
 *
 * 定位：--source-br / --target-br（按注册号查，稳定）或 --source / --target（按 _id）。
 * 安全：默认 dry-run 打印计划；--apply 才真合（软合并，可 --rollback 恢复）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }

const mongoose = require('mongoose')
const Company = require('../server/models/Company')
const Document = require('../server/models/Document')
const Meeting = require('../server/models/Meeting')
const Task = require('../server/models/Task')
const SignTask = require('../server/models/SignTask')
const ComplianceReminder = require('../server/models/ComplianceReminder')
const { applyDocRenumbers } = require('../server/utils/docFileCode')

function parseSecrets() {
  const p = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (!fs.existsSync(p)) return {}
  return (fs.readFileSync(p, 'utf8').match(/mongodb\+srv:\/\/\S+/i) || [])[0]?.replace(/["'`)\]]/g, '').trim() || {}
}
process.env.MONGODB_URI = process.env.MONGODB_URI || parseSecrets()

const APPLY = process.argv.includes('--apply')
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : undefined }
const SRC_BR = arg('source-br'); const TGT_BR = arg('target-br')
const SRC_ID = arg('source'); const TGT_ID = arg('target')

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

;(async () => {
  if (!process.env.MONGODB_URI) { console.error('❌ 缺少 MONGODB_URI'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ 已连接数据库')

  const findOne = async (br, id) => {
    if (id) return Company.findById(id).lean()
    if (br) return Company.findOne({ registrationNumber: br }).lean()
    return null
  }
  const source = await findOne(SRC_BR, SRC_ID)
  const target = await findOne(TGT_BR, TGT_ID)
  if (!source || !target) {
    console.error('❌ 找不到公司：', { SRC_BR, TGT_BR, SRC_ID, TGT_ID, src: !!source, tgt: !!target })
    await mongoose.disconnect(); process.exit(1)
  }
  console.log(`source = ${source.name} (${source.registrationNumber}) [_id=${source._id}] status=${source.status}`)
  console.log(`target = ${target.name} (${target.registrationNumber}) [_id=${target._id}] status=${target.status}`)

  if (source.status === 'merged' || target.status === 'merged') {
    console.error('⚠️  源或目标已是 merged，跳过（如需重做先 --rollback）')
    await mongoose.disconnect(); process.exit(1)
  }

  if (!APPLY) {
    console.log('\n--- DRY-RUN：不修改任何数据 ---')
    console.log(`计划：将 ${source.name} 软合并入 ${target.name}；formerNames 加入「${source.name}」；nameChinese「${source.nameChinese || ''}」补入 target（若缺）；文件重编号`)
    await mongoose.disconnect(); return
  }

  // 1) 引用迁移
  await Promise.all([
    Document.updateMany({ company: source._id }, { $set: { company: target._id } }),
    Meeting.updateMany({ company: source._id }, { $set: { company: target._id } }),
    Task.updateMany({ company: source._id }, { $set: { company: target._id } }),
    SignTask.updateMany({ company: source._id }, { $set: { company: target._id } }),
    ComplianceReminder.updateMany({ company: source._id }, { $set: { company: target._id } }),
  ])
  // 2) formerNames + nameChinese 补位
  const sDoc = await Company.findById(source._id)
  const tDoc = await Company.findById(target._id)
  tDoc.formerNames = [...(tDoc.formerNames || []), {
    name: sDoc.name,
    nameChinese: sDoc.nameChinese || undefined,
    changedAt: new Date(),
    source: 'merger',
    mergedFromCompanyId: sDoc._id,
    notes: sDoc.registrationNumber ? `原 BR: ${sDoc.registrationNumber}` : undefined,
  }]
  if (!tDoc.nameChinese && sDoc.nameChinese) { tDoc.nameChinese = sDoc.nameChinese; console.log(`     ↳ target.nameChinese 补为「${sDoc.nameChinese}」`) }
  await tDoc.save()
  // 3) 文件重编号（两遍写）
  const tDocs = await Document.find({ company: tDoc._id }).select('_id type createdAt docNumber').lean()
  const n = await applyDocRenumbers(Document, tDoc, tDocs)
  if (n) console.log(`     ↳ 文件重编号 ${n} 份`)
  // 4) 软关 source
  sDoc.status = 'merged'
  sDoc.mergedInto = tDoc._id
  sDoc.mergedAt = new Date()
  sDoc.mergedBy = null
  sDoc.links = []
  await sDoc.save()
  console.log(`\n✅ ${sDoc.name} → ${tDoc.name}（formerNames 已含 merger 来源）`)
  await sleep(100)
  await mongoose.disconnect()
})().catch((e) => { console.error('❌ 失败：', e.message); process.exit(1) })
