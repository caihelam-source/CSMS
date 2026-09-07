import { useEffect, useState } from 'react';

// 视口断点（对齐 Tailwind：640 sm / 768 md / 1024 lg）
// 用途边界：
//   全局壳层（侧栏抽屉显隐、底部 Tab 是否启用）用视口断点——这些是页面级布局决策。
//   内容区内部布局优先用容器查询（.app-content 已注册 container-name: app），不依赖本 hook。
// rAF 节流 resize，避免拖拽窗口时高频重渲。
const QUERY = [
  { bp: 'sm', min: 0 },
  { bp: 'md', min: 640 },
  { bp: 'lg', min: 768 },
  { bp: 'xl', min: 1024 },
];

function resolve(width) {
  let current = 'sm';
  for (const q of QUERY) {
    if (width >= q.min) current = q.bp;
  }
  return current;
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() =>
    typeof window === 'undefined' ? 'lg' : resolve(window.innerWidth)
  );

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(resolve(window.innerWidth)));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return bp;
}

// 移动优先便捷判定：小屏（手机/小平板竖屏）启用底部 Tab 与触摸手势层。
export function useIsMobile() {
  const bp = useBreakpoint();
  return bp === 'sm' || bp === 'md';
}

export default useBreakpoint;
