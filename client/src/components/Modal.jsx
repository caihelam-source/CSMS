import { useEffect, useRef, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// 窄屏（≤640px）自动将居中对话框转为底部 Sheet，贴合移动端操作习惯
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()
  const isMobile = useIsMobile()

  // 把 onClose 放到 ref，effect 只依赖 isOpen。
  // 父组件若用 onClose={() => ...} 内联写法，每次渲染都是新引用；
  // 若把它放进 effect 依赖，会导致父组件任何 state 变更（含输入框 onChange）
  // 都重跑 effect，cleanup 把焦点夺回给 previouslyFocused 然后 body 再夺回，
  // iOS Safari 焦点/虚拟键盘抖动，输入框失焦"一点就跳出"。
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // 打开时锁定滚动 + 焦点进入；依赖仅 [isOpen]，避免父组件 re-render 触发
  useEffect(() => {
    if (!isOpen) return
    previouslyFocused.current = document.activeElement

    const handleEsc = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'

    // 初始焦点放入对话框（优先第一个可聚焦控件，否则对话框本身）
    const dialog = dialogRef.current
    if (dialog) {
      const focusable = dialog.querySelector('input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])')
      ;(focusable || dialog).focus()
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
        previouslyFocused.current.focus()
      }
    }
  }, [isOpen])

  // 焦点陷阱：Tab / Shift+Tab 在对话框内循环
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusables = dialogRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) { e.preventDefault(); return }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }

  if (!isOpen) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  }[size]

  // Portal 到 body：避免祖先的 contain / overflow / transform 劫持 fixed 定位。
  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${isMobile ? 'items-end justify-center' : 'items-center justify-center'} p-4`}>
      {/* Backdrop：navy 45% 遮罩（设计语言：mask navy45%） */}
      <div
        className="absolute inset-0 bg-[rgb(15_23_42/0.45)] backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className={
          isMobile
            ? `relative w-full ${sizeClass} bg-surface rounded-t-2xl shadow-4 max-h-[88vh] flex flex-col outline-none pb-safe`
            : `relative w-full ${sizeClass} bg-surface rounded-2xl shadow-4 max-h-[90vh] flex flex-col outline-none`
        }
        style={isMobile ? { animation: 'csSheetUp .24s cubic-bezier(.16,1,.3,1) both' } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭对话框"
            className="p-2 text-ink-3 hover:text-ink-2 hover:bg-canvas rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
