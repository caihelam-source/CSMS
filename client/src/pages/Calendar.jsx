import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarService, companyService } from '../services/index.js'
import { toArray } from '../utils/responseNormalize.js'
import {
  SOURCE_COLOR, sourceColor, sourceColorAlpha, SOURCE_LABEL, ALL_SOURCES,
  ymd, startOfMonth, endOfMonth, startOfWeekSunday, endOfWeekSaturday,
  startOfDay, endOfDay, addDays, addMonths, formatMonthTitle, formatWeekRange, formatDateTitle,
} from './calendar/calendarConstants'
import { useCalendarEvents } from './calendar/useCalendarEvents'
import ViewSwitcher from './calendar/ViewSwitcher'
import MonthGridView from './calendar/MonthGridView'
import WeekView from './calendar/WeekView'
import DayView from './calendar/DayView'
import AgendaView from './calendar/AgendaView'
import DayEventsPopover from './calendar/DayEventsPopover'
import EventFormModal from './calendar/EventFormModal'
import { ErrorState, EmptyState } from './calendar/StatusComponents'

const AGENDA_DAYS = 90

export default function Calendar() {
  const navigate = useNavigate()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [activeSources, setActiveSources] = useState([]) // 空 = 全部
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [digestState, setDigestState] = useState(null) // {type:'info'|'ok'|'warn', text}
  const [popover, setPopover] = useState({ open: false, date: null, events: [] })
  const [form, setForm] = useState({ open: false, initial: null, submitting: false })
  const [companies, setCompanies] = useState([])

  const { events, loading, error, load, createEvent, updateEvent, deleteEvent } = useCalendarEvents()

  // 按当前视图计算请求区间（四视图复用同一 GET /api/calendar/events）
  const range = useMemo(() => {
    if (view === 'month') return { from: ymd(startOfMonth(cursor)), to: ymd(endOfMonth(cursor)) }
    if (view === 'week') return { from: ymd(startOfWeekSunday(cursor)), to: ymd(endOfWeekSaturday(cursor)) }
    if (view === 'day') return { from: ymd(startOfDay(cursor)), to: ymd(endOfDay(cursor)) }
    // 议程：未来 90 天 upcoming（默认从 cursor 起）
    return { from: ymd(cursor), to: ymd(addDays(cursor, AGENDA_DAYS)) }
  }, [view, cursor])

  useEffect(() => {
    load(range.from, range.to, activeSources)
  }, [range.from, range.to, activeSources, load])

  // 关联公司下拉数据（scope 内公司）
  useEffect(() => {
    companyService
      .getAll()
      .then((res) => {
        const list = toArray(res?.data?.data, 'companies', 'company', 'data')
        setCompanies(list.map((c) => ({ id: c._id || c.id, name: c.name })))
      })
      .catch(() => {})
  }, [])

  const counts = useMemo(() => {
    const c = {}
    for (const e of events) c[e.source] = (c[e.source] || 0) + 1
    return c
  }, [events])

  const overdueCount = events.filter((e) => e.overdue).length

  // ── 事件点击：自建事件打开编辑；系统事件跳原模块 ──
  const handleEventClick = useCallback(
    (e) => {
      if (e.source === 'user_event' || !e.link) {
        setForm({ open: true, initial: e, submitting: false })
      } else {
        navigate(e.link)
      }
    },
    [navigate],
  )

  const openMore = useCallback((date, dayEvents) => {
    setPopover({ open: true, date, events: dayEvents })
  }, [])

  // ── 导航（随视图语义变化）──
  const goPrev = () => {
    if (view === 'month') setCursor((c) => addMonths(c, -1))
    else if (view === 'week') setCursor((c) => addDays(c, -7))
    else if (view === 'day') setCursor((c) => addDays(c, -1))
    else setCursor((c) => addDays(c, -AGENDA_DAYS))
  }
  const goNext = () => {
    if (view === 'month') setCursor((c) => addMonths(c, 1))
    else if (view === 'week') setCursor((c) => addDays(c, 7))
    else if (view === 'day') setCursor((c) => addDays(c, 1))
    else setCursor((c) => addDays(c, AGENDA_DAYS))
  }
  const goToday = () => setCursor(new Date())

  const toggleSource = (s) => {
    setActiveSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
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

  // ── 自建事件 CRUD ──
  const reload = useCallback(() => load(range.from, range.to, activeSources), [range, activeSources, load])

  const handleFormSubmit = async (payload) => {
    setForm((f) => ({ ...f, submitting: true }))
    try {
      if (form.initial?.id) await updateEvent(form.initial.id, payload)
      else await createEvent(payload)
      setForm({ open: false, initial: null, submitting: false })
      await reload()
    } catch (e) {
      setForm((f) => ({ ...f, submitting: false }))
      window.alert('保存失败：' + (e?.message || e))
    }
  }

  const handleFormDelete = async (ev) => {
    if (!window.confirm(`确认删除事件「${ev.title}」？`)) return
    setForm((f) => ({ ...f, submitting: true }))
    try {
      await deleteEvent(ev.id)
      setForm({ open: false, initial: null, submitting: false })
      await reload()
    } catch (e) {
      setForm((f) => ({ ...f, submitting: false }))
      window.alert('删除失败：' + (e?.message || e))
    }
  }

  const openNew = () => setForm({ open: true, initial: null, submitting: false })
  const closeForm = () => setForm({ open: false, initial: null, submitting: false })

  const emptyText = useMemo(() => {
    if (view === 'month') return '本月暂无事件 🎉'
    if (view === 'week') return '本周暂无事件 🎉'
    if (view === 'day') return '当日暂无事件 🎉'
    return '未来没有待办事件 🎉'
  }, [view])

  const agendaRangeText = useMemo(
    () => (view === 'agenda' ? `未来 ${AGENDA_DAYS} 天（${formatDateTitle(cursor)} 起）` : ''),
    [view, cursor],
  )

  const title = useMemo(() => {
    if (view === 'month') return formatMonthTitle(cursor)
    if (view === 'week') return formatWeekRange(cursor)
    if (view === 'day') return formatDateTitle(cursor)
    return ''
  }, [view, cursor])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* PageHeader */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink">日历</h1>
          <p className="text-sm text-ink-3 mt-1">
            跨模块聚合 · 当前 {events.length} 项
            {overdueCount > 0 && <span className="text-danger font-medium">（逾期 {overdueCount} 项）</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sendDigest}
            className="tap-target px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            发送本月摘要
          </button>
          <button
            onClick={openNew}
            className="tap-target px-3 py-2 rounded-lg bg-surface border border-hairline text-ink-2 text-sm font-medium hover:bg-canvas transition-colors"
          >
            + 新建
          </button>
        </div>
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

      {/* 控制栏：视图切换 + 导航 + 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <ViewSwitcher view={view} onChange={setView} />
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="上一个区间">‹</button>
          <button onClick={goToday} className="tap-target px-3 h-9 rounded-lg bg-surface border border-hairline text-sm text-ink-2 hover:bg-canvas transition-colors">今天</button>
          <button onClick={goNext} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="下一个区间">›</button>
        </div>
        {title && <h2 className="text-lg font-semibold text-ink hidden sm:block">{title}</h2>}
      </div>

      {/* 过滤器（四视图共用） */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ALL_SOURCES.map((s) => {
          const active = activeSources.length === 0 || activeSources.includes(s)
          const color = sourceColor(s)
          return (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className="tap-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={{
                borderColor: active ? color : 'transparent',
                backgroundColor: active ? sourceColorAlpha(s, 0.10) : 'transparent',
                color: active ? color : 'rgb(var(--text-3))',
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

      {/* 视图内容 / 状态 */}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          {view === 'month' && (
            <MonthGridView
              cursor={cursor}
              events={events}
              onlyOpen={onlyOpen}
              onEventClick={handleEventClick}
              onMoreClick={openMore}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
            />
          )}
          {view === 'week' && (
            <WeekView
              cursor={cursor}
              events={events}
              onlyOpen={onlyOpen}
              onEventClick={handleEventClick}
              onMoreClick={openMore}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
            />
          )}
          {view === 'day' && (
            <DayView
              cursor={cursor}
              events={events}
              onlyOpen={onlyOpen}
              onEventClick={handleEventClick}
              onMoreClick={openMore}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              events={events}
              onlyOpen={onlyOpen}
              onEventClick={handleEventClick}
              rangeText={agendaRangeText}
            />
          )}

          {loading && <p className="text-center text-sm text-ink-3 mt-4">加载中…</p>}
          {!loading && events.length === 0 && <EmptyState text={emptyText} />}
        </>
      )}

      {/* 当天事件弹层（四视图共用） */}
      <DayEventsPopover
        open={popover.open}
        date={popover.date}
        events={popover.events}
        onClose={() => setPopover((p) => ({ ...p, open: false }))}
        onEventClick={handleEventClick}
      />

      {/* 新建 / 编辑事件表单 */}
      <EventFormModal
        open={form.open}
        initial={form.initial}
        companies={companies}
        submitting={form.submitting}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        onDelete={handleFormDelete}
      />
    </div>
  )
}
