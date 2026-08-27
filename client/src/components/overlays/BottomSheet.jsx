import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * BottomSheet — 移动端操作 / 筛选浮层（设计语言：手机端底部 Sheet）
 * 居中对话框在窄屏自动转为底部 Sheet（见 Modal.jsx 的 mobile 分支）。
 * 圆角 rounded-t-2xl(28px)，从底部滑入，背景 navy45% 遮罩。
 */
const BottomSheet = ({ isOpen, onClose, title, children }) => {
  const sheetRef = useRef(null)

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
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-[rgb(15_23_42/0.45)] backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg bg-surface rounded-t-2xl shadow-4 max-h-[88vh] flex flex-col outline-none pb-safe"
        style={{ animation: 'csSheetUp .24s cubic-bezier(.16,1,.3,1) both' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline shrink-0">
          <div className="w-9" />
          <h2 className="text-base font-semibold text-ink truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 -mr-2 text-ink-3 hover:text-ink-2 hover:bg-canvas rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default BottomSheet
