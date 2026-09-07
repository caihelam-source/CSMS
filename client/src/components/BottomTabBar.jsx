import { Link, useLocation } from 'react-router-dom'
import { Building2, UserCircle, FileText, Bell, Menu } from 'lucide-react'

// 第 0 步 · 移动外壳底部 Tab 栏（2026-09-07）
// 拇指可达的主导航：仅 4 个高频入口 + 更多（开现有抽屉）。
// ⚠️ 合规提醒（/compliance-reminders）必须是主 Tab —— 它是公司秘书每日核心，不能埋进抽屉。
// 桌面端（lg+）不渲染；移动端固定悬浮底部，<main> 已用 pb-24 预留空间。
const TABS = [
  { path: '/companies', icon: Building2, label: '公司' },
  { path: '/personnel', icon: UserCircle, label: '人员' },
  { path: '/documents', icon: FileText, label: '文档' },
  { path: '/compliance-reminders', icon: Bell, label: '提醒' },
]

export default function BottomTabBar() {
  const { pathname } = useLocation()
  const isActive = (p) => pathname === p || pathname.startsWith(p + '/')
  // 与 Navbar 现有移动抽屉解耦：派发自定义事件，Navbar 监听后打开同一抽屉
  const openMore = () => window.dispatchEvent(new CustomEvent('claw:open-mobile-nav'))

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-surface/98 dark:bg-surface/98 backdrop-blur-xl border-t border-hairline"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="主导航"
    >
      <div className="mx-auto max-w-[640px] grid grid-cols-5 min-h-16">
        {TABS.map((t) => {
          const active = isActive(t.path)
          return (
            <Link
              key={t.path}
              to={t.path}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-fast ${
                active ? 'text-primary-600' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <t.icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openMore}
          aria-label="更多"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors duration-fast"
        >
          <Menu size={22} strokeWidth={1.8} />
          <span>更多</span>
        </button>
      </div>
    </nav>
  )
}
