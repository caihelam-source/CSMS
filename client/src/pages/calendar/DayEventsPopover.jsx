// 当天全量事件弹层：四视图共用。
// 列出当天所有事件（标题/来源/公司/状态），可点击钻取：
//   系统事件（link≠''）跳转原模块；自建事件（source='user_event'）打开编辑。
import { useEffect } from 'react'
import { SOURCE_COLOR, SOURCE_LABEL, formatDateTitle, WEEKDAYS } from './calendarConstants'

export default function DayEventsPopover({ open, date, events, onClose, onEventClick }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const d = date ? new Date(date) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface shadow-3 border border-hairline max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <h3 className="font-semibold text-ink">
            {d ? `${formatDateTitle(d)} ${WEEKDAYS[d.getDay()]}` : ''} · 当日事件（{events.length}）
          </h3>
          <button
            onClick={onClose}
            className="tap-target w-8 h-8 rounded-lg text-ink-3 hover:bg-canvas transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2">
          {events.length === 0 && <p className="text-center text-sm text-ink-3 py-6">当日暂无事件</p>}
          {events.map((e) => {
            const color = SOURCE_COLOR[e.source] || '#94a3b8'
            return (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className="w-full text-left rounded-lg border border-hairline p-3 hover:bg-canvas transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[11px] font-medium" style={{ color }}>
                    {SOURCE_LABEL[e.source] || e.source}
                  </span>
                  {e.overdue && <span className="text-[10px] text-danger">逾期</span>}
                </div>
                <div className="text-sm text-ink font-medium truncate">{e.title}</div>
                <div className="text-xs text-ink-3 mt-0.5">
                  {e.time ? `${e.time} · ` : e.allDay ? '全天 · ' : ''}
                  {e.companyName || '个人事件'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
