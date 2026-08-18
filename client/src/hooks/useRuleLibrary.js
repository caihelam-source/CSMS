// useRuleLibrary — 合规规则库取数 / 创建（D2 等价重构，封装 complianceRuleService）。
// 与原 CompanyDetail.loadAll / handleSaveReminder 中的规则分支行为一致。
import { useCallback } from 'react'
import { complianceRuleService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'

export function useRuleLibrary() {
  const getRules = useCallback(async () => {
    const res = await complianceRuleService.getAll().catch(() => ({ data: { data: [] } }))
    return toArray(res?.data?.data, 'rules')
  }, [])

  const createRule = useCallback(async (payload) => {
    const res = await complianceRuleService.create(payload)
    return res
  }, [])

  return { getRules, createRule }
}
