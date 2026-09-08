// 走马灯（Carousel）— 环形排列多张横幅，定时自动轮播 + 指示点 + 箭头手动控制
// 适合首页活动推广 / 公告 / 商品图集；悬停暂停、reduced-motion 关闭自动播放
import { useEffect, useRef, useState } from 'react'

const cx = (...a) => a.filter(Boolean).join(' ')

export default function Carousel({ items = [], autoPlay = 5000, showDots = true, showArrows = true, className = '', aspect = 'aspect-[5/3] md:aspect-[16/9]', compact = false }) {
  const [index, setIndex] = useState(0)
  const n = items.length
  const pauseRef = useRef(false)
  const go = (i) => setIndex((i + n) % n)

  useEffect(() => {
    if (!autoPlay || n <= 1) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => { if (!pauseRef.current) setIndex(p => (p + 1) % n) }, autoPlay)
    return () => clearInterval(t)
  }, [autoPlay, n])

  if (n === 0) return null
  return (
    <div data-claw="carousel" role="region" aria-roledescription="carousel" aria-label="轮播公告"
      className={cx('relative rounded-xl overflow-hidden border border-hairline', aspect, className)}
      onMouseEnter={() => { pauseRef.current = true }}
      onMouseLeave={() => { pauseRef.current = false }}>
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((it, i) => (
          <div key={i} aria-hidden={i !== index} className="relative w-full h-full shrink-0"
            style={{ background: it.bg || 'linear-gradient(135deg, rgb(var(--brand-navy)), rgb(var(--blue-600)))' }}>
            {it.image && <img src={it.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className={cx('absolute inset-0 flex flex-col justify-center text-white', compact ? 'gap-0.5 p-2.5 md:p-4' : 'gap-2 p-6 md:p-10')}>
              {it.eyebrow && <span className={cx('font-bold tracking-widest uppercase opacity-80', compact ? 'text-[9px] md:text-[10px]' : 'text-xs')}>{it.eyebrow}</span>}
              {it.title && <h3 className={cx('font-bold max-w-xl leading-tight', compact ? 'text-sm md:text-base' : 'text-xl md:text-2xl')}>{it.title}</h3>}
              {it.subtitle && <p className={cx('opacity-90 max-w-xl leading-snug', compact ? 'text-[10px] md:text-xs line-clamp-1' : 'text-sm md:text-base line-clamp-2')}>{it.subtitle}</p>}
              {it.actionHref && it.actionLabel && (
                <a href={it.actionHref} className="mt-2 inline-flex w-fit items-center gap-2 px-4 py-2 rounded-full bg-white font-semibold text-sm hover:scale-[1.03] transition-transform"
                  style={{ color: 'rgb(var(--brand-navy))' }}>{it.actionLabel}</a>
              )}
            </div>
          </div>
        ))}
      </div>
      {showArrows && n > 1 && (
        <>
          <button onClick={() => go(index - 1)} aria-label="上一张" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur transition-colors tap-target">
            <span aria-hidden="true">‹</span>
          </button>
          <button onClick={() => go(index + 1)} aria-label="下一张" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur transition-colors tap-target">
            <span aria-hidden="true">›</span>
          </button>
        </>
      )}
      {showDots && n > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {items.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} aria-label={`第 ${i + 1} 张`}
              className={cx('h-2 rounded-full transition-all', i === index ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80')} />
          ))}
        </div>
      )}
    </div>
  )
}
