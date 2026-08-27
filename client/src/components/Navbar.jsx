import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import {
  LayoutDashboard, Calendar, FileText, Building2,
  CheckSquare, LogOut, Menu, X, Crown, Zap,
  Bell, ShieldCheck, FileCode, UserCircle, Settings as SettingsIcon,
  Sun, Moon, MoreHorizontal, FileSignature, CalendarClock, CalendarDays,
  Search, Command,
} from 'lucide-react'
import { useState, memo, useEffect, useRef } from 'react'
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
    className={`relative px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-50 text-primary-700'
        : 'text-ink-2 hover:text-ink hover:bg-canvas'
    }`}
  >
    {label}
    {active && <span className="absolute inset-x-2 -bottom-1 h-0.5 bg-primary-600 rounded-full" />}
  </Link>
))

const Dropdown = ({ label, active, children }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
          active ? 'bg-primary-50 text-primary-700' : 'text-ink-2 hover:text-ink hover:bg-canvas'
        }`}
      >
        {label} <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-44 bg-surface border border-hairline rounded-2xl shadow-3 py-2 z-50">
          {children}
        </div>
      )}
    </div>
  )
}

const DropdownItem = memo(({ to, icon: Icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
      active ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-ink-2 hover:bg-canvas hover:text-ink'
    }`}
  >
    <Icon size={16} className={active ? 'text-primary-600' : 'text-ink-3'} />
    {label}
  </Link>
))

const Navbar = () => {
  const { user, logout, isAdmin, isDemoMode, switchDemoAccount } = useAuth()
  const { unrestricted, count, noScope } = useScope()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false)
  const { theme, toggle } = useTheme()

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

  const mainLinks = [
    { path: '/dashboard', label: '仪表板' },
    { path: '/companies', label: '公司' },
    { path: '/personnel', label: '人员' },
    { path: '/documents', label: '文档' },
    { path: '/meetings', label: '会议' },
    { path: '/tasks', label: '任务' },
  ]

  const complianceItems = NAV_ITEMS.filter(i => i.group === 'Compliance')
  const moreItems = [
    ...NAV_ITEMS.filter(i => i.group === 'Command' && !mainLinks.some(m => m.path === i.path)),
    ...NAV_ITEMS.filter(i => i.group === 'Operations' && !mainLinks.some(m => m.path === i.path)),
    ...NAV_ITEMS.filter(i => i.group === 'Library'),
    ...NAV_ITEMS.filter(i => i.group === 'System'),
  ]

  const complianceActive = complianceItems.some(i => isActive(i.path))
  const moreActive = moreItems.some(i => isActive(i.path))

  return (
    <>
      {/* 顶部导航栏：毛玻璃 + 圆角容器，悬浮于内容之上 */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1400px]">
        <nav className="flex items-center gap-3 px-3 py-2.5 bg-surface/85 dark:bg-surface/80 backdrop-blur-xl border border-hairline rounded-2xl shadow-3">
          {/* Logo — 明暗双模：亮色 Navy 字标 / 暗色反白字标（图标为自包含 navy 方底印章，两态通用） */}
          <Link to="/dashboard" className="flex items-center gap-2.5 pl-1 pr-3 shrink-0">
            <BrandLogo variant="icon" size="md" />
            <span className="font-extrabold text-[#0F2A5E] dark:text-white text-lg tracking-tight">CSMS</span>
          </Link>

          {/* 桌面端水平导航 */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 overflow-hidden">
            {mainLinks.map(item => (
              <TopNavLink key={item.path} to={item.path} label={item.label} active={isActive(item.path)} />
            ))}

            {/* 合规下拉 */}
            <Dropdown label="合规" active={complianceActive}>
              {complianceItems.map(item => (
                <DropdownItem key={item.path} {...item} active={isActive(item.path)} />
              ))}
            </Dropdown>

            {/* 更多下拉 */}
            <Dropdown label="更多" active={moreActive}>
              {moreItems.map(item => (
                <DropdownItem key={item.path} {...item} active={isActive(item.path)} />
              ))}
              {isAdmin && (
                <>
                  <div className="my-1 border-t border-hairline" />
                  <DropdownItem path="/admin" icon={Crown} label="管理后台" active={isActive('/admin')} />
                </>
              )}
            </Dropdown>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-ink-3 bg-canvas hover:bg-canvas/80 transition-colors"
              title="命令面板 (⌘K)"
            >
              <Search size={15} /> <span className="hidden xl:inline">搜索</span> <Command size={12} />
            </button>

            <button
              onClick={toggle}
              aria-label="切换明暗主题"
              className="theme-toggle-btn p-2 rounded-full text-ink-2 hover:bg-canvas transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
                className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-colors ${userOpen ? 'bg-canvas' : 'hover:bg-canvas'}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
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

            {/* 移动端汉堡 */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2 rounded-full text-ink-2 hover:bg-canvas"
              aria-label="菜单"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
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
            <div className="px-3 py-3">
              <GlobalSearch onOpenCommand={() => { setMobileOpen(false); setCmdOpen(true) }} />
            </div>
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

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}

export default Navbar
