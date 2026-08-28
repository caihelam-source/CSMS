// 议程视图：按日期分组的 upcoming 列表（默认未来 90 天，由容器计算 from/to）。
import {
  SOURCE_COLOR, sourceColor, sourceColorAlpha, SOURCE_LABEL, isToday, applyOnlyOpen, groupByDay, WEEKDAYS,
} from './calendarConstants'

export default function AgendaView({ events, onlyOpen, onEventClick, rangeText }) {
  const sorted = applyOnlyOpen(events, onlyOpen)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const byDay = groupByDay(sorted)
  const days = Object.keys(byDay).sort()

  return (
    <div>
      <div className="mb-3 text-sm text-ink-2">{rangeText || '即将到来'}</div>
      {days.length === 0 && (
        <p className="text-center text-sm text-ink-3 mt-6">未来没有待办事件 🎉</p>
      )}
      <div className="space-y-4">
        {days.map((key) => {
          const dayEvents = byDay[key]
          const d = new Date(key)
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-ink">{key}</h3>
                <span className="text-xs text-ink-3">
                  {WEEKDAYS[d.getDay()]}
                  {isToday(d) ? ' · 今天' : ''}
                </span>
                <span className="text-xs text-ink-3 ml-auto">{dayEvents.length} 项</span>
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="w-full text-left rounded-lg border border-hairline px-3 py-2 hover:bg-canvas transition flex items-center gap-2"
                    style={{ backgroundColor: e.overdue ? 'rgb(var(--c-danger) / 0.12)' : sourceColorAlpha(e.source, 0.05) }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sourceColor(e.source) }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink font-medium truncate">{e.title}</div>
                      <div className="text-xs text-ink-3">
                        {SOURCE_LABEL[e.source] || e.source}
                        {e.time && !e.allDay ? ` · ${e.time}` : e.allDay ? ' · 全天' : ''}
                        {e.companyName ? ` · ${e.companyName}` : ''}
                      </div>
                    </div>
                    {e.overdue && <span className="text-[10px] text-danger shrink-0">逾期</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
