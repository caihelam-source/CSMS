/**
 * ListRow — 统一列表行（设计语言：rounded-md + hover 态）
 * 替代文档页 / 设置页中样式不一的列表行。
 */
const ListRow = ({ icon: Icon, title, subtitle, trailing, onClick, active = false, className = '' }) => {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
        onClick ? 'cursor-pointer ' : ''
      }${active ? 'bg-primary-50 text-primary-700' : 'text-ink-2 hover:bg-canvas hover:text-ink'} ${className}`}
    >
      {Icon && <Icon className="shrink-0" size={18} />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-xs text-ink-3 truncate">{subtitle}</div>}
      </div>
      {trailing}
    </Comp>
  )
}

export default ListRow
