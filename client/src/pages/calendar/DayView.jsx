// 日视图：左侧时间轴（每小时一行），右侧事件块按 time 放置；allDay 事件置顶横条。
import {
  sourceColor, sourceColorAlpha, SOURCE_LABEL, isSameDay, applyOnlyOpen,
} from './calendarConstants'

export default function DayView({
  cursor, events, onlyOpen, onEventClick,
}) {
  const list = applyOnlyOpen(events, onlyOpen).filter((e) => isSameDay(e.date, cursor))
  const allDay = list.filter((e) => e.allDay || !e.time)
  const timed = list
    .filter((e) => !e.allDay && e.time)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const eventsAtHour = (h) => timed.filter((e) => parseInt((e.time || '00:00').split(':')[0], 10) === h)

  return (
    <div>
      {allDay.length > 0 && (
        <div className="mb-3 space-y-1">
          {allDay.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="w-full text-left rounded-lg border border-hairline px-3 py-2 text-sm hover:bg-canvas transition flex items-center gap-2"
              style={{ backgroundColor: sourceColorAlpha(e.source, 0.08) }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sourceColor(e.source) }} />
              <span className="text-[11px] font-medium" style={{ color: sourceColor(e.source) }}>{SOURCE_LABEL[e.source] || e.source}</span>
              <span className="text-ink font-medium truncate min-w-0 flex-1">{e.title}</span>
              <span className="text-xs text-ink-3 ml-auto truncate max-w-[45%]">{e.companyName || '个人'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border border-hairline rounded-lg overflow-hidden">
        {hours.map((h) => {
          const evs = eventsAtHour(h)
          return (
            <div key={h} className="flex border-b border-hairline last:border-b-0 min-h-[52px]">
              <div className="w-16 shrink-0 text-right pr-2 py-1 text-xs text-ink-3 border-r border-hairline">
                {String(h).padStart(2, '0')}:00
              </div>
              <div className="flex-1 p-1 space-y-1">
                {evs.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="w-full text-left rounded px-2 py-1 text-[12px] font-medium hover:brightness-95 transition flex items-center gap-1"
                    style={{
                      backgroundColor: e.overdue ? 'rgb(var(--c-danger) / 0.12)' : sourceColorAlpha(e.source, 0.10),
                      color: e.overdue ? 'rgb(var(--c-danger))' : sourceColor(e.source),
                    }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sourceColor(e.source) }} />
                    <span className="truncate">{e.title}</span>
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
