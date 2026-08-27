/**
 * Segmented — iOS 风格分段控件（设计语言：底槽浅灰圆角，选中项白底 + 投影 + 蓝字）
 * 用于时间范围 / 视图切换 / 筛选分组。
 */
const Segmented = ({ options, value, onChange, className = '' }) => (
  <div
    role="tablist"
    className={`inline-flex p-1 bg-canvas rounded-full gap-1 ${className}`}
  >
    {options.map((opt) => {
      const active = value === opt.value
      return (
        <button
          key={opt.value}
          role="tab"
          aria-selected={active}
          onClick={() => onChange?.(opt.value)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active
              ? 'bg-surface shadow-2 text-primary-700'
              : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
)

export default Segmented
