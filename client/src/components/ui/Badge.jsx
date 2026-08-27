/**
 * Badge — 语义色 pill 徽标（设计语言：pill + 语义色，12px 字阶）
 * 统一替代散落的 text-[10px]/状态块，全站复用 .badge 令牌类。
 */
const TONE = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  gray: 'badge-gray',
  accent: 'badge-accent',
}

const Badge = ({ tone = 'gray', dot = false, children, className = '' }) => (
  <span className={`badge ${TONE[tone] || 'badge-gray'} ${className}`}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />}
    {children}
  </span>
)

export default Badge
