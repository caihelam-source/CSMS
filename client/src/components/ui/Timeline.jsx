// 时间轴（Timeline）— 按节点顺序串联发展历程 / 项目进度 / 截止先后
// 节点状态：done(已完成) current(进行中/高亮) upcoming(待办) alert(逾期)
// 左栏竖线 + 圆形节点，标题/日期/描述右栏；暗色自动切换
const cx = (...a) => a.filter(Boolean).join(' ')

const NODE = {
  done:     { ring: 'border-success bg-success', line: 'bg-success/30' },
  current:  { ring: 'border-primary-600 bg-primary-600 ring-4 ring-primary-600/20', line: 'bg-border' },
  upcoming: { ring: 'border-hairline bg-surface', line: 'bg-border' },
  alert:    { ring: 'border-danger bg-danger', line: 'bg-danger/30' },
}

export default function Timeline({ items = [], className = '' }) {
  return (
    <ol data-claw="timeline" className={cx('relative', className)}>
      {items.map((it, i) => {
        const st = NODE[it.status] || NODE.upcoming
        const last = i === items.length - 1
        const titleColor = it.status === 'alert' ? 'text-danger'
          : it.status === 'current' ? 'text-primary-700 dark:text-primary-300'
          : 'text-ink'
        return (
          <li key={it.key || i} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative flex flex-col items-center">
              <span className={cx('z-10 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', st.ring)}>
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </span>
              {!last && <span className={cx('absolute top-4 bottom-0 w-0.5', st.line)} />}
            </div>
            <div className="min-w-0 flex-1 -mt-0.5">
              <div className="flex items-center justify-between gap-3">
                <p className={cx('text-sm font-semibold', titleColor)}>{it.title}</p>
                {it.date && <span className="shrink-0 text-xs text-ink-3 tabular-nums">{it.date}</span>}
              </div>
              {it.description && <p className="text-sm text-ink-2 mt-0.5">{it.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
