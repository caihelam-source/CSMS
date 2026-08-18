// useCompanyTasks — 公司维度任务取数 / 创建 / 刷新（D2 等价重构，封装 taskService）。
// 与原 CompanyDetail.loadAll 中的 tasks 分支行为一致：创建后局部刷新任务列表，避免整页重载。
import { useCallback } from 'react'
import { taskService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'

export function useCompanyTasks(companyId) {
  const createTask = useCallback(async (payload) => {
    const res = await taskService.create({ ...payload, company: companyId })
    return res
  }, [companyId])

  const reload = useCallback(async () => {
    const res = await taskService.getByCompany(companyId).catch(() => ({ data: { data: [] } }))
    return toArray(res?.data?.data, 'tasks')
  }, [companyId])

  return { createTask, reload }
}
