// AdminPanel — 薄壳（D1 等价重构）。
// 仅持有「选中态 + 顶部统计 + Tab 导航」与访问权限判断，所有 Tab 内容下沉到 components/admin/*。
// 行为 / 样式 / 交互与原版完全一致（原内容已按 Tab 拆分至各子组件）。
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Users, CheckCircle, Crown, UserCog, Eye, Shield, CalendarClock,
  Settings, ScrollText, Building2, Database,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { userService } from '../services/index.js'
import { PageHeader, TabNav } from '../components/UIHelpers'
import { StatBadge } from '../components/admin/_shared'
import UserManagementTab from '../components/admin/UserManagementTab'
import PermissionMatrixTab from '../components/admin/PermissionMatrixTab'
import DataScopeTab from '../components/admin/DataScopeTab'
import RulesLibraryTab from '../components/admin/RulesLibraryTab'
import SystemInfoTab from '../components/admin/SystemInfoTab'
import AuditLogTab from '../components/admin/AuditLogTab'
import DataExportTab from '../components/admin/DataExportTab'

const AdminPanel = () => {
  const { user: currentUser, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab')
    // 仅管理员可见「业绩排期规则库」；非管理员深链到该 tab 时回退到默认 tab
    if (fromUrl === 'rules' && !isAdmin) return 'audit'
    return fromUrl || (isAdmin ? 'users' : 'audit')
  })
  // 顶部统计用的用户列表（仅 users / scope Tab 触发加载，与原版一致）
  const [users, setUsers] = useState([])

  const loadUsers = async () => {
    try {
      const res = await userService.getAll()
      const list = (res.data?.data || res.data || []).map(u => ({ ...u, accessibleCompanies: u.accessibleCompanies || [] }))
      setUsers(list)
    } catch (err) {
      console.error('[AdminPanel] load users failed:', err)
    }
  }

  useEffect(() => {
    if (tab === 'users' || tab === 'scope') loadUsers()
  }, [tab])

  const canViewAudit = isAdmin || currentUser?.role === 'auditor'

  if (!isAdmin && !canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Shield size={48} className="text-ink-3 mb-4" />
        <h2 className="text-xl font-semibold text-ink mb-2">访问被拒绝</h2>
        <p className="text-ink-2">仅管理员或审计员可访问此面板。</p>
      </div>
    )
  }

  const TABS = [
    ...(isAdmin ? [
      { id: 'users', label: '用户管理', icon: Users },
      { id: 'permissions', label: '权限矩阵', icon: Shield },
      { id: 'scope', label: '数据权限', icon: Building2 },
      { id: 'rules', label: '业绩排期规则库', icon: CalendarClock },
      { id: 'export', label: '数据导出', icon: Database },
      { id: 'system', label: '系统信息', icon: Settings },
    ] : []),
    ...(canViewAudit ? [
      { id: 'audit', label: '审计日志', icon: ScrollText },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="管理后台"
        subtitle="系统管理与访问控制"
        icon={Crown}
        iconColor="text-danger"
        actions={
          <span className="px-3 py-1 bg-danger/10 text-danger text-xs font-semibold rounded-full">Admin Only</span>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatBadge icon={Users} label="Total Users" value={users.length} color="bg-info/10 text-primary-700" />
        <StatBadge icon={CheckCircle} label="Active" value={users.filter(u => u.status === 'active').length} color="bg-success/10 text-success" />
        <StatBadge icon={Crown} label="Admins" value={users.filter(u => u.role === 'admin').length} color="bg-danger/10 text-danger" />
        <StatBadge icon={UserCog} label="Managers" value={users.filter(u => u.role === 'manager' || u.role === 'secretary').length} color="bg-info/10 text-ink-2" />
        <StatBadge icon={Eye} label="Viewers" value={users.filter(u => u.role === 'viewer').length} color="bg-canvas text-ink-2" />
      </div>

      {/* Tab nav */}
      <TabNav
        tabs={TABS.map(t => ({ key: t.id, label: t.label, icon: t.icon }))}
        active={tab}
        onChange={setTab}
      />

      {/* ── Tab 内容（全部下沉至 components/admin/*）── */}
      {tab === 'users' && <UserManagementTab />}
      {tab === 'permissions' && <PermissionMatrixTab />}
      {tab === 'scope' && <DataScopeTab />}
      {tab === 'rules' && isAdmin && <RulesLibraryTab />}
      {tab === 'export' && <DataExportTab />}
      {tab === 'system' && <SystemInfoTab />}
      {tab === 'audit' && <AuditLogTab />}
    </div>
  )
}

export default AdminPanel
