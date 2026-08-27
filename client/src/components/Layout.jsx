import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import Navbar from './Navbar'
import PageWatermark from './PageWatermark'

export default function Layout() {
  const { isDemoMode } = useAuth()
  const { pathname } = useLocation()
  const isDashboard = pathname === '/dashboard' || pathname === '/'
  // 底层水印系列：按路由分配角落（6 角轮回，同图异位形成系列）
  //  br 右下 · bl 左下 · tl 左上 · tr 右上 · lm 左中 · rm 右中
  const WATERMARK_POS = {
    '/dashboard': 'br',
    '/results-timetable': 'br',
    '/companies': 'bl',
    '/compliance-reminders': 'bl',
    '/personnel': 'tl',
    '/compliance-rules': 'tl',
    '/documents': 'tr',
    '/templates': 'tr',
    '/meetings': 'lm',
    '/sign-tasks': 'lm',
    '/tasks': 'rm',
    '/calendar': 'rm',
  }
  // 命中路由键 → 取其映射的落角值（br/bl/tl/tr/lm/rm），而非键本身
  const matchKey = Object.keys(WATERMARK_POS).find(p => pathname === p || pathname.startsWith(p + '/'))
  const watermarkPos = matchKey ? WATERMARK_POS[matchKey] : 'br'

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* 顶部水平导航栏：固定悬浮，内容区需让出顶部空间 */}
      <Navbar />

      {/* 全局「回到 Dashboard」快捷按钮（非 Dashboard 页面显示） */}
      {!isDashboard && (
        <Link
          to="/dashboard"
          className="fixed top-[92px] lg:top-[104px] left-4 lg:left-6 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-full shadow-md transition-colors"
          title="回到 Dashboard"
        >
          <LayoutDashboard size={14} /> 回到 Dashboard
        </Link>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-screen relative z-[1] pt-[132px] lg:pt-[124px]">
        {/* Demo mode banner — 仅 demo 模式展示 */}
        {isDemoMode && (
          <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 text-center text-sm text-warning">
            🎭 <strong>Demo Mode</strong> — No backend required. All features are interactive.
          </div>
        )}

        {/* Page content — pb-24 给手机端底部 Tab 栏留位（lg 以上无 Tab，恢复 pb-6）
            app-content：注册为容器查询上下文，让内部组件按「内容区真实宽度」而非视口宽度响应。 */}
        <main className="app-content flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          {/* Batch 04 · 设计语言：页面切换淡入（key=pathname 触发 remount + .page-fade 动画） */}
          <div key={pathname} className="page-fade">
            <Outlet />
          </div>
        </main>
      </div>

      {/* 底层品牌印章水印（系列：按路由落不同角落，见 components/PageWatermark.jsx） */}
      <PageWatermark position={watermarkPos} />
    </div>
  )
}
