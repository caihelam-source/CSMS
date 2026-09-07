import { useRef, useState, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'

// 第 1 步 · 跨端左滑操作组件（2026-09-07）
// 视频核心交互「操作：hover 按钮 → 左滑/长按唤出」的工程实现。
// - 桌面（lg+）：行内常驻按钮，保持现状视觉，零行为变化。
// - 移动（<lg）：前景内容左滑，露出右侧 action tray（编辑/删除等），
//   热区 ≥44px；点击前景（已展开时）收起而非误触导航。
// - 同时消费 useIsMobile()，验证自适应地基 hook 真实生效。
// - 尊重 prefers-reduced-motion：关闭滑动过渡。
// - 可复用到 Personnel / Tasks 等虚拟化行列表（行高动态，translateX 不影响测量）。

const TRAY_BASE = 'flex items-center justify-center font-medium select-none text-white'

export default function SwipeRow({ actions = [], children, className = '', style, onLongPress }) {
  const isMobile = useIsMobile()
  const fgRef = useRef(null)
  const trayRef = useRef(null)
  const [x, setX] = useState(0)
  const [open, setOpen] = useState(false)
  const drag = useRef(null)
  const movedRef = useRef(false)
  const justSwipedRef = useRef(false)
  const longPressTimer = useRef(null)
  const longPressedRef = useRef(false)
  const [reduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }, [])

  // 桌面：行内常驻按钮（与改造前视觉一致）
  if (!isMobile) {
    return (
      <div style={style} className={`flex items-center justify-between ${className}`}>
        <div className="flex-1 min-w-0">{children}</div>
        <div className="flex gap-1 shrink-0">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              aria-label={a.label}
              className={`p-2 rounded-lg hover:bg-canvas ${a.tone === 'danger' ? 'text-ink-3 hover:text-danger' : 'text-ink-3 hover:text-primary-600'}`}
            >
              {a.icon && <a.icon size={14} />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const onPointerDown = (e) => {
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      locked: null,
      w: trayRef.current?.offsetWidth || actions.length * 44,
    }
    movedRef.current = false
    // 长按检测（仅移动端、未展开时）：按住 500ms 且未明显移动 → 进入选择态
    if (onLongPress && !open) {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null
        longPressedRef.current = true
        drag.current = null
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15)
        onLongPress(e)
      }, 500)
    }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    if (longPressTimer.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (drag.current.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      drag.current.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (drag.current.locked === 'x') e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (drag.current.locked !== 'x') return
    e.preventDefault()
    movedRef.current = true
    const w = drag.current.w
    const base = open ? -w : 0
    setX(Math.max(-w, Math.min(0, base + dx)))
  }
  const onPointerEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (!drag.current) return
    const w = drag.current.w
    const willOpen = x < -w / 2
    if (movedRef.current) {
      justSwipedRef.current = true
      setTimeout(() => { justSwipedRef.current = false }, 320)
    }
    setOpen(willOpen)
    setX(willOpen ? -w : 0)
    drag.current = null
  }
  const onFgClick = (e) => {
    // 长按已触发选择：吞掉随之而来的 click，避免误触导航
    if (longPressedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      longPressedRef.current = false
      return
    }
    // 已展开时，点前景 = 收起（不触发内部 Link 导航）
    if (open || justSwipedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setX(0)
    }
  }

  return (
    <div style={style} className={`relative overflow-hidden ${className}`}>
      {/* action tray（藏在前景之后，右对齐） */}
      <div ref={trayRef} className="absolute inset-y-0 right-0 flex" aria-hidden={!open}>
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            aria-label={a.label}
            className={`${TRAY_BASE} px-4 min-w-[44px] ${a.tone === 'danger' ? 'bg-danger' : 'bg-primary-600'}`}
            style={{ height: '100%' }}
          >
            {a.icon && <a.icon size={18} />}
          </button>
        ))}
      </div>
      {/* 前景内容：左滑露 tray */}
      <div
        ref={fgRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onFgClick}
        className="relative bg-surface h-full"
        style={{
          transform: `translateX(${x}px)`,
          transition: drag.current ? 'none' : `transform ${reduce ? '0ms' : '200ms'} var(--ease)`,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
