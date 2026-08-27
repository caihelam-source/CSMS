import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Popover — 行内气泡菜单 / 上下文操作（设计语言：rounded-lg + s-2 阴影）
 * 点击触发元素展开一个定位浮层，点击外部或 ESC 关闭。
 * 用于表格行「更多操作」、筛选下拉等场景，替代散落的绝对定位菜单。
 */
const Popover = ({ trigger, children, align = 'right', className = '' }) => {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const wrapRef = useRef(null)
  const popRef = useRef(null)

  const place = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = align === 'right' ? r.right : r.left
    setCoords({ top: r.bottom + 6, left })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onScroll = () => setOpen(false)
    const onClick = (e) => {
      if (
        popRef.current && !popRef.current.contains(e.target) &&
        wrapRef.current && !wrapRef.current.contains(e.target)
      ) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <span ref={wrapRef} className="inline-flex" onClick={() => setOpen(o => !o)}>
        {trigger}
      </span>
      {open && createPortal(
        <div
          ref={popRef}
          role="menu"
          className={`fixed z-[70] min-w-[160px] bg-surface border border-hairline rounded-lg shadow-3 py-1.5 ${className}`}
          style={{ top: coords.top, left: coords.left, [align === 'right' ? 'transform' : 'transform']: align === 'right' ? 'translateX(-100%)' : 'none' }}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>,
        document.body,
      )}
    </>
  )
}

export default Popover
