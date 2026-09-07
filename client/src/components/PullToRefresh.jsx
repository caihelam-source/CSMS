import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import { RefreshCw } from 'lucide-react'

// 移动端下拉刷新（Pull-to-Refresh）：视频核心 Web→App 控件翻译之一
// Web 用「点击按钮刷新」→ App 用「顶部下拉手势」。
// 采用 window 滚动场景：仅在 scrollY<=0 且向下拖时拦截默认滚动并展开指示器；
// 松手超过阈值触发 onRefresh，完成后回弹。桌面(lg+)与无 touch 环境直接透传 children。
const THRESHOLD = 64

export default function PullToRefresh({ onRefresh, children, threshold = THRESHOLD }) {
  const isMobile = useIsMobile()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!isMobile) return
    let startY = 0
    let pulling = false
    const onStart = (e) => {
      if (refreshingRef.current) return
      if (window.scrollY <= 0) { startY = e.touches[0].clientY; pulling = true }
    }
    const onMove = (e) => {
      if (!pulling || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { pulling = false; pullRef.current = 0; setPull(0); return }
      // 一旦页面已可滚动（scrollY>0），交还原生滚动，避免抢手势
      if (window.scrollY > 0) { pulling = false; pullRef.current = 0; setPull(0); return }
      e.preventDefault() // 仅在顶部且下拉时阻止默认滚动（passive:false 才生效）
      const dist = Math.min(dy * 0.5, threshold * 1.5) // 阻尼 0.5
      pullRef.current = dist
      setPull(dist)
    }
    const onEnd = async () => {
      if (!pulling) return
      pulling = false
      if (pullRef.current >= threshold) {
        refreshingRef.current = true
        setRefreshing(true)
        setPull(threshold)
        try { await onRefreshRef.current() }
        catch { /* 列表自身会 toast 错误，这里静默 */ }
        finally {
          refreshingRef.current = false
          setRefreshing(false)
          pullRef.current = 0
          setPull(0)
        }
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [isMobile, threshold])

  if (!isMobile) return <>{children}</>

  const armed = pull >= threshold
  return (
    <div
      style={{
        position: 'relative',
        transform: `translateY(${pull}px)`,
        transition: refreshing || pull === 0 ? 'transform var(--dur-base) var(--ease)' : 'none',
        willChange: 'transform',
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 shadow-sm ring-1 ring-hairline"
        style={{ top: `${-pull + 12}px`, opacity: Math.min(pull / threshold, 1) }}
        aria-hidden={refreshing ? undefined : true}
      >
        <RefreshCw
          size={14}
          className={refreshing ? 'animate-spin' : ''}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
        <span>{refreshing ? '刷新中…' : armed ? '松开刷新' : '下拉刷新'}</span>
      </div>
      {children}
    </div>
  )
}
