// 日视图：左侧时间轴（每小时一行），右侧事件块按 time 放置；allDay 事件置顶横条。
import {
  SOURCE_COLOR, SOURCE_LABEL, isToday, isSameDay, applyOnlyOpen, formatDateTitle,
} from './calendarConstants'

export default function DayView({
  cursor, events, onlyOpen, onEventClick, onPrev, onNext, onToday,
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
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="前一天">‹</button>
          <button onClick={onToday} className="tap-target px-3 h-9 rounded-lg bg-surface border border-hairline text-sm text-ink-2 hover:bg-canvas transition-colors">今天</button>
          <button onClick={onNext} className="tap-target w-9 h-9 rounded-lg bg-surface border border-hairline text-ink-2 hover:bg-canvas transition-colors" aria-label="后一天">›</button>
        </div>
        <h2 className="flex-1 min-w-0 text-center text-sm sm:text-lg font-semibold text-ink truncate">{formatDateTitle(cursor)}{isToday(cursor) ? ' · 今天' : ''}</h2>
      </div>

      {allDay.length > 0 && (
        <div className="mb-3 space-y-1">
          {allDay.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="w-full text-left rounded-lg border border-hairline px-3 py-2 text-sm hover:bg-canvas transition flex items-center gap-2"
              style={{ backgroundColor: `${SOURCE_COLOR[e.source] || '#94a3b8'}14` }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[e.source] || '#94a3b8' }} />
              <span className="text-[11px] font-medium" style={{ color: SOURCE_COLOR[e.source] }}>{SOURCE_LABEL[e.source] || e.source}</span>
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
                      backgroundColor: e.overdue ? '#fee2e2' : `${SOURCE_COLOR[e.source] || '#94a3b8'}1a`,
                      color: e.overdue ? '#b91c1c' : (SOURCE_COLOR[e.source] || '#475569'),
                    }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[e.source] || '#94a3b8' }} />
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
