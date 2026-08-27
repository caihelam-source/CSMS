import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()

  // ESC 关闭 + 打开时锁定滚动 + 焦点进出管理
  useEffect(() => {
    if (!isOpen) return
    previouslyFocused.current = document.activeElement

    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
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
  }, [isOpen, onClose])

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
  // 主内容区 <main> 已启用 container-type: inline-size（容器查询），若不 portal，
  // contain: layout 会让本弹层以 main 为定位基准，被侧栏挤偏、遮罩无法铺满视口。
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
        className={`relative w-full ${sizeClass} bg-surface rounded-2xl shadow-4 max-h-[90vh] flex flex-col outline-none`}
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
