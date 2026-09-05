import { useRef, useState, useCallback } from 'react'

/**
 * RippleButton — 水波反馈按钮（技巧③）：点击涟漪从手指坐标扩散，而非固定控件中心。
 * 兼容全部 .btn-* 基类（传入 className 即可）。零业务逻辑，纯微交互增强。
 * 涟漪样式由 index.css 的 .animate-ripple（csRipple keyframes）驱动。
 */
export function RippleButton({ children, className = '', onClick, type = 'button', ...props }) {
  const [ripples, setRipples] = useState([])
  const ref = useRef(null)

  const handlePointerDown = useCallback((e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setRipples((r) => [...r, { id, x, y, size }])
    setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 620)
  }, [])

  return (
    <button
      ref={ref}
      type={type}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {ripples.map((p) => (
        <span
          key={p.id}
          className="animate-ripple absolute rounded-full bg-white/40"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
        />
      ))}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  )
}
