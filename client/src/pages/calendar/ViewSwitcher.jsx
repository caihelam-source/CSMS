// 四视图切换器（月 / 周 / 日 / 议程）
import { VIEW_TYPES } from './calendarConstants'

export default function ViewSwitcher({ view, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-surface border border-hairline p-0.5">
      {VIEW_TYPES.map((v) => (
        <button
          key={v.key}
          onClick={() => onChange(v.key)}
          aria-pressed={view === v.key}
          className={`tap-target px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === v.key
              ? 'bg-primary-600 text-white'
              : 'text-ink-2 hover:bg-canvas'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
