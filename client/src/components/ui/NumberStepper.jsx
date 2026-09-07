// 数字输入框（NumberStepper）— 加减步进按钮 + 直接键入 + 滚轮选择
// 适合购买数量、尺寸、提前天数等数值场景；移动端按钮 ≥44px 触控安全
import { useEffect, useRef } from 'react'

const cx = (...a) => a.filter(Boolean).join(' ')

export default function NumberStepper({
  value, onChange, min, max, step = 1, precision = 0, disabled = false,
  suffix, label, size = 'md', className = '', id,
}) {
  const inputRef = useRef(null)
  const clamp = (n) => {
    let v = n
    if (precision > 0) v = Math.round(v * 10 ** precision) / 10 ** precision
    if (typeof min === 'number') v = Math.max(min, v)
    if (typeof max === 'number') v = Math.min(max, v)
    return v
  }
  const set = (n) => { if (Number.isNaN(n)) return; onChange(clamp(n)) }
  const dec = () => set((Number(value) || 0) - step)
  const inc = () => set((Number(value) || 0) + step)

  // 滚轮选择：仅当输入框聚焦时拦截滚动并步进，避免吞掉页面滚动
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onWheel = (e) => {
      if (document.activeElement !== el) return
      e.preventDefault()
      set((Number(value) || 0) + (e.deltaY < 0 ? step : -step))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value, step, min, max])

  const btn = 'shrink-0 inline-flex items-center justify-center text-ink-2 hover:text-ink hover:bg-canvas disabled:opacity-40 disabled:pointer-events-none transition-colors'
  const dim = size === 'sm' ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'
  return (
    <div data-claw="stepper" role="group" aria-label={label}
      className={cx('inline-flex items-stretch rounded-lg border border-hairline bg-surface overflow-hidden', disabled && 'opacity-60', className)}>
      <button type="button" className={cx(btn, dim, 'tap-target')} onClick={dec} disabled={disabled} aria-label="减少" tabIndex={-1}>
        <span aria-hidden="true">−</span>
      </button>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        className="w-14 text-center bg-transparent border-x border-hairline outline-none font-semibold text-ink tabular-nums focus:bg-canvas/60"
        value={value ?? ''}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.-]/g, '')
          if (raw === '' || raw === '-' || raw === '.') { onChange(raw); return }
          set(Number(raw))
        }}
        onBlur={(e) => { const n = Number(e.target.value); onChange(Number.isNaN(n) ? (min ?? 0) : clamp(n)) }}
      />
      {suffix && <span className="inline-flex items-center px-1.5 text-sm text-ink-3 select-none">{suffix}</span>}
      <button type="button" className={cx(btn, dim, 'tap-target')} onClick={inc} disabled={disabled} aria-label="增加" tabIndex={-1}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
