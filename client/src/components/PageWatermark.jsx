// PageWatermark — 底层品牌印章水印（系列设计）
// 只取 logo 母题的「局部」（圆形印章 + 对勾），不铺整图；
// 大号、低透明度、整页可见，按页面落不同角落，形成一套「系列」底层语言。
// 位置由 Layout 按路由分配：br 右下 / bl 左下 / tl 左上 / tr 右上 / lm 左中 / rm 右中
export default function PageWatermark({ position = 'br' }) {
  return (
    <div className={`page-watermark page-watermark--${position}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="3.5" />
        <path d="M32 17 A15 15 0 1 0 32 47" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <path d="M24 32 l5 5 l11 -12" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
