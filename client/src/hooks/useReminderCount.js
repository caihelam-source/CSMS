// 派生「待处理合规提醒」数量，用于 Navbar 铃铛 / 底部 Tab 的未读徽标
// 取已逾期(expired) + 待办(upcoming) 两类活跃提醒之和；模块级缓存避免多组件重复拉取
import { useEffect, useState } from 'react'
import { complianceReminderService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'

let _p = null
function loadCount() {
  if (_p) return _p
  _p = Promise.all([
    complianceReminderService.getExpired().catch(() => ({ data: { data: [] } })),
    complianceReminderService.getScheduled({ status: 'upcoming' }).catch(() => ({ data: { data: [] } })),
  ])
    .then(([ex, sch]) => toArray(ex?.data?.data).length + toArray(sch?.data?.data).length)
    .catch(() => 0)
  return _p
}

export function useReminderCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    loadCount().then((n) => { if (alive) setCount(n) })
    return () => { alive = false }
  }, [])
  return count
}
