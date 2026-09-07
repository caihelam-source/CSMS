// 徽标（Badge）— 挂在图标/卡片右上角的小型状态标记
// 三种形态：① count 计数气泡（父级需 relative）② dot 状态点 ③ label 独立语义药丸
// 全部令牌驱动、暗色自动切换、移动端触控安全
const cx = (...a) => a.filter(Boolean).join(' ')

const TONE_SOLID = {
  primary: 'bg-primary-600', danger: 'bg-danger', warning: 'bg-warning',
  success: 'bg-success', info: 'bg-info', ink: 'bg-ink',
}
const TONE_SOFT = {
  primary: 'bg-primary-50 text-primary-700 dark:bg-primary-600/15 dark:text-primary-300',
  danger: 'bg-danger/10 text-danger', warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success', info: 'bg-info/10 text-info',
  ink: 'bg-canvas text-ink-2',
}

export default function Badge({ count, dot, label, tone = 'danger', max = 99, standalone = false, className = '' }) {
  if (label != null) {
    return (
      <span data-claw="badge" className={cx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold leading-none', TONE_SOFT[tone] || TONE_SOFT.danger, className)}>
        {label}
      </span>
    )
  }
  if (dot) {
    if (standalone) {
      return <span data-claw="badge" className={cx('inline-block w-2 h-2 rounded-full', TONE_SOLID[tone] || TONE_SOLID.danger, className)} />
    }
    return (
      <span data-claw="badge" aria-hidden="true" className={cx('absolute block w-2.5 h-2.5 rounded-full ring-2 ring-surface', TONE_SOLID[tone] || TONE_SOLID.danger, className)}
        style={{ top: -3, right: -3 }} />
    )
  }
  const num = Number(count) || 0
  const display = num > max ? `${max}+` : String(num)
  if (standalone) {
    return (
      <span data-claw="badge" className={cx('inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none text-white', TONE_SOLID[tone] || TONE_SOLID.danger, className)}>
        {display}
      </span>
    )
  }
  return (
    <span data-claw="badge" className={cx('absolute inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold leading-none text-white shadow-sm', TONE_SOLID[tone] || TONE_SOLID.danger, className)}
      style={{ top: -6, right: -6 }} aria-label={`${num} 条未读`}>
      {display}
    </span>
  )
}
