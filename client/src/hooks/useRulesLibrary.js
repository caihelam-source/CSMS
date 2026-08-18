// useRulesLibrary — 业绩排期规则库读 / 保存 / 导入（D1 等价重构，封装 scheduleService）。
import { useCallback } from 'react'
import { scheduleService } from '../services/index.js'

export function useRulesLibrary() {
  const getRules = useCallback(async () => {
    const res = await scheduleService.getRules()
    return res
  }, [])

  const saveRules = useCallback(async (lib) => {
    const res = await scheduleService.saveRules(lib)
    return res
  }, [])

  const importRules = useCallback(async (fd) => {
    const res = await scheduleService.importRules(fd)
    return res
  }, [])

  return { getRules, saveRules, importRules }
}
