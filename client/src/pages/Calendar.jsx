import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'

// 来源 → 着色（内联 hex，避免依赖具体 Tailwind 色阶）
const SOURCE_COLOR = {
  compliance_reminder: '#ef4444',
  task: '#2563EB',
  company_filing: '#f59e0b',
  document: '#0ea5e9',
  meeting: '#8b5cf6',
  results_timetable: '#ec4899',
}
const SOURCE_LABEL = {
  compliance_reminder: '合规提醒',
  task: '任务',
  company_filing: '公司申报',
  document: '文档',
  meeting: '会议',
  results_timetable: '业绩排期',
}
const PRIORITY_LABEL = { urgent: '紧急', high: '高', medium: '中', low: '低' }
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const ymd = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// 构建 6×7 网格（周日起始）
function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }
  return cells
}

export default function Calendar() {
  const navigate = useNavigate()
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeSources, setActiveSources] = useState([]) // 空 = 全部
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [digestState, setDigestState] = useState(null) // {type:'info'|'ok'|'warn', text}

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = ymd(new Date(cursor.year, cursor.month, 1))
      const to = ymd(new Date(cursor.year, cursor.month + 1, 0))
      const res = await calendarService.getEvents(from, to, activeSources)
      const list = toArray(res?.data?.data, 'events')
      setEvents(list)
    } catch (e) {
      console.error('[Calendar] 加载事件失败', e)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [cursor, activeSources])

  useEffect(() => { load() }, [load])

  const monthEvents = useMemo(() => {
    let evs = events
    if (onlyOpen) evs = evs.filter((e) => e.status === 'open' || e.status === 'overdue')
    // 按日期分组
    const map = {}
    for (const e of evs) {
      const key = ymd(e.date)
      ;(map[key] = map[key] || []).push(e)
    }
    return map
  }, [events, onlyOpen])

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor])
  const isCurrentMonth = (d) => d.getMonth() === cursor.month

  const toggleSource = (s) => {
    setActiveSources((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const sendDigest = async () => {
    setDigestState(null)
    try {
      const res = await calendarService.sendDigest()
      const payload = res?.data?.data || res?.data || res
      if (payload?.skipped) {
        setDigestState({ type: 'warn', text: 'SMTP 未配置，邮件未发送（请在环境变量设置 MAIL_*）' })
      } else if (payload?.sent) {
        setDigestState({ type: 'ok', text: `已发送本月摘要（${payload.count ?? 0} 项）至登录邮箱` })
      } else {
        setDigestState({ type: 'warn', text: payload?.message || '摘要发送未完成' })
      }
    } catch (e) {
      setDigestState({ type: 'warn', text: '发送失败：' + (e?.message || e) })
    }
  }

  const counts = useMemo(() => {
    const c = {}
    for (const e of events) c[e.source] = (c[e.source] || 0) + 1
    return c
  }, [events])

  const overdueCount = events.filter((e) => e.overdue).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* PageHeader */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink">日历</h1>
          <p className="text-sm text-ink-3 mt-1">
            跨模块聚合 · 本月 {events.length} 项
            {overdueCount > 0 && <span className="text-danger font-medium">（逾期 {overdueCount} 项）</span>}
          </p>
        </div>
        <button
          onClick={sendDigest}
          className="tap-target px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          发送本月摘要
        </button>
      </div>

      {digestState && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          digestState.type === 'ok' ? 'bg-primary-50 text-primary-700'
          : digestState.type === 'warn' ? 'bg-warning/10 text-warning'
          : 'bg-canvas text-ink-2'
        }`}>
          {digestState.text}
        </div>
      )}

      {/* 过滤器 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {Object.keys(SOURCE_LABEL).map((s) => {
          const active = activeSources.length === 0 || activeSources.includes(s)
          const color = SOURCE_COLOR[s]
          return (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className="tap-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={{
                borderColor: active ? color : 'transparent',
                backgroundColor: active ? `${color}1a` : 'transparent',
                color: active ? color : '#94a3b8',
                opacity: active ? 1 : 0.6,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {SOURCE_LABEL[s]}
              {counts[s] ? <span className="opacity-70">·{counts[s]}</span> : null}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer select-none">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-primary-600" />
          仅看未完成
        </label>
      </div>

      {/* 月导航 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })}
            className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors">‹</button>
          <button onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            className="tap-target px-3 h-9 rounded-lg bg-surface border border-hairline text-sm text-ink-2 hover:bg-canvas transition-colors">今天</button>
          <button onClick={() => setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })}
            className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors">›</button>
        </div>
        <h2 className="text-lg font-semibold text-ink">{cursor.year} 年 {cursor.month + 1} 月</h2>
        <div className="w-[140px]" />
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-ink-3 py-1">{w}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((d, i) => {
          const key = ymd(d)
          const dayEvents = monthEvents[key] || []
          const inMonth = isCurrentMonth(d)
          const isToday = ymd(d) === ymd(today)
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-lg border p-1.5 flex flex-col transition-colors ${
                isToday ? 'border-primary-600 bg-primary-50/40' : 'border-hairline bg-surface'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary-700' : 'text-ink-2'}`}>{d.getDate()}</div>
              <div className="space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => navigate(e.link)}
                    title={`${e.module} · ${e.title}`}
                    className="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 hover:brightness-95 transition"
                    style={{
                      backgroundColor: e.overdue ? '#fee2e2' : `${SOURCE_COLOR[e.source]}1a`,
                      color: e.overdue ? '#b91c1c' : SOURCE_COLOR[e.source],
                    }}
                  >
                    {e.overdue && <span className="text-[9px]">●</span>}
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-ink-3 px-1.5">+{dayEvents.length - 3} 更多</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <p className="text-center text-sm text-ink-3 mt-4">加载中…</p>}
      {!loading && events.length === 0 && (
        <p className="text-center text-sm text-ink-3 mt-6">本月暂无事件 🎉</p>
      )}
    </div>
  )
}
