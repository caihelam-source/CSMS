import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  LayoutDashboard, Calendar, FileText, Building2,
  CheckSquare, LogOut, Menu, X, Briefcase, Crown, Zap,
  Bell, ShieldCheck, FileCode, PenLine, Users, UserCircle, Settings as SettingsIcon,
} from 'lucide-react'
import { useState, memo } from 'react'

const NAV_ITEMS = [
  { path: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard',    group: null },
  { path: '/companies',              icon: Building2,       label: 'Companies',    group: null },
  { path: '/directors',              icon: Users,           label: 'Directors',    group: null },
  { path: '/personnel',              icon: UserCircle,      label: 'Personnel',    group: null },
  { path: '/meetings',               icon: Calendar,        label: 'Meetings',     group: null },
  { path: '/documents',              icon: FileText,        label: 'Documents',    group: null },
  { path: '/tasks',                  icon: CheckSquare,     label: 'Tasks',        group: null },
  { path: '/compliance-reminders',   icon: Bell,            label: 'Reminders',    group: 'Compliance' },
  { path: '/compliance-rules',       icon: ShieldCheck,     label: 'Rules',        group: 'Compliance' },
  { path: '/templates',              icon: FileCode,        label: 'Templates',    group: 'Compliance' },
  { path: '/sign-tasks',             icon: PenLine,         label: 'Signing',      group: 'Compliance' },
  { path: '/settings',              icon: SettingsIcon,     label: 'Settings',    group: null },
]

const ROLE_BADGE = {
  admin:   { label: 'Admin',   color: 'bg-red-100 text-red-700'    },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700'  },
  viewer:  { label: 'Viewer',  color: 'bg-gray-100 text-gray-600'  },
}

/**
 * NavItem — extracted outside Navbar to avoid re-creating component on every render.
 * Wrapped in memo to prevent unnecessary re-renders when parent state changes.
 */
const NavItem = memo(({ path, icon: Icon, label, admin, active, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    } ${admin ? 'border border-dashed border-red-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700' : ''}`}
  >
    <Icon size={18} className={active ? 'text-primary-600' : admin ? 'text-red-400' : 'text-gray-400'} />
    <span className="flex-1">{label}</span>
    {admin && <Crown size={13} className="text-red-400" />}
  </Link>
))

const Navbar = () => {
  const { user, logout, isAdmin, isDemo } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const roleBadge = ROLE_BADGE[user?.role] || ROLE_BADGE.viewer

  const closeMobile = () => setOpen(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <div className="p-2 bg-primary-600 rounded-xl shadow-sm">
            <Briefcase size={19} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-none">CSMS</h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate">Secretary Management</p>
          </div>
          {isDemo && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              <Zap size={11} />Demo
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Main items (no group) */}
          <div className="space-y-0.5">
            {NAV_ITEMS.filter(i => !i.group).map(item => (
              <NavItem key={item.path} {...item} active={location.pathname === item.path} onClick={closeMobile} />
            ))}
          </div>

          {/* Compliance group */}
          <div className="mt-4">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest pb-1.5">Compliance</p>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter(i => i.group === 'Compliance').map(item => (
                <NavItem key={item.path} {...item} active={location.pathname === item.path} onClick={closeMobile} />
              ))}
            </div>
          </div>

          {/* Admin section — only visible to admins */}
          {isAdmin && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Administration</p>
              </div>
              <NavItem path="/admin" icon={Crown} label="Admin Panel" admin active={location.pathname === '/admin'} onClick={closeMobile} />
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-gray-200 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 mb-1">
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full gap-3 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
          >
            <LogOut size={17} className="text-gray-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={closeMobile} />}
    </>
  )
}

export default Navbar
