// 行级数据权限（前端渲染期无声过滤）
//
// 三态语义（与 server/middleware/scope.js 严格对齐，任何地方都不得把 [] 当成"不限"）：
//   null      → 不受限（admin / auditor，或旧登录态无 accessibleCompanies 字段）
//   []        → 明确无授权（结果为空）
//   ['c1',..] → 受限于这些公司
//
// 设计要点：
//  1. 真实模式下服务端已过滤，前端再过滤是幂等 no-op —— 因此不需要 isMockMode() 分支。
//  2. accessibleCompanies 缺失（undefined）一律不过滤：旧登录态没有该字段，
//     宁可 no-op 也不能让全站空白。
//  3. 公司归属取值统一走 toId()：real 返回 ObjectId/字符串，mock 返回 { _id, name } 对象。
//     所有比较一律 String() 之后再比。

// 行级权限豁免角色 —— 与 server/middleware/rbac.js:13 SCOPE_BYPASS_ROLES 对齐
export const SCOPE_BYPASS_ROLES = ['admin', 'auditor']

// 未分配任何可访问公司时的统一空态文案（scopeIds 为 [] 的场景）
export const NO_SCOPE_HINT = '当前账号尚未被分配可访问公司，请联系管理员在「管理后台 → 数据权限」中分配'

/** 从 ObjectId / 字符串 / { _id } / { id } 中统一取出 ID 原始值 */
export const toId = (v) => (v && typeof v === 'object' ? (v._id ?? v.id) : v)

/** 该用户是否豁免行级过滤（注意：不能只判 isAdmin，否则 auditor 被误伤） */
export const isScopeBypass = (user) => SCOPE_BYPASS_ROLES.includes(user?.role)

/**
 * 归一化用户可访问公司 ID 列表。
 * @returns {string[]|null} null 表示不受限；[] 表示明确无授权
 */
export function normalizeScopeIds(user) {
  if (!user || isScopeBypass(user)) return null
  const raw = user.accessibleCompanies
  // 缺失字段 → 不过滤（兼容旧登录态；真实模式服务端已过滤）
  if (raw === undefined || raw === null) return null
  return (Array.isArray(raw) ? raw : []).map(toId).filter(Boolean).map(String)
}

/** 单个公司 ID 是否在范围内 */
export const inScopeId = (scopeIds, cid) =>
  scopeIds === null || (!!cid && scopeIds.includes(String(cid)))

/**
 * 由可见公司的 links 反查可见人员 ID 集合（Personnel 无 company 字段，唯一事实源是 Company.links）。
 * @returns {Set<string>|null} null 表示不受限
 */
export function personnelIdsInScope(companies, scopeIds) {
  if (scopeIds === null) return null
  const set = new Set()
  ;(companies || []).forEach((c) => {
    if (!inScopeId(scopeIds, toId(c._id))) return
    ;(c.links || []).forEach((l) => {
      if (l.linkModel !== 'Personnel') return
      const id = toId(l.link)
      if (id) set.add(String(id))
    })
  })
  return set
}
