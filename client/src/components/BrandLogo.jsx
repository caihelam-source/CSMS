// BrandLogo — 单一品牌组件（DESIGN.md §7 事实源）
// 所有页面 Logo 统一引用，杜绝三处不一致。
// variant:
//   'full'      → 横版主 Logo（印章图标 + CSMS 字标 + 双语副标题），见 public/logo-full.svg
//   'wordmark'  → 纯 CSMS 字标（无图标），用于 banner 等已含印章图标的场景；颜色继承父级
//   'icon'      → 印章图标（深蓝方底 + 白描边印章），见 public/icon.svg
//   'reversed'  → 反白版（深蓝卡底 + 白字），用于深蓝/深色区域，见 public/logo-reversed.svg
// size: 'sm' | 'md' | 'lg'

// logo-full.svg viewBox 400×64（宽高比 6.25）；高度驱动，宽度自适应
const FULL_HEIGHT = { sm: 26, md: 34, lg: 56 }
// icon.svg viewBox 64×64（正方形）
const ICON_PX = { sm: 28, md: 32, lg: 56 }
// 纯字标字号（px）
const WORDMARK_SIZE = { sm: 20, md: 26, lg: 40 }

export default function BrandLogo({ variant = 'full', size = 'md', className = '', ...rest }) {
  if (variant === 'icon') {
    const px = ICON_PX[size] ?? 32
    return (
      <img
        src="/icon.svg"
        alt="CSMS"
        width={px}
        height={px}
        className={className}
        style={{ width: px, height: px, display: 'block' }}
        {...rest}
      />
    )
  }
  if (variant === 'wordmark') {
    const fs = WORDMARK_SIZE[size] ?? 26
    return (
      <span
        className={`brand-logo-wordmark ${className}`}
        style={{
          fontSize: fs,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          display: 'inline-block',
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
        }}
        {...rest}
      >
        CSMS
      </span>
    )
  }
  const h = FULL_HEIGHT[size] ?? 34
  const src = variant === 'reversed' ? '/logo-reversed.svg' : '/logo-full.svg'
  return (
    <img
      src={src}
      alt="CSMS · 香港公司秘书管理系统"
      height={h}
      className={className}
      style={{ height: h, width: 'auto', display: 'block' }}
      {...rest}
    />
  )
}
