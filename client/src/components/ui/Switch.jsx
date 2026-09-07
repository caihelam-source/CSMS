// 开关（Switch）— 带弹性滑块的开关控件，实现开/关瞬间切换
// API 与 UIHelpers 的 Toggle 完全一致（checked/onChange/label/className），可直接替换
// 关态中性灰、开态品牌蓝；整控件触控安全（tap-target）
const cx = (...a) => a.filter(Boolean).join(' ')

export default function Switch({ checked = false, onChange, disabled = false, size = 'md', label, id, className = '' }) {
  const track = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6'
  const thumb = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  const on = size === 'sm' ? 'translate-x-4' : 'translate-x-5'
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-claw="switch"
      onClick={() => !disabled && onChange?.(!checked)}
      className={cx('relative inline-flex items-center tap-target shrink-0 rounded-full transition-colors duration-200',
        track,
        checked ? 'bg-primary-600' : 'bg-ink-3/40',
        disabled && 'opacity-40 cursor-not-allowed', className)}
    >
      <span className={cx('absolute left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200', thumb, checked ? on : 'translate-x-0')}
        style={{ transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)' }} />
    </button>
  )
}
