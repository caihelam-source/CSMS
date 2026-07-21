import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import {
  LayoutDashboard, Calendar, FileText, Building2,
  CheckSquare, LogOut, Menu, X, Briefcase, Crown, Zap,
  Bell, ShieldCheck, FileCode, UserCircle, Settings as SettingsIcon,
  Sun, Moon, MoreHorizontal,
} from 'lucide-react'
import { useState, memo } from 'react'
import GlobalSearch from './GlobalSearch'

// v5.0 导航重组：移除 Directors 独立菜单，按 中央信息库 → 人员 → 文档 → 会议 → 合规 → 任务 排序
const NAV_ITEMS = [
  { path: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard',    group: null },
  { path: '/companies',              icon: Building2,       label: 'Companies',    group: null },
  { path: '/personnel',              icon: UserCircle,      label: 'Personnel',    group: null },
  { path: '/documents',              icon: FileText,        label: 'Documents',    group: null },
  { path: '/meetings',               icon: Calendar,        label: 'Meetings',     group: null },
  { path: '/tasks',                  icon: CheckSquare,     label: 'Tasks',        group: null },
  { path: '/compliance-reminders',   icon: Bell,            label: 'Reminders',    group: 'Compliance' },
  { path: '/compliance-rules',       icon: ShieldCheck,     label: 'Rules',        group: 'Compliance' },
  { path: '/templates',              icon: FileCode,        label: 'Templates',    group: 'Compliance' },
  { path: '/settings',              icon: SettingsIcon,     label: 'Settings',    group: null },
]

// 手机端底部 Tab 栏主项（最多 5 个，其余走"更多"抽屉）
const BOTTOM_TABS = [
  { path: '/dashboard',  icon: LayoutDashboard, label: '首页' },
  { path: '/companies',  icon: Building2,       label: '公司' },
  { path: '/documents',  icon: FileText,        label: '文档' },
  { path: '/meetings',   icon: Calendar,        label: '会议' },
  { path: '/tasks',      icon: CheckSquare,     label: '任务' },
]

const ROLE_BADGE = {
  admin:   { label: 'Admin',   color: 'bg-danger/10 text-danger'    },
  manager: { label: 'Manager', color: 'bg-info/10 text-primary-700'  },
  viewer:  { label: 'Viewer',  color: 'bg-canvas text-ink-2'  },
}

/**
 * NavItem — 侧边栏导航项。选中态：左侧 accent 条 + 加粗（T-3.6.4 一眼可辨）。
 */
const NavItem = memo(({ path, icon: Icon, label, admin, active, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`tap-target flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2 ${
      active
        ? 'bg-primary-50 text-primary-700 font-semibold border-primary-600'
        : 'text-ink-2 hover:bg-canvas hover:text-ink border-transparent'
    } ${admin ? 'border-dashed border-danger/30 hover:border-danger/30 hover:bg-danger/10 hover:text-danger' : ''}`}
  >
    <Icon size={18} className={active ? 'text-primary-600' : admin ? 'text-danger' : 'text-ink-3'} />
    <span className="flex-1">{label}</span>
    {admin && <Crown size={13} className="text-danger" />}
  </Link>
))

/**
 * BottomTab — 手机端底部 Tab。选中态：加粗 + 顶部指示条（对比度达标，T-3.6.4）。
 */
const BottomTab = memo(({ path, icon: Icon, label, active, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`tap-target flex-1 flex flex-col items-center justify-center gap-0.5 border-t-2 transition-colors ${
      active ? 'text-primary-700 font-semibold border-primary-700' : 'text-ink-3 border-transparent'
    }`}
  >
    <Icon size={20} />
    <span className="text-[11px] leading-none">{label}</span>
  </Link>
))

const Navbar = () => {
  const { user, logout, isAdmin, isDemo } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  // M3：统一使用 ThemeContext 单一事实源（此前自写 localStorage('theme') 与设置页不同步）
  const { theme, toggle } = useTheme()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const roleBadge = ROLE_BADGE[user?.role] || ROLE_BADGE.viewer
  const closeMobile = () => setOpen(false)
  const openMobile = () => setOpen(true)
  const isActive = (p) => location.pathname === p

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface rounded-lg shadow-md border border-hairline"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-surface border-r border-hairline
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-hairline">
          <div className="p-2 bg-primary-600 rounded-xl shadow-sm">
            <Briefcase size={19} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-ink leading-none">CSMS</h1>
            <p className="text-xs text-ink-3 mt-0.5 truncate">Secretary Management</p>
          </div>
          <button
            onClick={toggle}
            aria-label="切换明暗主题"
            className="ml-auto p-2 rounded-lg text-ink-2 hover:bg-canvas transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {isDemo && (
            <span className="flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium shrink-0">
              <Zap size={11} />Demo
            </span>
          )}
        </div>

        {/* Global search */}
        <GlobalSearch />

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV_ITEMS.filter(i => !i.group).map(item => (
              <NavItem key={item.path} {...item} active={isActive(item.path)} onClick={closeMobile} />
            ))}
          </div>
          <div className="mt-4">
            <p className="px-3 text-xs font-semibold text-ink-3 uppercase tracking-widest pb-1.5">Compliance</p>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter(i => i.group === 'Compliance').map(item => (
                <NavItem key={item.path} {...item} active={isActive(item.path)} onClick={closeMobile} />
              ))}
            </div>
          </div>
          {isAdmin && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-xs font-semibold text-ink-3 uppercase tracking-widest">Administration</p>
              </div>
              <NavItem path="/admin" icon={Crown} label="Admin Panel" admin active={isActive('/admin')} onClick={closeMobile} />
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-hairline space-y-1 pb-safe">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-canvas mb-1">
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate leading-tight">{user?.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="tap-target flex items-center w-full gap-3 px-3 py-2.5 text-sm text-ink-2 hover:bg-canvas hover:text-ink rounded-lg transition-colors"
          >
            <LogOut size={17} className="text-ink-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={closeMobile} />}

      {/* 手机端底部 Tab 栏 — 主项直达，更多走抽屉（含 safe-area 适配，T-3.6.1） */}
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-hairline flex pb-safe ${open ? 'hidden' : 'flex'}`}>
        {BOTTOM_TABS.map(item => (
          <BottomTab key={item.path} {...item} active={isActive(item.path)} onClick={closeMobile} />
        ))}
        <button
          onClick={openMobile}
          className={`tap-target flex-1 flex flex-col items-center justify-center gap-0.5 border-t-2 transition-colors ${
            open ? 'text-primary-700 font-semibold border-primary-700' : 'text-ink-3 border-transparent'
          }`}
          aria-label="更多菜单"
        >
          <MoreHorizontal size={20} />
          <span className="text-[11px] leading-none">更多</span>
        </button>
      </nav>
    </>
  )
}

export default Navbar
