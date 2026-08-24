import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import Navbar from './Navbar'

export default function Layout() {
  const { isDemoMode } = useAuth()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — uses shared Navbar component with grouped nav, admin section, demo badge */}
      <Navbar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Demo mode banner — 仅 demo 模式展示 */}
        {isDemoMode && (
          <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 text-center text-sm text-warning">
            🎭 <strong>Demo Mode</strong> — No backend required. All features are interactive.
          </div>
        )}

        {/* Page content — pb-24 给手机端底部 Tab 栏留位（lg 以上无 Tab，恢复 pb-6）
            app-content：注册为容器查询上下文，让内部组件按「内容区真实宽度」而非视口宽度响应。
            侧栏 lg 以上占位 256px，视口断点会误判中等宽度屏幕，故统一改用 @container app。 */}
        <main className="app-content flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
