// VisualKit —— 视觉打磨批次共享元素组件（proposal 元素层：图标容器 / 进度条 / 环形进度）
// 设计约束：全部走 index.css 设计令牌（rgb(var(--token))），亮/暗主题自动切换，
// 不写死任何 hex；尺寸档位固定，保证全站图标/进度视觉一致。

// 语义 tone → CSS 变量令牌（颜色通道，兼容透明度修饰符）
const TONE_VAR = {
  navy: 'var(--brand-navy)',
  primary: 'var(--color-primary)',
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  accent: 'var(--color-accent)',
  // 数据 6 色板（图表 / 状态点统一来源）
  d1: 'var(--data-1)',
  d2: 'var(--data-2)',
  d3: 'var(--data-3)',
  d4: 'var(--data-4)',
  d5: 'var(--data-5)',
  d6: 'var(--data-6)',
}

const SIZE_BOX = { sm: 28, md: 36, lg: 44, xl: 52 }
const SIZE_ICON = { sm: 15, md: 18, lg: 20, xl: 24 }
const SIZE_RADIUS = { sm: 8, md: 10, lg: 12, xl: 14 }

/**
 * IconBadge —— 统一的图标容器（圆角方块 + 语义色底 + 图标）
 * 解决散落 lucide 图标尺寸/颜色各写各的、没有容器的「随手丢」观感。
 * Usage: <IconBadge icon={Building2} tone="primary" size="md" />
 *        <IconBadge icon={CheckCircle2} tone="success" />
 */
export const IconBadge = ({ icon: Icon, tone = 'navy', size = 'md', className = '', style = {} }) => {
  const box = SIZE_BOX[size] ?? SIZE_BOX.md
  const ic = SIZE_ICON[size] ?? SIZE_ICON.md
  const radius = SIZE_RADIUS[size] ?? SIZE_RADIUS.md
  const token = TONE_VAR[tone] || TONE_VAR.navy
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: `rgb(${token} / 0.12)`,
        color: `rgb(${token})`,
        ...style,
      }}
      aria-hidden="true"
    >
      {Icon ? <Icon size={ic} strokeWidth={1.75} /> : null}
    </span>
  )
}

/**
 * ProgressBar —— 线形进度条（带语义色与可选标签）
 * Usage: <ProgressBar value={60} max={100} tone="success" showLabel />
 */
export const ProgressBar = ({ value = 0, max = 100, tone = 'primary', size = 'md', showLabel = false, label, className = '' }) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0
  const token = TONE_VAR[tone] || TONE_VAR.primary
  const h = size === 'sm' ? 6 : size === 'lg' ? 12 : 8
  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1 text-xs font-medium text-ink-2">
          <span>{label}</span>
          {showLabel && <span style={{ color: `rgb(${token})`, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: h, background: 'rgb(var(--subtle))' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: `rgb(${token})` }}
        />
      </div>
    </div>
  )
}

/**
 * ProgressRing —— 环形进度（SVG，带语义色与中心数值/标签）
 * Usage: <ProgressRing value={done} max={total} tone="success" label="完成度" sublabel={`${done}/${total}`} />
 */
export const ProgressRing = ({ value = 0, max = 100, tone = 'primary', size = 72, stroke = 8, label, sublabel, className = '' }) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const token = TONE_VAR[tone] || TONE_VAR.primary
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--subtle))" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={`rgb(${token})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: `rgb(${token})` }}>
          <span className="font-bold leading-none" style={{ fontSize: size * 0.26, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(pct)}%
          </span>
          {sublabel && <span className="text-[10px] text-ink-3 mt-0.5 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{sublabel}</span>}
        </div>
      </div>
      {label && <span className="mt-1.5 text-xs font-medium text-ink-2 text-center">{label}</span>}
    </div>
  )
}

export default { IconBadge, ProgressBar, ProgressRing }
