import { X } from 'lucide-react'
import { useIsMobile } from '../hooks/useBreakpoint'

// 跨端批量操作底部 action sheet（2026-09-07）
// 视频核心交互「选择：Web 复选框 → App 长按进选择态 → 底部 action sheet」的工程实现。
// - 仅在移动端(<lg)且 count>0 时渲染；桌面端由各行内/顶部按钮处理，此处返回 null。
// - 固定悬浮于底部 Tab 之上（bottom = 4rem + 安全区），不遮挡导航；热区 ≥44px。
// - 挂既有 Lumina 令牌（bg-surface/border-hairline/text-ink-2 等），消费 useIsMobile() 与自适应地基联动。
// - 可复用到 Personnel / Companies / Documents / Tasks 等任意「多选 + 批量操作」列表。

export default function SelectionBar({ count = 0, actions = [], onCancel }) {
  const isMobile = useIsMobile()
  if (!isMobile || count === 0) return null

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-center gap-3 px-4 py-3 bg-surface/95 backdrop-blur border-t border-hairline shadow-[0_-2px_8px_rgba(15,42,94,0.08)]"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      role="toolbar"
      aria-label={`已选 ${count} 项`}
    >
      <span className="text-sm font-semibold text-ink-2 shrink-0">{count} 已选</span>
      <div className="flex-1 flex justify-end items-center gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            aria-label={a.label}
            className={`flex items-center gap-1.5 px-4 rounded-lg text-sm font-medium min-h-[44px] ${
              a.tone === 'danger'
                ? 'bg-danger/10 text-danger'
                : a.tone === 'primary'
                ? 'bg-primary-600 text-white'
                : 'bg-canvas text-ink-2'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform`}
          >
            {a.icon && <a.icon size={16} />}
            {a.label}
          </button>
        ))}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="取消选择"
            className="flex items-center justify-center w-11 h-11 rounded-lg bg-canvas text-ink-3 min-h-[44px] active:scale-[0.98] transition-transform"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
