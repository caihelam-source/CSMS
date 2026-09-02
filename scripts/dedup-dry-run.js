/**
 * dedup-dry-run.js — 真实库扫描重复公司对，输出 _dedup_pairs.json 让管理员审阅后再合并
 *
 * 设计要点：
 *   - 默认排除 status='merged' 源公司（它们已经被合并，重复对已闭环）
 *   - 三层匹配按强度排序，把 strongest 命中置顶
 *   - 输出文件路径：scripts/_dedup_pairs.json — 用户可打开看清单后再决定走 exec-merge-plan.js
 *   - 严格 dry-run：不修改任何数据
 *   - 可调阈值（--threshold=0.95 等）
 *
 * 用法：
 *   node scripts/dedup-dry-run.js                        # 默认 0.92
 *   node scripts/dedup-dry-run.js --threshold=0.95      # 调严
 *   node scripts/dedup-dry-run.js --include-merged      # 含已合并源公司（审计用）
 */
'use strict'

const fs = require('fs')
const path = require('path')
const dns = require('dns')
try { dns.setServers(['8.8.8.8', '1.1.1.1']) } catch (e) { console.log('⚠️ 无法设置 DNS resolver:', e.message) }

const mongoose = require('mongoose')
const Company = require('../server/models/Company')
const { findCompanyDuplicates, DEFAULT_FUZZY_THRESHOLD } = require('../server/utils/dedup')

// ---------- SECRETS ----------
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

function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`))
  return a ? a.split('=')[1] : fallback
}

const INCLUDE_MERGED = process.argv.includes('--include-merged')
const THRESHOLD = parseFloat(arg('threshold', String(DEFAULT_FUZZY_THRESHOLD)))

;(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ 缺少 MONGODB_URI（环境变量或 .workbuddy/memory/SECRETS.md）')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ 已连接数据库')

  const filter = INCLUDE_MERGED ? {} : { status: { $ne: 'merged' } }
  const companies = await Company.find(filter).lean()
  console.log(`📊 扫描公司：${companies.length} (含 merged: ${INCLUDE_MERGED})，阈值 ${THRESHOLD}`)

  const pairs = findCompanyDuplicates(companies, { fuzzyThreshold: THRESHOLD })
  console.log(`🔍 命中重复对：${pairs.length}`)

  // 精简输出：仅给 admin 决策需要的最少字段
  const lite = (c) => ({
    _id: c._id,
    name: c.name,
    nameChinese: c.nameChinese,
    registrationNumber: c.registrationNumber,
    jurisdiction: c.jurisdiction,
    stockCode: c.stockCode,
    type: c.type,
    status: c.status,
    formerNamesCount: (c.formerNames || []).length,
    mergedInto: c.mergedInto,
    linksCount: (c.links || []).length,
  })
  const payload = {
    generatedAt: new Date().toISOString(),
    threshold: THRESHOLD,
    includeMerged: INCLUDE_MERGED,
    scannedCompanies: companies.length,
    count: pairs.length,
    pairs: pairs.map(({ a, b, type, score, reason }) => ({
      type,
      score,
      reason,
      a: lite(a),
      b: lite(b),
    })),
  }

  const outPath = path.join(__dirname, '_dedup_pairs.json')
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
  console.log(`✅ 已写入 ${outPath}`)

  if (pairs.length > 0) {
    console.log('\n--- 命中摘要（前 10 对） ---')
    pairs.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. [${p.type}] score=${p.score.toFixed(3)}`)
      console.log(`     A: ${p.a.name} (BR=${p.a.registrationNumber})`)
      console.log(`     B: ${p.b.name} (BR=${p.b.registrationNumber})`)
    })
  }

  await mongoose.disconnect()
})().catch((e) => {
  console.error('❌ 失败：', e.message)
  process.exit(1)
})
