// 月视图：6×7 网格（周日起始）。复用 DayEventsPopover 处理「+N 更多」溢出展开。
import {
  WEEKDAYS, SOURCE_COLOR, SOURCE_LABEL, ymd, isToday, groupByDay, applyOnlyOpen,
} from './calendarConstants'

export default function MonthGridView({
  cursor, events, onlyOpen, onEventClick, onMoreClick, onPrev, onNext, onToday,
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const startWeekday = first.getDay()
  const gridStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - startWeekday)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }
  const byDay = groupByDay(applyOnlyOpen(events, onlyOpen))
  const month = cursor.getMonth()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="上个月">‹</button>
          <button onClick={onToday} className="tap-target px-3 h-9 rounded-lg bg-surface border border-hairline text-sm text-ink-2 hover:bg-canvas transition-colors">今天</button>
          <button onClick={onNext} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="下个月">›</button>
        </div>
        <h2 className="text-lg font-semibold text-ink">{cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月</h2>
        <div className="w-[140px]" />
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-ink-3 py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          const dayEvents = byDay[ymd(d)] || []
          const inMonth = d.getMonth() === month
          const today = isToday(d)
          return (
            <div
              key={i}
              className={`min-h-[92px] rounded-lg border p-1.5 flex flex-col transition-colors ${
                today ? 'border-primary-600 bg-primary-50/40' : 'border-hairline bg-surface'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className={`text-xs font-medium mb-1 ${today ? 'text-primary-700' : 'text-ink-2'}`}>{d.getDate()}</div>
              <div className="space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    title={`${SOURCE_LABEL[e.source] || e.source} · ${e.title}`}
                    className="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 hover:brightness-95 transition"
                    style={{
                      backgroundColor: e.overdue ? '#fee2e2' : `${SOURCE_COLOR[e.source] || '#94a3b8'}1a`,
                      color: e.overdue ? '#b91c1c' : (SOURCE_COLOR[e.source] || '#475569'),
                    }}
                  >
                    {e.overdue && <span className="text-[9px]">●</span>}
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={() => onMoreClick(d, dayEvents)}
                    className="w-full text-left text-[10px] text-primary-600 px-1.5 hover:underline"
                    aria-label={`查看当天全部 ${dayEvents.length} 条事件`}
                  >
                    +{dayEvents.length - 3} 更多 ›
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
