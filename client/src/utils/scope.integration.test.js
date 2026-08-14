// 行级数据权限 —— 端到端语义校验（对真实 mock 数据跑一遍演示账号矩阵）
// 目的：锁死 T05 的联调验收口径，防止后续改 mock 数据或过滤逻辑时悄悄回归。
import { test, expect } from 'vitest'
import { getMockUserByEmail, MOCK_DEMO_ACCOUNTS, DEMO_COMPANIES, DEMO_PERSONNEL, DEMO_DOCUMENTS } from '../services/mock.js'
import { normalizeScopeIds, inScopeId, personnelIdsInScope, toId } from './scope.js'

/** 复刻 useScopedItems 的纯函数版本（hook 不便在 node 环境跑） */
const scopeItems = (items, scopeIds, getCid) =>
  scopeIds === null ? items : items.filter((it) => inScopeId(scopeIds, toId(getCid(it))))

/** 复刻 useScopedPersonnel */
const scopePersonnel = (personnel, companies, scopeIds) => {
  const allow = personnelIdsInScope(companies, scopeIds)
  if (allow === null) return personnel
  return personnel.filter((p) => allow.has(String(toId(p._id))))
}

/** 复刻 useScopedDocuments */
const scopeDocuments = (docs, companies, scopeIds) => {
  if (scopeIds === null) return docs
  const allowP = personnelIdsInScope(companies, scopeIds)
  return docs.filter((d) => {
    const cid = toId(d.company)
    if (cid) return inScopeId(scopeIds, cid)
    const pid = toId(d.personnel)
    if (pid) return allowP.has(String(pid))
    return false
  })
}

const scopeOf = (email) => normalizeScopeIds(getMockUserByEmail(email))

test('演示账号清单齐备（admin / demo / manager / viewer）', () => {
  expect(MOCK_DEMO_ACCOUNTS.map((a) => a.email)).toEqual([
    'admin@example.com',
    'demo@example.com',
    'manager@example.com',
    'viewer@example.com',
  ])
  // 每个演示账号都必须能在 mock 用户表中解析出来，否则切换后会拿不到 accessibleCompanies
  MOCK_DEMO_ACCOUNTS.forEach((a) => expect(getMockUserByEmail(a.email)).toBeTruthy())
})

test('admin → 不受限（scope=null），可见全部公司', () => {
  const scope = scopeOf('admin@example.com')
  expect(scope).toBe(null)
  expect(scopeItems(DEMO_COMPANIES, scope, (c) => c._id).length).toBe(DEMO_COMPANIES.length)
})

test('auditor → 不受限（跨公司审计只读，不能被误伤）', () => {
  expect(scopeOf('auditor@example.com')).toBe(null)
})

test('demo(secretary) → 受限但覆盖全部公司（防默认演示账号全站空白）', () => {
  const scope = scopeOf('demo@example.com')
  expect(Array.isArray(scope)).toBe(true)
  expect(scope.length).toBe(DEMO_COMPANIES.length)
  expect(scopeItems(DEMO_COMPANIES, scope, (c) => c._id).length).toBe(DEMO_COMPANIES.length)
  // 关键：演示账号绝不能看到空列表
  expect(scopeItems(DEMO_COMPANIES, scope, (c) => c._id).length).toBeGreaterThan(0)
})

test('manager → 只见 c1/c2 两家公司', () => {
  const scope = scopeOf('manager@example.com')
  expect(scope).toEqual(['c1', 'c2'])
  const visible = scopeItems(DEMO_COMPANIES, scope, (c) => c._id)
  expect(visible.map((c) => c._id)).toEqual(['c1', 'c2'])
})

test('manager → 人员反查只见 p1/p2/p4', () => {
  const scope = scopeOf('manager@example.com')
  const visibleCompanies = scopeItems(DEMO_COMPANIES, scope, (c) => c._id)
  const visible = scopePersonnel(DEMO_PERSONNEL, visibleCompanies, scope)
  expect(visible.map((p) => p._id).sort()).toEqual(['p1', 'p2', 'p4'])
})

test('manager → 文档只见归属可见公司/人员的', () => {
  const scope = scopeOf('manager@example.com')
  const visible = scopeDocuments(DEMO_DOCUMENTS, DEMO_COMPANIES, scope)
  visible.forEach((d) => {
    const cid = toId(d.company)
    if (cid) expect(['c1', 'c2']).toContain(String(cid))
  })
  // 不得出现 c3 及以后公司的文档
  expect(visible.some((d) => String(toId(d.company)) === 'c3')).toBe(false)
})

test('viewer → 只见 c3（另一套范围，验证过滤真的随账号变化）', () => {
  const scope = scopeOf('viewer@example.com')
  expect(scope).toEqual(['c3'])
  const visible = scopeItems(DEMO_COMPANIES, scope, (c) => c._id)
  expect(visible.map((c) => c._id)).toEqual(['c3'])
  const people = scopePersonnel(DEMO_PERSONNEL, visible, scope)
  expect(people.map((p) => p._id).sort()).toEqual(['p3', 'p4'])
})

test('manager 与 viewer 的可见集合互不相同（证明不是 no-op 假过滤）', () => {
  const mgr = scopeItems(DEMO_COMPANIES, scopeOf('manager@example.com'), (c) => c._id).map((c) => c._id)
  const vwr = scopeItems(DEMO_COMPANIES, scopeOf('viewer@example.com'), (c) => c._id).map((c) => c._id)
  expect(mgr).not.toEqual(vwr)
  expect(mgr.filter((id) => vwr.includes(id))).toEqual([])
})

test('本地新增越权记录不会绕过渲染期过滤（防 setXxx 处过滤的漏洞）', () => {
  const scope = scopeOf('manager@example.com')
  // 模拟用户在页面上新建了一条挂到越权公司 c3 的任务
  const tasks = [{ _id: 't1', company: { _id: 'c1' } }, { _id: 't99', company: { _id: 'c3' } }]
  const visible = scopeItems(tasks, scope, (t) => t.company?._id ?? t.company)
  expect(visible.map((t) => t._id)).toEqual(['t1'])
})
