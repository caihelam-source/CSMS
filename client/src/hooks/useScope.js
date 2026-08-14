// 行级数据权限 Hooks —— 只在渲染期派生（useMemo），绝不在 setXxx 时过滤。
// 原因：若在 setState 处过滤，本地新增/编辑的 push 会绕过过滤，出现越权行。
import { useMemo, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { inScopeId, normalizeScopeIds, personnelIdsInScope, toId } from '../utils/scope'

/**
 * 取当前用户的数据范围。
 * scopeIds: null=不受限 / []=明确无授权 / [...]=受限
 */
export function useScope() {
  const { user } = useAuth()
  const scopeIds = useMemo(() => normalizeScopeIds(user), [user])
  return {
    scopeIds,
    unrestricted: scopeIds === null,
    // noScope: 明确无授权（[]），用于列表空态提示；与"不受限"(null) 严格区分
    noScope: scopeIds?.length === 0,
    count: scopeIds?.length ?? null,
    isInScope: (cid) => inScopeId(scopeIds, cid),
  }
}

/**
 * 按公司归属过滤任意列表。
 * @param items 原始列表
 * @param getCompanyId (item) => 公司 ID（可为 ObjectId / 字符串 / { _id }）
 */
export function useScopedItems(items, getCompanyId) {
  const { scopeIds } = useScope()
  // getter 放 ref：调用方常传内联箭头函数，避免其身份变化导致 memo 每次失效
  const getter = useRef(getCompanyId)
  getter.current = getCompanyId
  return useMemo(
    () =>
      scopeIds === null
        ? items || []
        : (items || []).filter((it) => inScopeId(scopeIds, toId(getter.current(it)))),
    [items, scopeIds],
  )
}

/** 人员过滤：由可见公司的 links 反查可见人员集合 */
export function useScopedPersonnel(personnel, companies) {
  const { scopeIds } = useScope()
  return useMemo(() => {
    const allow = personnelIdsInScope(companies, scopeIds)
    if (allow === null) return personnel || []
    return (personnel || []).filter((p) => allow.has(String(toId(p._id))))
  }, [personnel, companies, scopeIds])
}

/** 文档过滤：优先按 company 归属；仅挂人员的文档回退到人员可见性 */
export function useScopedDocuments(docs, companies) {
  const { scopeIds } = useScope()
  return useMemo(() => {
    if (scopeIds === null) return docs || []
    const allowP = personnelIdsInScope(companies, scopeIds)
    return (docs || []).filter((d) => {
      const cid = toId(d.company)
      if (cid) return inScopeId(scopeIds, cid)
      const pid = toId(d.personnel)
      if (pid) return allowP.has(String(pid))
      return false // 既无公司也无人员归属 → 受限用户看不见
    })
  }, [docs, companies, scopeIds])
}
