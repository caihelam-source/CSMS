// 日历取数 + 错误/空态 + CRUD 封装 Hook
// 所有视图统一经本 hook 取数，不直连 service，保证四视图行为一致。
// 区分 loading / error(显式报错) / empty(成功无数据) / data 四态。
import { useState, useCallback, useRef } from 'react'
import { calendarService } from '../../services/index.js'
import { toArray } from '../../utils/responseNormalize.js'

/**
 * @returns {{
 *   events: Array, loading: boolean, error: Error|null,
 *   load: (from: string, to: string, types?: string[]) => Promise<void>,
 *   createEvent: (payload: object) => Promise<any>,
 *   updateEvent: (id: string, payload: object) => Promise<any>,
 *   deleteEvent: (id: string) => Promise<void>,
 *   setEvents: (events: Array) => void,
 * }}
 */
export function useCalendarEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // 防止过期请求覆盖最新结果（并发/快速切换视图）
  const reqIdRef = useRef(0)

  const load = useCallback(async (from, to, types) => {
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await calendarService.getEvents(from, to, types)
      if (reqId !== reqIdRef.current) return // 已过期，丢弃
      const list = toArray(res?.data?.data, 'events')
      setEvents(Array.isArray(list) ? list : [])
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      // 显式记录错误：由视图层渲染 ErrorState，绝不静默为空
      setError(e instanceof Error ? e : new Error(String(e?.message || e)))
      setEvents([])
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [])

  const createEvent = useCallback(async (payload) => {
    const r = await calendarService.createEvent(payload)
    return r?.data?.data?.event || r?.data?.data || r
  }, [])

  const updateEvent = useCallback(async (id, payload) => {
    const r = await calendarService.updateEvent(id, payload)
    return r?.data?.data?.event || r?.data?.data || r
  }, [])

  const deleteEvent = useCallback(async (id) => {
    await calendarService.deleteEvent(id)
  }, [])

  return { events, loading, error, setEvents, load, createEvent, updateEvent, deleteEvent }
}
