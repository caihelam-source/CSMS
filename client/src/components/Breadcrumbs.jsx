import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * Breadcrumbs — 全局跨实体跳转契约组件（UX 重构 P0-2 / 修复 B2）
 *
 * items: Array<{ label: string, to?: string }>
 *  - 有 `to` 且非末项 → 可点击回跳（如 Companies、所属公司名）
 *  - 无 `to` 或为末项 → 当前页，不可点（aria-current="page"）
 *
 * 契约验收：从任意详情页，最多 2 次点击可回到其所属公司。
 * 例：`Companies / Acme Ltd / Meetings / Board 2026`
 */
export default function Breadcrumbs({ items = [], className = '' }) {
  if (!items || items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm text-ink-3 ${className}`}
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1
        const clickable = it.to && !isLast
        return (
          <Fragment key={`${it.label}-${i}`}>
            {i > 0 && (
              <ChevronRight size={14} className="text-ink-3/60 shrink-0" aria-hidden="true" />
            )}
            {clickable ? (
              <Link
                to={it.to}
                className="hover:text-ink hover:underline truncate max-w-[14rem] transition-colors"
              >
                {it.label}
              </Link>
            ) : (
              <span
                className={`truncate max-w-[16rem] ${isLast ? 'text-ink font-medium' : ''}`}
                aria-current={isLast ? 'page' : undefined}
              >
                {it.label}
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
