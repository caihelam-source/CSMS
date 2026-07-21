import { useState, useEffect } from 'react'
import {
  Users, Shield, Settings, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Crown, Eye, UserCog, Mail,
  Activity, Building2, Calendar, FileText, CheckSquare,
  Loader2, ScrollText, Lock, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { userService, companyService, auditService } from '../services/index.js'
import { validate, required, email as emailValidator, minLength } from '../utils/validators'
import { inputClass, labelClass, PageHeader, DeleteConfirmModal, FormField, TabNav } from '../components/UIHelpers'
import Modal from '../components/Modal'

const USER_FORM_RULES = {
  name: [required('姓名为必填')],
  email: [required('邮箱为必填'), emailValidator('邮箱格式不正确')],
  password: [minLength(8, '密码至少8位')],
}

// 角色定义（5 角色 RBAC，与后端一致；rev2 新增 auditor）
const ROLES = [
  { value: 'admin',    label: 'Admin',    icon: Crown,   desc: 'Full access — can manage users, edit & delete anything',   color: 'bg-danger/10 text-danger' },
  { value: 'auditor',  label: 'Auditor',  icon: ShieldCheck, desc: 'Read-only across all companies — for compliance audit', color: 'bg-warning/10 text-warning' },
  { value: 'secretary',label: 'Secretary',icon: UserCog, desc: 'Can create & edit records and upload documents',            color: 'bg-info/10 text-primary-700' },
  { value: 'manager',  label: 'Manager',  icon: UserCog, desc: 'Can create & edit records, cannot manage users or delete',  color: 'bg-info/10 text-primary-700' },
  { value: 'viewer',   label: 'Viewer',   icon: Eye,     desc: 'Read-only access — cannot create, edit, or delete',         color: 'bg-canvas text-ink-2' },
]

const roleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3]

// 后端用户 → 前端展示模型
const normalizeUser = (u) => ({
  id: u._id || u.id,
  name: u.name,
  email: u.email,
  role: u.role || 'viewer',
  status: u.isActive === false ? 'inactive' : 'active',
  joined: u.joined || (u.createdAt ? String(u.createdAt).slice(0, 10) : '—'),
})

// ─── User Form ────────────────────────────────────────────────────
const UserForm = ({ initial = {}, onSave, onCancel, loading, currentUserId }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    role: initial.role || 'viewer',
    status: initial.status || 'active',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const isEdit = !!initial.id

  const handleSubmit = (e) => {
    e.preventDefault()
    const rules = { ...USER_FORM_RULES }
    if (!isEdit) rules.password = [required('密码为必填'), minLength(8, '密码至少8位')]
    const { valid, errors: vErrors } = validate(form, rules)
    if (!valid) { setErrors(vErrors); return }
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <FormField label="Full Name" required error={errors.name}>
            <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="Email Address" required error={errors.email}>
            <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@company.com" />
          </FormField>
        </div>
        <div>
          <FormField label={isEdit ? 'New Password' : 'Password *'} error={errors.password}>
            <input
              type="password"
              className={inputClass}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep unchanged' : 'Min 8 characters'}
            />
          </FormField>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}
            disabled={initial.id === currentUserId}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {initial.id === currentUserId && <p className="text-xs text-ink-3 mt-1">Cannot change your own status</p>}
        </div>
      </div>

      {/* Role picker */}
      <div>
        <label className={labelClass}>Role *</label>
        <div className="space-y-2 mt-1">
          {ROLES.map(r => {
            const Icon = r.icon
            const selected = form.role === r.value
            return (
              <label key={r.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selected ? 'border-primary-400 bg-primary-50' : 'border-hairline hover:border-hairline'}`}>
                <input type="radio" name="role" value={r.value} checked={selected}
                  onChange={() => set('role', r.value)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon size={15} />
                    <span className="text-sm font-medium text-ink">{r.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.color}`}>{r.value}</span>
                  </div>
                  <p className="text-xs text-ink-2 mt-0.5">{r.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">Cancel</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

// ─── Permission Matrix ────────────────────────────────────────────
const PERM_MATRIX = [
  { feature: 'View Dashboard & Reports', admin: true,  auditor: true,  secretary: true,  manager: true,  viewer: true  },
  { feature: 'View Companies / Meetings / Documents / Tasks', admin: true, auditor: true, secretary: true, manager: true, viewer: true },
  { feature: 'Create & Edit Records', admin: true,  auditor: false, secretary: true,  manager: true,  viewer: false },
  { feature: 'Delete Records',         admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
  { feature: 'Upload Documents',       admin: true,  auditor: false, secretary: true,  manager: true,  viewer: false },
  { feature: 'Manage Users',           admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
  { feature: 'Access Admin Panel',     admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
]

const Tick = ({ ok }) => ok
  ? <CheckCircle size={18} className="text-success mx-auto" />
  : <XCircle size={18} className="text-ink-3 mx-auto" />

// ─── Stats banner ─────────────────────────────────────────────────
const StatBadge = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color}`}>
    <Icon size={20} />
    <div>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
    </div>
  </div>
)

// ─── Main Component ───────────────────────────────────────────────
const AdminPanel = () => {
  const { user: currentUser, isAdmin } = useAuth()
  const [tab, setTab] = useState(isAdmin ? 'users' : 'audit')
  const [users, setUsers] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  // Wave 0 rev2 — 数据权限分配
  const [companies, setCompanies] = useState([])
  const [scopeUserId, setScopeUserId] = useState(null)
  const [scopeSel, setScopeSel] = useState([])
  const [scopeSaving, setScopeSaving] = useState(false)
  // Wave 0 rev2 — 审计日志
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  const loadUsers = async () => {
    setListLoading(true)
    try {
      const res = await userService.getAll()
      const list = (res.data?.data || res.data || []).map(u => ({ ...u, accessibleCompanies: u.accessibleCompanies || [] }))
      setUsers(list)
    } catch (err) {
      console.error('[AdminPanel] load users failed:', err)
    } finally {
      setListLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const res = await companyService.getAll()
      const list = res.data?.data || res.data || []
      setCompanies(Array.isArray(list) ? list : (list.data || []))
    } catch (err) { console.error('[AdminPanel] load companies failed:', err) }
  }

  const loadAudit = async () => {
    setAuditLoading(true)
    try {
      const res = await auditService.getAll()
      const list = res.data?.data || res.data || []
      setAuditLogs(Array.isArray(list) ? list : (list.data || []))
    } catch (err) { console.error('[AdminPanel] load audit failed:', err) }
    finally { setAuditLoading(false) }
  }

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'scope') { loadUsers(); loadCompanies() }
    if (tab === 'audit') loadAudit()
  }, [tab])

  const canViewAudit = isAdmin || currentUser?.role === 'auditor'

  if (!isAdmin && !canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Shield size={48} className="text-ink-3 mb-4" />
        <h2 className="text-xl font-semibold text-ink mb-2">Access Denied</h2>
        <p className="text-ink-2">Only administrators or auditors can access this panel.</p>
      </div>
    )
  }

  const openNew = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (u) => { setEditTarget(u); setModalOpen(true) }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editTarget) {
        const payload = { name: form.name, email: form.email, role: form.role, isActive: form.status === 'active' }
        const res = await userService.update(editTarget.id, payload)
        const updated = normalizeUser(res.data?.data || res.data)
        setUsers(us => us.map(u => u.id === editTarget.id ? updated : u))
      } else {
        const payload = { name: form.name, email: form.email, password: form.password, role: form.role }
        const res = await userService.create(payload)
        const created = normalizeUser(res.data?.data || res.data)
        setUsers(us => [...us, created])
      }
      setModalOpen(false)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await userService.remove(deleteTarget.id)
      setUsers(us => us.filter(u => u.id !== deleteTarget.id))
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Delete failed'
      alert(msg)
    }
    setDeleteTarget(null)
  }

  // Wave 0 rev2 — 数据权限：为某用户分配可访问公司
  const openScope = (u) => {
    setScopeUserId(u.id)
    setScopeSel(u.accessibleCompanies || [])
  }
  const saveScope = async () => {
    setScopeSaving(true)
    try {
      const res = await userService.update(scopeUserId, { accessibleCompanies: scopeSel })
      const updated = res.data?.data || res.data
      const uid = updated?._id || updated?.id || scopeUserId
      setUsers(us => us.map(u => u.id === uid ? { ...u, accessibleCompanies: scopeSel } : u))
      setScopeUserId(null)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save scope failed'
      alert(msg)
    } finally {
      setScopeSaving(false)
    }
  }

  const TABS = [
    ...(isAdmin ? [
      { id: 'users', label: 'User Management', icon: Users },
      { id: 'permissions', label: 'Permission Matrix', icon: Shield },
      { id: 'scope', label: '数据权限', icon: Building2 },
      { id: 'system', label: 'System Info', icon: Settings },
    ] : []),
    ...(canViewAudit ? [
      { id: 'audit', label: '审计日志', icon: ScrollText },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Admin Panel"
        subtitle="System administration and access control"
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

      {/* ── USER MANAGEMENT ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-ink-2">{listLoading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} registered`}</p>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={16} /> Add User
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-hairline overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b border-hairline">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3"><Loader2 className="inline animate-spin" size={18} /> Loading users…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3">No users found.</td></tr>
                ) : users.map(u => {
                  const ri = roleInfo(u.role)
                  const RoleIcon = ri.icon
                  const isMe = u.email === currentUser?.email
                  return (
                    <tr key={u.id} className="hover:bg-canvas transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">
                            {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-ink">{u.name}</span>
                              {isMe && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-ink-3 mt-0.5">
                              <Mail size={11} />{u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ri.color}`}>
                          <RoleIcon size={12} />{ri.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {u.status === 'active'
                          ? <span className="inline-flex items-center gap-1 text-success text-xs"><span className="w-1.5 h-1.5 rounded-full bg-success" />Active</span>
                          : <span className="inline-flex items-center gap-1 text-ink-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive</span>}
                      </td>
                      <td className="px-5 py-4 text-ink-3 text-xs">{u.joined}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <Pencil size={15} />
                          </button>
                          {!isMe && (
                            <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PERMISSION MATRIX ── */}
      {tab === 'permissions' && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline">
            <h3 className="font-semibold text-ink">Role Permission Matrix</h3>
            <p className="text-sm text-ink-2 mt-0.5">What each role can and cannot do</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-canvas border-b border-hairline">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Feature</th>
                {ROLES.map(r => {
                  const Icon = r.icon
                  return (
                    <th key={r.value} className="px-4 py-3 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${r.color}`}>
                        <Icon size={12} />{r.label}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-100">
              {PERM_MATRIX.map((row, i) => (
                <tr key={i} className="hover:bg-canvas">
                  <td className="px-5 py-3.5 text-ink">{row.feature}</td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.admin} /></td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.auditor} /></td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.secretary} /></td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.manager} /></td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.viewer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SYSTEM INFO ── */}
      {tab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-surface rounded-xl border border-hairline shadow-sm p-5">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2"><Activity size={18} className="text-primary-600" />System Overview</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Application', value: 'CSMS v5.0' },
                { label: 'Framework', value: 'React 18 + Vite' },
                { label: 'Backend', value: 'Node.js / Express' },
                { label: 'Database', value: 'MongoDB' },
                { label: 'Auth', value: 'JWT Tokens (5-role RBAC + row-level)' },
                { label: 'Mode', value: localStorage.getItem('demoEmail') ? '⚡ Demo (no backend)' : '🟢 Live' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-hairline last:border-0">
                  <span className="text-ink-2">{label}</span>
                  <span className="font-medium text-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-hairline shadow-sm p-5">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary-600" />Module Status</h3>
            <div className="space-y-2 text-sm">
              {[
                { icon: Building2, label: 'Companies',  status: 'Active' },
                { icon: Calendar,  label: 'Meetings',   status: 'Active' },
                { icon: FileText,  label: 'Documents',  status: 'Active' },
                { icon: CheckSquare, label: 'Tasks',    status: 'Active' },
                { icon: Users,     label: 'User Mgmt',  status: 'Active' },
              ].map(({ icon: Icon, label, status }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-hairline last:border-0">
                  <div className="flex items-center gap-2 text-ink"><Icon size={15} className="text-ink-3" />{label}</div>
                  <span className="flex items-center gap-1 text-success text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-success" />{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DATA SCOPE (Wave 0 rev2) ── */}
      {tab === 'scope' && (
        <div className="space-y-4">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm text-primary-700">
            为每位非 admin/auditor 用户分配其可访问的公司范围。admin 与 auditor 默认跨公司可见（不受限）。未分配的用户将看不到任何公司数据。
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 用户列表 */}
            <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-hairline font-medium text-ink text-sm">用户</div>
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-auto">
                {users.filter(u => u.role !== 'admin' && u.role !== 'auditor').map(u => (
                  <button key={u.id} onClick={() => openScope(u)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-canvas transition-colors ${scopeUserId === u.id ? 'bg-primary-50' : ''}`}>
                    <div>
                      <div className="text-sm font-medium text-ink">{u.name}</div>
                      <div className="text-xs text-ink-3">{u.email}</div>
                    </div>
                    <span className="text-xs text-ink-2">{(u.accessibleCompanies || []).length} 家</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 公司多选 */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-hairline shadow-sm p-5">
              {scopeUserId ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-ink">分配可访问公司</h3>
                    <span className="text-sm text-ink-2">已选 {scopeSel.length} 家</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-auto">
                    {companies.map(c => {
                      const cid = c._id || c.id
                      const checked = scopeSel.includes(cid)
                      return (
                        <label key={cid} className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer ${checked ? 'border-primary-400 bg-primary-50' : 'border-hairline hover:border-hairline'}`}>
                          <input type="checkbox" checked={checked} onChange={() => setScopeSel(s => s.includes(cid) ? s.filter(x => x !== cid) : [...s, cid])} className="mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm text-ink truncate">{c.name}</div>
                            <div className="text-xs text-ink-3">{c.registrationNumber}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setScopeUserId(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">取消</button>
                    <button onClick={saveScope} disabled={scopeSaving} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                      {scopeSaving ? '保存中…' : '保存权限'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-ink-3">
                  <Building2 size={40} className="mb-3 opacity-40" />
                  <p className="text-sm">从左侧选择一位用户以分配公司数据权限</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG (Wave 0 rev2) ── */}
      {tab === 'audit' && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline flex items-center gap-2">
            <ScrollText size={18} className="text-primary-600" />
            <div>
              <h3 className="font-semibold text-ink">审计日志</h3>
              <p className="text-sm text-ink-2 mt-0.5">归档 / 锁定 / 权限分配等敏感操作的留痕记录</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b border-hairline">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">时间</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">操作者</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">动作</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">对象</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3"><Loader2 className="inline animate-spin" size={18} /> 加载中…</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3">暂无审计记录</td></tr>
                ) : auditLogs.map(a => (
                  <tr key={a._id} className="hover:bg-canvas">
                    <td className="px-5 py-3 text-ink-3 text-xs whitespace-nowrap">{String(a.createdAt).slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-5 py-3 text-ink">{a.actorName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${a.action === 'archive' ? 'bg-success/10 text-success' : a.action === 'lock' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-primary-700'}`}>
                        {a.action === 'archive' && <CheckSquare size={11} />}
                        {a.action === 'lock' && <Lock size={11} />}
                        {a.action === 'assign_scope' && <Building2 size={11} />}
                        {a.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-xs">{a.entityType}</td>
                    <td className="px-5 py-3 text-ink-2">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit User' : 'Add New User'} size="md">
        <UserForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} currentUserId={currentUser?.id} />
      </Modal>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={false}
      />
    </div>
  )
}

export default AdminPanel
