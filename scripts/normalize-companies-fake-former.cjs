/**
 * 审计 / 归一：把"假曾用名"迁回正名 + 回填 nameChinese（同构 personnel normalize），
 * 数据语义："HUIJUN (INTERNATIONAL) HOLDINGS LIMITED" 和
 *          "HuiJun (International) Holdings Ltd（匯駿控股）" 是**同一公司的合法写法**，
 *          不是曾用名。
 *
 * 与 personnel normalize 不同点：公司的变体情况更复杂（大小写/缩写/标点/连字符等），
 * 因此仅对"归一后完全相等"的变体认定为 legal variant（更保守）。
 * "归一后仍不同"的视为 former name（保留）。
 *
 * 用法：
 *   set LOGIN_EMAIL=... & set LOGIN_PASSWORD=...
 *   node scripts/normalize-companies-fake-former.cjs            # dry-run 列出 N 项
 *   node scripts/normalize-companies-fake-former.cjs --apply    # 确认后写回
 *
 * 凭证从本地环境变量 LOGIN_EMAIL / LOGIN_PASSWORD 读取，不硬编码、不上送任何第三方。
 * 默认连 https://claw-api-5zq7.onrender.com（与 live-check 等同款）
 */

const API_BASE = process.env.CLAW_API_BASE || 'https://claw-api-5zq7.onrender.com'
const APPLY = process.argv.includes('--apply')

let dnsApplied = false
function ensureDns() {
  if (dnsApplied) return
  dnsApplied = true
  try {
    const dns = require('dns')
    dns.setServers(['8.8.8.8', '1.1.1.1'])
  } catch {}
}

const fetchFn = global.fetch || require('node:fetch')

async function login() {
  const email = process.env.LOGIN_EMAIL
  const password = process.env.LOGIN_PASSWORD
  if (!email || !password) {
    throw new Error('Set LOGIN_EMAIL and LOGIN_PASSWORD env vars first.')
  }
  ensureDns()
  const r = await fetchFn(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`login failed: ${r.status} ${txt.slice(0, 200)}`)
  }
  const j = await r.json()
  return j.token || j.data?.token || j.accessToken
}

async function listCompanies(token) {
  ensureDns()
  // 不传 ?includeMerged=true，merged 已被默认过滤；最多拉 100 条
  const r = await fetchFn(`${API_BASE}/api/companies?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`list failed: ${r.status}`)
  const j = await r.json()
  return j.companies || j.data?.companies || []
}

async function updateCompany(token, id, patch) {
  ensureDns()
  const r = await fetchFn(`${API_BASE}/api/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`update ${id} failed: ${r.status} ${t.slice(0, 200)}`)
  }
  return r.json()
}

// 引入后端归一逻辑（共享同一份规范）
function loadClassifier() {
  return require('../server/utils/companyNameNormalize')
}

async function auditAndPlan(token, apply) {
  const { classifyNameRelation } = loadClassifier()
  const companies = await listCompanies(token)
  console.log(`\n[AUDIT] 扫描 ${companies.length} 家 active 公司（merged 已过滤）\n`)

  const plan = []
  for (const c of companies) {
    if (!c.formerNames?.length) continue
    const kept = []
    const migrateToNameChinese = []
    let dirtyEntryCount = 0

    for (const fn of c.formerNames) {
      // 把 fn 当 source，c 当 target，走智能判定
      const relation = classifyNameRelation(
        { name: fn.name, nameChinese: fn.nameChinese },
        { name: c.name, nameChinese: c.nameChinese },
      )
      if (relation === 'different') {
        kept.push(fn) // 真曾用名：保留
      } else {
        // 合法变体 → 准备迁出 formerNames（迁到 target.nameChinese 缺啥补啥）
        dirtyEntryCount++
        if (fn.nameChinese && !c.nameChinese) {
          migrateToNameChinese.push(fn.nameChinese)
        }
      }
    }

    if (dirtyEntryCount > 0 || migrateToNameChinese.length) {
      plan.push({
        id: c._id,
        name: c.name,
        currentNameChinese: c.nameChinese || '(empty)',
        totalFormer: c.formerNames.length,
        dirtyCount: dirtyEntryCount,
        keepCount: kept.length,
        migrateToNameChinese,
      })
      console.log(
        `⚠ ${c.name} — ${dirtyEntryCount}/${c.formerNames.length} 条 formerNames 是合法变体`
        + (migrateToNameChinese.length
            ? `，可迁移 nameChinese: ${migrateToNameChinese.join(' / ')}`
            : ''),
      )
    }
  }

  if (!plan.length) {
    console.log('\n✅ 没有发现"假曾用名"，所有 formerNames 都是真历史改名。\n')
    return
  }

  console.log(`\n总计 ${plan.length} 家公司有"假曾用名"待清理。`)
  if (!apply) {
    console.log('dry-run 模式 — 不改数据。带 --apply 真正写回：')
    console.log('  node scripts/normalize-companies-fake-former.cjs --apply\n')
    return
  }

  console.log('\n--apply 模式：开始按计划归一 ...\n')
  for (const p of plan) {
    const kept = []
    let migratedChinese = null
    // 重读一次以拿 fresh formerNames
    for (const fn of (await getFreshFormer(token, p.id))) {
      const relation = classifyNameRelation(
        { name: fn.name, nameChinese: fn.nameChinese },
        { name: (await getFreshName(token, p.id)).name,
          nameChinese: (await getFreshName(token, p.id)).nameChinese },
      )
      if (relation === 'different') {
        kept.push(fn)
      } else if (fn.nameChinese && !migratedChinese) {
        migratedChinese = fn.nameChinese
      }
    }
    const patch = { formerNames: kept }
    if (migratedChinese) patch.nameChinese = migratedChinese
    await updateCompany(token, p.id, patch)
    console.log(`✓ ${p.name} — formerNames ${p.totalFormer} → ${kept.length}` +
      (migratedChinese ? `，nameChinese ← "${migratedChinese}"` : ''))
  }
}

async function getFreshFormer(token, id) {
  ensureDns()
  const r = await fetchFn(`${API_BASE}/api/companies/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  return (j.company || j.data?.company || j).formerNames || []
}
async function getFreshName(token, id) {
  ensureDns()
  const r = await fetchFn(`${API_BASE}/api/companies/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  return j.company || j.data?.company || j
}

async function main() {
  if (apply && !process.env.LOGIN_EMAIL) {
    console.error('--apply 需要登录凭证。先 dry-run 确认无虞。')
    process.exit(1)
  }
  let token
  try {
    token = await login()
  } catch (e) {
    if (APPLY) {
      console.error('login failed:', e.message)
      process.exit(1)
    }
    console.log('[dry-run] 未设登录凭证，跳过远程扫描。仅做静态归一演示。\n')
    return staticDemo()
  }
  await auditAndPlan(token, APPLY)
}

function staticDemo() {
  const { classifyNameRelation } = loadClassifier()
  const samples = [
    { name: 'HuiJun (International) Holdings Ltd', nameChinese: '匯駿控股' },
    { name: 'BVIexample HOLDINGS LIMITED' },
  ]
  for (const s of samples) {
    const rel1 = classifyNameRelation(s, {
      name: s.name.replace('Limited', 'LIMITED').replace('Ltd', 'LIMITED'),
      nameChinese: s.nameChinese,
    })
    console.log(`  case → ${s.name} / ${s.nameChinese || '(无)'}: 大小写归一后关系 = "${rel1}"`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
