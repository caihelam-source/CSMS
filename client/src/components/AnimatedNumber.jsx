import { useEffect, useRef, useState } from 'react'

/**
 * AnimatedNumber — 数字滚动（技巧⑦）：值变化时减速滚动到目标，避免突然刹停的生硬感。
 * easeOutCubic + requestAnimationFrame 驱动；首屏进入也会从 0 滚到目标值（载入即有动效）。
 */
export function AnimatedNumber({ value, duration = 800, className = '' }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = typeof value === 'number' ? value : 0
    if (from === to) {
      setDisplay(to)
      return
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic：先快后慢，自然刹停
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className}>{display}</span>
}
