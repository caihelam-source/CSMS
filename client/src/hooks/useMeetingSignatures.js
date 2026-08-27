// useMeetingSignatures — 公司会议 / 签署态取数（D2 等价重构，封装 meetingService）。
// 与原 CompanyDetail.loadAll 中的 meetings 分支行为一致，供 CompanyRegistersTab 复用。
import { useCallback, useMemo } from 'react'
import { meetingService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'

export function useMeetingSignatures(companyId) {
  const getMeetings = useCallback(async () => {
    const res = await meetingService.getByCompany(companyId).catch(() => ({ data: { data: [] } }))
    return toArray(res?.data?.data, 'meetings')
  }, [companyId])

  return useMemo(() => ({ getMeetings }), [getMeetings])
}
