import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import {
  LayoutDashboard, Calendar, FileText, Building2,
  CheckSquare, LogOut, X, Crown, Zap,
  Bell, ShieldCheck, FileCode, UserCircle, Settings as SettingsIcon,
  Sun, Moon, FileSignature, CalendarClock, CalendarDays,
  Search,
} from 'lucide-react'
import { useState, memo, useEffect } from 'react'
import GlobalSearch from './GlobalSearch'
import CommandPalette from './CommandPalette'
import BrandLogo from './BrandLogo'
import { useScope } from '../hooks/useScope'
import { MOCK_DEMO_ACCOUNTS } from '../services/mock.js'

// UX 架构：顶部水平导航（2026-08-27）
// 左侧 Logo，中间一级导航，右侧搜索/主题/用户。
// 移动端：汉堡菜单展开为右侧抽屉，内部复用分组导航与全局搜索。
// 分组顺序（CommandPalette 仍复用）
export const NAV_GROUPS = [
  { key: 'Command',    label: null },
  { key: 'Operations', label: '业务' },
  { key: 'Compliance', label: '合规' },
  { key: 'Library',    label: '资料库' },
  { key: 'System',     label: '系统' },
]

export const NAV_ITEMS = [
  { path: '/dashboard',     icon: LayoutDashboard, label: '仪表板',  group: 'Command' },
  { path: '/calendar',      icon: CalendarDays,    label: '日历',   group: 'Command' },
  { path: '/companies',     icon: Building2,       label: '公司',  group: 'Command' },
  { path: '/personnel',     icon: UserCircle,      label: '人员',  group: 'Command' },
  { path: '/documents',     icon: FileText,        label: '文档',  group: 'Operations' },
  { path: '/meetings',      icon: Calendar,        label: '会议',   group: 'Operations' },
  { path: '/tasks',         icon: CheckSquare,     label: '任务',  group: 'Operations' },
  { path: '/sign-tasks',    icon: FileSignature,   label: '签署任务', group: 'Operations' },
  { path: '/compliance-reminders', icon: Bell,      label: '合规提醒', group: 'Compliance' },
  { path: '/compliance-rules',     icon: ShieldCheck, label: '合规规则',   group: 'Compliance' },
  { path: '/results-timetable', icon: CalendarClock, label: '业绩排期', group: 'Compliance' },
  { path: '/templates',     icon: FileCode,        label: '模板',  group: 'Library' },
  { path: '/settings',      icon: SettingsIcon,    label: '设置',   group: 'System' },
]

const ROLE_BADGE = {
  admin:   { label: '管理员',   color: 'bg-danger/10 text-danger'    },
  manager: { label: '经理', color: 'bg-info/10 text-primary-700'  },
  viewer:  { label: '查看者',  color: 'bg-canvas text-ink-2'  },
}

const TopNavLink = memo(({ to, label, active }) => (
  <Link
    to={to}
    className={`relative flex-shrink-0 whitespace-nowrap rounded-full text-xs lg:text-sm font-medium transition-colors duration-fast ${
      active
        ? 'bg-ink-brand text-white shadow-sm'
        : 'text-ink-2 hover:text-ink hover:bg-canvas'
    } px-1.5 lg:px-2 py-1.5 lg:py-2`}
  >
    {label}
  </Link>
))

const Navbar = () => {
  const { user, logout, isAdmin, isDemoMode, switchDemoAccount } = useAuth()
  const { unrestricted, count, noScope } = useScope()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  // 滚动收缩（Shrink on Scroll）：下滚超过阈值时导航收缩高度、背景更实、阴影加重
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const roleBadge = ROLE_BADGE[user?.role] || ROLE_BADGE.viewer
  const isActive = (p) => location.pathname === p || location.pathname.startsWith(p + '/')

  return (
    <>
      {/* 顶部导航栏：毛玻璃 + 圆角容器，悬浮于内容之上 */}
      <header className="fixed top-3 lg:top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] lg:w-[calc(100%-2rem)] max-w-[1400px]">
        <nav className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 transition-[padding,background-color,box-shadow,backdrop-filter] duration-300 ease-out ${
          scrolled
            ? 'py-1.5 bg-surface/98 dark:bg-surface/98 backdrop-blur-2xl border border-line-strong rounded-2xl shadow-3'
            : 'py-2 bg-surface/95 dark:bg-surface/95 backdrop-blur-xl border border-line-strong rounded-2xl shadow-2'
        }`}>
          {/* Logo — 明暗双模：亮色 Navy 字标 / 暗色反白字标（图标为自包含 navy 方底印章，两态通用） */}
          <Link to="/dashboard" className="flex items-center gap-2 pl-1 pr-2 shrink-0">
            <BrandLogo variant="icon" size="sm" />
            <span className={`font-extrabold text-ink-brand dark:text-white tracking-tight transition-[font-size] duration-300 ${scrolled ? 'text-sm lg:text-base' : 'text-base lg:text-lg'}`}>CSMS</span>
          </Link>

          {/* 桌面端水平导航：14 入口单行排布；容器 nowrap 防「设置」被挤到第二行，再以整 nav overflow-x-auto 做兜底 */}
          <div className="hidden lg:flex flex-nowrap items-center justify-center gap-0.5 flex-1 min-w-0 overflow-hidden">
            {NAV_ITEMS.map(item => (
              <TopNavLink key={item.path} to={item.path} label={item.label} active={isActive(item.path)} />
            ))}
          </div>

          {/* 桌面端内嵌实体搜索框：lg 用 224 / xl 用 256，给 14 导航让出空间，避免双层 */}
          <div className="hidden lg:block w-56 xl:w-64 shrink-0">
            <GlobalSearch
              variant="navbar"
              onOpenCommand={() => setCmdOpen(true)}
            />
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* 移动端搜索图标：点击打开全屏搜索浮层（顶栏在 <lg 没有水平空间放输入框） */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="lg:hidden p-1.5 rounded-full text-ink-2 hover:bg-canvas"
              aria-label="搜索"
              title="搜索"
            >
              <Search size={18} />
            </button>

            <button
              onClick={toggle}
              aria-label="切换明暗主题"
              className="theme-toggle-btn p-1.5 rounded-full text-ink-2 hover:bg-canvas transition-colors"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {isDemoMode && (
              <span className="hidden md:flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
                <Zap size={11} />演示
              </span>
            )}

            {/* 用户头像下拉 */}
            <div className="relative">
              <button
                onClick={() => setUserOpen(o => !o)}
                className={`flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 rounded-full transition-colors ${userOpen ? 'bg-canvas' : 'hover:bg-canvas'}`}
              >
                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px] lg:text-xs font-bold shrink-0">
                  {initials}
                </div>
                <span className="hidden md:block text-sm font-medium text-ink truncate max-w-[96px]">{user?.name}</span>
              </button>
              {userOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-hairline rounded-2xl shadow-3 py-3 z-50">
                  <div className="px-4 pb-3 border-b border-hairline">
                    <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
                    <p className="text-xs text-ink-3 truncate">{user?.email}</p>
                    <span className={`inline-flex mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </div>

                  <div className="px-4 py-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${noScope ? 'bg-danger/10 text-danger' : 'bg-canvas text-ink-2'}`}>
                      <ShieldCheck size={13} className="shrink-0" />
                      <span className="truncate">{unrestricted ? '全部数据' : `数据范围 · ${count} 家公司`}</span>
                    </div>
                  </div>

                  {isDemoMode && (
                    <div className="px-4 pb-2">
                      <button
                        onClick={() => setScopeMenuOpen(o => !o)}
                        className="flex items-center w-full gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-canvas rounded-xl transition-colors"
                      >
                        <Zap size={14} className="text-warning" /> 切换演示账号
                      </button>
                      {scopeMenuOpen && (
                        <div className="mt-1 space-y-0.5 pl-2">
                          {MOCK_DEMO_ACCOUNTS.map(a => (
                            <button
                              key={a.email}
                              onClick={() => { switchDemoAccount(a.email); setScopeMenuOpen(false); setUserOpen(false) }}
                              className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                                user?.email === a.email ? 'bg-primary-50 text-primary-700 font-medium' : 'text-ink-2 hover:bg-canvas'
                              }`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-hairline mt-1 pt-1 px-2">
                    <Link to="/settings" onClick={() => setUserOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-canvas rounded-xl transition-colors">
                      <SettingsIcon size={16} /> 设置
                    </Link>
                    <button
                      onClick={() => { logout(); setUserOpen(false) }}
                      className="flex items-center w-full gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-canvas hover:text-danger rounded-xl transition-colors"
                    >
                      <LogOut size={16} /> 退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 移动端汉堡：汉堡变叉（技巧⑪）— 三线连贯过渡为关闭叉号 */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-full text-ink-2 hover:bg-canvas"
              aria-label="菜单"
              aria-expanded={mobileOpen}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" className="ham" aria-hidden="true">
                <line x1="3" y1="6" x2="17" y2="6" className={`ham__l1 ${mobileOpen ? 'open' : ''}`} />
                <line x1="3" y1="10" x2="17" y2="10" className={`ham__l2 ${mobileOpen ? 'open' : ''}`} />
                <line x1="3" y1="14" x2="17" y2="14" className={`ham__l3 ${mobileOpen ? 'open' : ''}`} />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* 移动端抽屉菜单 */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-72 bg-surface border-l border-hairline shadow-4 lg:hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <span className="font-bold text-ink">菜单</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-canvas"><X size={20} /></button>
            </div>
            {/* 抽屉内不再放搜索：顶栏 <lg 已有 Search 图标开全屏浮层，重复入口以引导用户用主入口 */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
              {['Command','Operations','Compliance','Library','System'].map(group => {
                const items = NAV_ITEMS.filter(i => i.group === group)
                if (!items.length) return null
                const labels = { Command:'常用', Operations:'业务', Compliance:'合规', Library:'资料库', System:'系统' }
                return (
                  <div key={group}>
                    <p className="px-3 text-xs font-semibold text-ink-3 uppercase tracking-widest pb-1.5">{labels[group]}</p>
                    <div className="space-y-0.5">
                      {items.map(item => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                            isActive(item.path) ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-ink-2 hover:bg-canvas hover:text-ink'
                          }`}
                        >
                          <item.icon size={18} className={isActive(item.path) ? 'text-primary-600' : 'text-ink-3'} />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
              {isAdmin && (
                <div>
                  <p className="px-3 text-xs font-semibold text-ink-3 uppercase tracking-widest pb-1.5">管理</p>
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${isActive('/admin') ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-ink-2 hover:bg-canvas hover:text-ink'}`}>
                    <Crown size={18} className="text-danger" /> 管理后台
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* 移动端全屏搜索浮层（顶栏空间紧，图标点击后整屏接管） */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-surface lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline shrink-0">
            <span className="font-bold text-ink">搜索</span>
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="p-2 rounded-full hover:bg-canvas"
              aria-label="关闭搜索"
            >
              <X size={20} />
            </button>
          </div>
          <GlobalSearch
            variant="overlay"
            onOpenCommand={() => { setMobileSearchOpen(false); setCmdOpen(true) }}
          />
          {/* 全屏浮层下拉可能超出容器高度，留滚动缓冲 */}
        </div>
      )}

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}

export default Navbar
