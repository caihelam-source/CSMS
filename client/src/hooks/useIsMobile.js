// useIsMobile — 响应式断点 hook（同步、SSR 安全、零依赖）
// 用法：const isMobile = useIsMobile()   // 默认 < 768px 视为移动端
//      const isMobile = useIsMobile(1024) // 自定义断点
//
// 监听 window.matchMedia，断点变化即时重渲染；卸载时自动 removeEventListener。
// 服务器端渲染时返回 false（按"先桌面后降级"原则），避免 hydration mismatch。
import { useEffect, useState } from 'react'

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`)
    const onChange = (e) => setIsMobile(e.matches)
    // matchMedia 旧 API 走 addListener，新 API 走 addEventListener；兼容 Safari < 14
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    // 同步一次（防止挂载前窗口尺寸与初始 state 不一致）
    setIsMobile(mql.matches)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [breakpoint])

  return isMobile
}
