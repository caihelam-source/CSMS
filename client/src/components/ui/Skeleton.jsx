// 骨架屏（Skeleton）— 数据加载前用灰块撑起版面 + 微光扫过，防止布局跳动
// 提供 Skeleton(基础块) / SkeletonText(多行文本) / SkeletonCard(卡片) 三种预设
const cx = (...a) => a.filter(Boolean).join(' ')

export function Skeleton({ width, height, variant = 'rect', className = '', rounded }) {
  const v = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded-md' : (rounded || 'rounded-lg')
  const w = width || (variant === 'text' ? '100%' : undefined)
  const h = variant === 'text' && !height ? '0.875rem' : height
  return (
    <span data-claw="skeleton" aria-hidden="true" className={cx('skeleton block', v, className)} style={{ width: w, height: h }} />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div data-claw="skeleton" aria-hidden="true" className={cx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div data-claw="skeleton" aria-hidden="true" className={cx('border border-hairline rounded-xl bg-surface p-5 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="30%" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  )
}

export default Skeleton
