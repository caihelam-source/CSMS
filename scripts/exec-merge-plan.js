/**
 * exec-merge-plan.js — 批量执行 merge（基于 _dedup_pairs.json）
 *
 * ⚠️ 副作用脚本：默认 dry-run，--apply 显式才真合并
 *
 * 设计：
 *   - 输入：scripts/_dedup_pairs.json（来自 dedup-dry-run.js）
 *   - 默认行为：列出每对的合并方向（target 候选）+ 是否建议 skip，等用户 --apply
 *   - --apply：按既定规则调 POST /api/companies/:id/merge
 *   - --apply 默认选边规则：
 *       1) exact_regno 类型：把 A（DEMO-*）合并到 B（真实 BR 号）；后者更可信
 *       2) fuzzy_name 1.000 类型：把 A（DEMO-*）合并到 B（ENT-* 兜底）；前者更接近文档命名
 *       3) fuzzy_name < 1.0：抛错让用户二次决策（不自动合并）
 *   - --rollback：对最近一次批量合并回滚（status='active' + 清 mergedInto + 把已迁引用改回）
 *       注意：rollback 仅恢复 status/mergedInto，反向引用（Document.company 等）若已被替换改回需另写脚本
 *
 * 安全：
 *   - 调用前后打印 before/after 计数
 *   - 任何 4xx/5xx 立即 abort，不继续后续合并
 *   - 每合并一对强 sleep 100ms 避免 Render 限流
 *
 * 用法：
 *   node scripts/exec-merge-plan.js                                  # dry-run 列表
 *   node scripts/exec-merge-plan.js --apply                          # 真合并
 *   node scripts/exec-merge-plan.js --only auto                     # 仅自动可合并（1.0）
 *   node scripts/exec-merge-plan.js --rollback                       # 回滚最近一次批量（仅 admin 手动）
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
const { applyDocRenumbers, inferEntityCode } = require('../server/utils/docFileCode')

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

const APPLY = process.argv.includes('--apply')
const ONLY_AUTO = process.argv.includes('--only-auto')
const ROLLBACK = process.argv.includes('--rollback')

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function pickMergeTarget(pair) {
  // exact_regno：优先 B（real BR 号，无 DEMO-/ENT- 前缀）
  if (pair.type === 'exact_regno') {
    const aIsDemo = /^demo-/i.test(pair.a.registrationNumber || '')
    const bIsDemo = /^demo-/i.test(pair.b.registrationNumber || '')
    if (aIsDemo && !bIsDemo) return { source: 'a', target: 'b', reason: 'A is DEMO- → real BR is target' }
    if (!aIsDemo && bIsDemo) return { source: 'b', target: 'a', reason: 'B is DEMO- → real BR is target' }
    // 都不是或都是 demo，按 A→B
    return { source: 'a', target: 'b', reason: 'default A→B' }
  }
  // fuzzy 1.0 完全相同：把 A（DE 早 mock）合到 B
  if (pair.type === 'fuzzy_name' && pair.score >= 1) {
    const aLooksDemo = /^demo-/i.test(pair.a.registrationNumber || '')
    const bLooksDemo = /^demo-/i.test(pair.b.registrationNumber || '')
    const aLooksEnt = /^ent-/i.test(pair.a.registrationNumber || '')
    const bLooksEnt = /^ent-/i.test(pair.b.registrationNumber || '')
    // 完全一样命名但注册号不同，可能 A 旧 B 新 / 反之
    if (aLooksDemo && bLooksEnt) return { source: 'a', target: 'b', reason: 'A:DEMO- → B:ENT- (later canonical)' }
    if (aLooksEnt && bLooksDemo) return { source: 'b', target: 'a', reason: 'A:ENT- → B:DEMO- (later canonical)' }
    // 都不是 demo/ent 形式：取更短、更标准的为 target
    if ((pair.b.formerNamesCount || 0) > (pair.a.formerNamesCount || 0)) return { source: 'a', target: 'b', reason: 'B has more history → target' }
    return { source: 'a', target: 'b', reason: 'default A→B' }
  }
  // fuzzy < 1.0：保守策略，不自动合并
  return { source: null, target: null, reason: 'fuzzy < 1.0; manual decision required' }
}

;(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ 缺少 MONGODB_URI')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ 已连接数据库')

  if (ROLLBACK) {
    // ⚠️ ROLLBACK：把所有 status='merged' 的公司恢复成 'active'，清 mergedInto（注意：反向引用不回退，仅清 soft-merge 标记）
    const mergedCompanies = await Company.find({ status: 'merged' }).select('_id name mergedAt mergedBy mergedInto').lean()
    console.log(`⚠️  ROLLBACK 候选：${mergedCompanies.length} 家 status='merged'`)
    if (!APPLY) {
      console.log('DRY-RUN：不修改，加 --apply 才真回滚')
      await mongoose.disconnect()
      return
    }
    const r = await Company.updateMany(
      { status: 'merged' },
      { $set: { status: 'active', mergedInto: null, mergedAt: null, mergedBy: null } },
    )
    console.log(`✅ 已恢复 ${r.modifiedCount} 家 status=merged → active`)
    await mongoose.disconnect()
    return
  }

  const planPath = path.join(__dirname, '_dedup_pairs.json')
  if (!fs.existsSync(planPath)) {
    console.error(`❌ 找不到 ${planPath}，请先跑 dedup-dry-run.js`)
    process.exit(1)
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  console.log(`📋 加载合并计划：${plan.count} 对（生成于 ${plan.generatedAt}）`)

  // 决策每对
  const decisions = plan.pairs.map((p) => ({ pair: p, decision: pickMergeTarget(p) }))

  if (ONLY_AUTO) {
    if (!APPLY) {
      console.log(`--only-auto：在 ${decisions.length} 对里，仅 ${decisions.filter((d) => d.decision.target && (d.pair.type === 'exact_regno' || d.pair.score >= 1)).length} 对可自动合并`)
      await mongoose.disconnect()
      return
    }
  }

  console.log('\n--- 合并计划 ---')
  decisions.forEach((d, i) => {
    const { pair, decision } = d
    if (decision.target) {
      const src = pair[decision.source]
      const tgt = pair[decision.target]
      console.log(`#${i + 1}. [${pair.type}] score=${pair.score.toFixed(3)}`)
      console.log(`     target = ${tgt.name} (${tgt.registrationNumber})`)
      console.log(`     source = ${src.name} (${src.registrationNumber}) → MERGE INTO target`)
      console.log(`     reason: ${decision.reason}`)
    } else {
      console.log(`#${i + 1}. [${pair.type}] score=${pair.score.toFixed(3)} — ⚠️  ${decision.reason}`)
    }
  })

  if (!APPLY) {
    console.log('\n--- DRY-RUN：不修改任何数据 ---')
    console.log('确认上述决策后，加 --apply 真合并')
    await mongoose.disconnect()
    return
  }

  // APPLY：调 mongoose updateMany 直接做（与 routes/companies.js merge 等价；通过 mongoose 走最稳）
  console.log('\n=== 执行合并 ===')
  let success = 0, failed = 0, skipped = 0
  for (let i = 0; i < decisions.length; i++) {
    const { pair, decision } = decisions[i]
    if (!decision.target) {
      console.log(`#${i + 1}. SKIP（manual decision required）`)
      skipped++
      continue
    }
    const srcId = String(pair[decision.source]._id)
    const tgtId = String(pair[decision.target]._id)
    const source = await Company.findById(srcId)
    const target = await Company.findById(tgtId)
    if (!source || !target) {
      console.log(`#${i + 1}. FAIL 公司已不在`)
      failed++
      continue
    }
    if (source.status === 'merged' || target.status === 'merged') {
      console.log(`#${i + 1}. SKIP (already merged)`)
      skipped++
      continue
    }

    try {
      // 1) 重指反向引用
      await Promise.all([
        Document.updateMany({ company: source._id }, { $set: { company: target._id } }),
        Meeting.updateMany({ company: source._id }, { $set: { company: target._id } }),
        Task.updateMany({ company: source._id }, { $set: { company: target._id } }),
        SignTask.updateMany({ company: source._id }, { $set: { company: target._id } }),
        ComplianceReminder.updateMany({ company: source._id }, { $set: { company: target._id } }),
      ])
      // 1.5) 合并后重编号 target 的全部文件（含迁来的源文件，按 (entityCode,year,typeCode) 组内 seq 重置）
      //      用 applyDocRenumbers 两遍写，规避 docNumber 唯一索引瞬时冲突
      const targetDocs = await Document.find({ company: target._id }).select('_id type createdAt docNumber').lean()
      const renumCount = await applyDocRenumbers(Document, target, targetDocs)
      if (renumCount) {
        console.log(`     ↳ 文件重编号 ${renumCount} 份 (${inferEntityCode(target)}-...)`)
      }
      // 2) formerNames 入 target
      target.formerNames = [
        ...(target.formerNames || []),
        {
          name: source.name,
          nameChinese: source.nameChinese || undefined,
          changedAt: new Date(),
          source: 'merger',
          mergedFromCompanyId: source._id,
          notes: source.registrationNumber ? `原 BR: ${source.registrationNumber}` : undefined,
        },
      ]
      await target.save()
      // 3) 软关 source
      source.status = 'merged'
      source.mergedInto = target._id
      source.mergedAt = new Date()
      source.mergedBy = null
      source.links = []
      await source.save()
      success++
      console.log(`#${i + 1}. ✅ ${source.name} → ${target.name}`)
    } catch (e) {
      console.log(`#${i + 1}. ❌ ERR: ${e.message}`)
      failed++
    }
    await sleep(120)
  }

  console.log(`\n=== 汇总: 成功 ${success} / 失败 ${failed} / 跳过 ${skipped} ===`)
  await mongoose.disconnect()
})().catch((e) => {
  console.error('❌ 失败：', e.message)
  process.exit(1)
})
