import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import {
  LayoutDashboard, Calendar, FileText, Building2,
  CheckSquare, LogOut, Menu, X, Briefcase, Crown, Zap,
  Bell, ShieldCheck, FileCode, UserCircle, Settings as SettingsIcon,
  Sun, Moon, MoreHorizontal, FileSignature, CalendarClock,
} from 'lucide-react'
import { useState, memo, useEffect } from 'react'
import GlobalSearch from './GlobalSearch'
import CommandPalette from './CommandPalette'

// UX 架构重构（2026-08-03）：IA 四组分组，修复 Sign Tasks 导航孤儿 + Templates 归位
// 分组顺序与标题由 NAV_GROUPS 驱动，新增组无需改渲染逻辑
export const NAV_ITEMS = [
  { path: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',  group: 'Command' },
  { path: '/companies',    icon: Building2,       label: 'Companies',  group: 'Command' },
  { path: '/personnel',    icon: UserCircle,      label: 'Personnel',  group: 'Command' },
  { path: '/documents',    icon: FileText,        label: 'Documents',  group: 'Operations' },
  { path: '/meetings',     icon: Calendar,        label: 'Meetings',   group: 'Operations' },
  { path: '/tasks',        icon: CheckSquare,     label: 'Tasks',      group: 'Operations' },
  { path: '/sign-tasks',   icon: FileSignature,   label: 'Signatures', group: 'Operations' },
  { path: '/compliance-reminders', icon: Bell,      label: 'Reminders', group: 'Compliance' },
  { path: '/compliance-rules',     icon: ShieldCheck, label: 'Rules',   group: 'Compliance' },
  { path: '/results-timetable', icon: CalendarClock, label: '业绩排期', group: 'Compliance' },
  { path: '/templates',    icon: FileCode,        label: 'Templates',  group: 'Library' },
  { path: '/settings',     icon: SettingsIcon,    label: 'Settings',   group: 'System' },
]

// 侧边栏分组：label=null 表示该组无标题（Command 作为默认起始组）
export const NAV_GROUPS = [
  { key: 'Command',    label: null },
  { key: 'Operations', label: 'Operations' },
  { key: 'Compliance', label: 'Compliance' },
  { key: 'Library',    label: 'Library' },
  { key: 'System',     label: 'System' },
]

// 手机端底部 Tab 栏主项（最多 5 个，其余走"更多"抽屉）
// UX 重构 B5：把高频的「合规 / 签署」提到底部，替换低频的「文档 / 会议」（仍可在"更多"抽屉到达）
export const BOTTOM_TABS = [
  { path: '/dashboard',  icon: LayoutDashboard, label: '首页' },
  { path: '/companies',  icon: Building2,       label: '公司' },
  { path: '/compliance-reminders', icon: Bell,  label: '合规' },
  { path: '/sign-tasks', icon: FileSignature,   label: '签署' },
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
  const [cmdOpen, setCmdOpen] = useState(false)
  // P2 命令面板：⌘K / Ctrl+K 全局唤起（与顶部触发按钮共用同一状态）
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

        {/* Global search + 命令面板入口（按钮紧贴搜索框右侧，A 方案） */}
        <GlobalSearch onOpenCommand={() => setCmdOpen(true)} />

        {/* Nav items — 由 NAV_GROUPS 驱动渲染，新增分组无需改动此处 */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            const items = NAV_ITEMS.filter(i => i.group === group.key)
            if (!items.length) return null
            return (
              <div key={group.key} className={group.key === 'Command' ? '' : 'mt-4'}>
                {group.label && (
                  <p className="px-3 text-xs font-semibold text-ink-3 uppercase tracking-widest pb-1.5">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {items.map(item => (
                    <NavItem key={item.path} {...item} active={isActive(item.path)} onClick={closeMobile} />
                  ))}
                </div>
              </div>
            )
          })}
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

      {/* P2 命令面板 ⌘K */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}

export default Navbar
