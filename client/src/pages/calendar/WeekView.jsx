// 周视图：7 列（周日起始）。全天事件置顶、时间排序；单格溢出「+N 更多」触发弹层。
import {
  WEEKDAYS, SOURCE_COLOR, sourceColor, sourceColorAlpha, ymd, isToday, startOfWeekSunday, addDays, groupByDay, applyOnlyOpen, sortDayEvents,
} from './calendarConstants'

export default function WeekView({
  cursor, events, onlyOpen, onEventClick, onMoreClick, onPrev, onNext, onToday,
}) {
  const weekStart = startOfWeekSunday(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDay = groupByDay(applyOnlyOpen(events, onlyOpen))

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="上周">‹</button>
          <button onClick={onToday} className="tap-target px-3 h-9 rounded-lg bg-surface border border-hairline text-sm text-ink-2 hover:bg-canvas transition-colors">今天</button>
          <button onClick={onNext} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="下周">›</button>
        </div>
        <h2 className="flex-1 min-w-0 text-center text-sm sm:text-lg font-semibold text-ink truncate">{ymd(weekStart)} ~ {ymd(addDays(weekStart, 6))}</h2>
      </div>

      <div className="overflow-x-auto sm:overflow-visible -mx-1 px-1">
        <div className="grid grid-cols-7 gap-1.5 min-w-[600px] sm:min-w-0">
        {days.map((d, i) => {
          const dayEvents = sortDayEvents(byDay[ymd(d)] || [])
          const today = isToday(d)
          return (
            <div
              key={i}
              className={`min-h-[320px] rounded-lg border flex flex-col ${
                today ? 'border-primary-600 bg-primary-50/30' : 'border-hairline bg-surface'
              }`}
            >
              <div className={`text-center py-1.5 border-b border-hairline ${today ? 'text-primary-700 font-semibold' : 'text-ink-2'}`}>
                <div className="text-[11px]">{WEEKDAYS[i]}</div>
                <div className="text-sm font-medium">{d.getDate()}</div>
              </div>
              <div className="p-1 space-y-1 overflow-y-auto flex-1">
                {dayEvents.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    title={`${e.title}${e.time ? ' ' + e.time : ''}`}
                    className="w-full text-left truncate rounded px-1.5 py-1 text-[11px] font-medium hover:brightness-95 transition"
                    style={{
                      backgroundColor: e.overdue ? 'rgb(var(--c-danger) / 0.12)' : sourceColorAlpha(e.source, 0.10),
                      color: e.overdue ? 'rgb(var(--c-danger))' : sourceColor(e.source),
                    }}
                  >
                    {e.time && !e.allDay ? `${e.time} ` : e.allDay ? '全天 ' : ''}{e.title}
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <button
                    onClick={() => onMoreClick(d, dayEvents)}
                    className="w-full text-left text-[10px] text-primary-600 px-1.5 hover:underline"
                    aria-label={`查看当天全部 ${dayEvents.length} 条事件`}
                  >
                    +{dayEvents.length - 4} 更多 ›
                  </button>
                )}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
