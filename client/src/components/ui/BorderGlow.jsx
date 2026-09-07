// 边框流光（BorderGlow）— 一道沿边缘循环流动的光线，突出特定卡片
// 适合会员专区 / 重点公告 / 紧急合规。tone 控制光色；reduced-motion 下转静态描边
const cx = (...a) => a.filter(Boolean).join(' ')

const TONE = {
  primary: 'rgb(var(--color-primary))',
  danger: 'rgb(var(--c-danger))',
  warning: 'rgb(var(--c-warning))',
  success: 'rgb(var(--c-success))',
  info: 'rgb(var(--c-info))',
}

export default function BorderGlow({ tone = 'primary', children, className = '', rounded, as: Tag = 'div' }) {
  return (
    <Tag data-claw="glow" className={cx('border-glow', className)}
      style={{ '--glow-tone': TONE[tone] || TONE.primary, '--glow-radius': rounded || 'var(--radius-xl)' }}>
      {children}
    </Tag>
  )
}
