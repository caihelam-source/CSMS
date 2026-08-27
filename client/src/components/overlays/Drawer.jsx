import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Drawer — 右侧抽屉（详情 / 筛选 / 编辑）
 * 圆角 rounded-l-2xl(28px)，从右侧滑入，背景 navy45% 遮罩。
 * 操作型 Drawer（区别于顶部导航的移动抽屉），用于页面内详情/筛选。
 */
const Drawer = ({ isOpen, onClose, title, subtitle, children, width = 'max-w-md' }) => {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-[rgb(15_23_42/0.45)] backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} bg-surface rounded-l-2xl shadow-4 max-h-full flex flex-col outline-none`}
        style={{ animation: 'csDrawerIn .24s cubic-bezier(.16,1,.3,1) both' }}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-hairline shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink truncate">{title}</h2>
            {subtitle && <p className="text-sm text-ink-3 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 -mr-2 text-ink-3 hover:text-ink-2 hover:bg-canvas rounded-lg transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default Drawer
