// 翻页器（Pagination）— 长列表分页，当前页高亮 + 省略号跳转
// totalPages<=1 时自动不渲染；移动端同样可点（按钮 ≥36px 触控安全）
const cx = (...a) => a.filter(Boolean).join(' ')

export default function Pagination({ page, totalPages, onChange, siblingCount = 1, className = '' }) {
  if (totalPages <= 1) return null
  const total = totalPages
  const cur = Math.min(Math.max(page, 1), total)
  const pages = [1]
  const left = Math.max(2, cur - siblingCount)
  const right = Math.min(total - 1, cur + siblingCount)
  if (left > 2) pages.push('...')
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total - 1) pages.push('...')
  if (total > 1) pages.push(total)

  const btn = 'inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-lg text-sm font-medium transition-colors tap-target'
  return (
    <nav data-claw="pager" className={cx('flex items-center justify-center gap-1.5 flex-wrap', className)} aria-label="分页导航">
      <button className={cx(btn, 'text-ink-2 hover:bg-canvas disabled:opacity-40')} onClick={() => onChange(cur - 1)} disabled={cur <= 1} aria-label="上一页">‹</button>
      {pages.map((p, i) => p === '...'
        ? <span key={`e${i}`} className="px-1 text-ink-3 select-none" aria-hidden="true">…</span>
        : (
          <button key={p} className={cx(btn, p === cur ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-2 hover:bg-canvas')}
            onClick={() => onChange(p)} aria-current={p === cur ? 'page' : undefined}>
            {p}
          </button>
        ))}
      <button className={cx(btn, 'text-ink-2 hover:bg-canvas disabled:opacity-40')} onClick={() => onChange(cur + 1)} disabled={cur >= total} aria-label="下一页">›</button>
    </nav>
  )
}
