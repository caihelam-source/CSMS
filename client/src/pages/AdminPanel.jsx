import { useState } from 'react'
import {
  Users, Shield, Settings, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Crown, Eye, UserCog, Mail,
  Activity, Building2, Calendar, FileText, CheckSquare
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { validate, required, email as emailValidator, minLength } from '../utils/validators'
import { inputClass, labelClass, PageHeader, DeleteConfirmModal, FormField, TabNav } from '../components/UIHelpers'
import Modal from '../components/Modal'

const USER_FORM_RULES = {
  name: [required('姓名为必填')],
  email: [required('邮箱为必填'), emailValidator('邮箱格式不正确')],
  password: [minLength(8, '密码至少8位')],
}

// ─── Demo user list ───────────────────────────────────────────────
const INITIAL_USERS = [
  { id: 'u1', name: 'Admin User',   email: 'admin@example.com',   role: 'admin',   status: 'active',   joined: '2024-01-01' },
  { id: 'u2', name: 'Sarah Manager',email: 'manager@example.com', role: 'manager', status: 'active',   joined: '2024-03-15' },
  { id: 'u3', name: 'View Only',    email: 'viewer@example.com',  role: 'viewer',  status: 'active',   joined: '2024-06-20' },
]

const ROLES = [
  { value: 'admin',   label: 'Admin',   icon: Crown,   desc: 'Full access — can manage users, edit & delete anything',   color: 'bg-red-100 text-red-700' },
  { value: 'manager', label: 'Manager', icon: UserCog, desc: 'Can create & edit records, cannot manage users or delete',  color: 'bg-blue-100 text-blue-700' },
  { value: 'viewer',  label: 'Viewer',  icon: Eye,     desc: 'Read-only access — cannot create, edit, or delete',         color: 'bg-gray-100 text-gray-600' },
]

const roleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[2]

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
          {initial.id === currentUserId && <p className="text-xs text-gray-400 mt-1">Cannot change your own status</p>}
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
              <label key={r.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selected ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="role" value={r.value} checked={selected}
                  onChange={() => set('role', r.value)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon size={15} />
                    <span className="text-sm font-medium text-gray-900">{r.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.color}`}>{r.value}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

// ─── Permission Matrix ────────────────────────────────────────────
const PERM_MATRIX = [
  { feature: 'View Dashboard & Reports', admin: true,  manager: true,  viewer: true  },
  { feature: 'View Companies / Meetings / Documents / Tasks', admin: true, manager: true, viewer: true },
  { feature: 'Create & Edit Records', admin: true,  manager: true,  viewer: false },
  { feature: 'Delete Records',         admin: true,  manager: false, viewer: false },
  { feature: 'Upload Documents',       admin: true,  manager: true,  viewer: false },
  { feature: 'Manage Users',           admin: true,  manager: false, viewer: false },
  { feature: 'Access Admin Panel',     admin: true,  manager: false, viewer: false },
]

const Tick = ({ ok }) => ok
  ? <CheckCircle size={18} className="text-green-500 mx-auto" />
  : <XCircle size={18} className="text-gray-300 mx-auto" />

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
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState(INITIAL_USERS)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Shield size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">Only administrators can access this panel.</p>
      </div>
    )
  }

  const openNew = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (u) => { setEditTarget(u); setModalOpen(true) }

  const handleSave = (form) => {
    setSaving(true)
    setTimeout(() => {
      if (editTarget) {
        setUsers(us => us.map(u => u.id === editTarget.id ? { ...u, ...form } : u))
      } else {
        setUsers(us => [...us, { ...form, id: 'u' + Date.now(), joined: new Date().toISOString().slice(0, 10) }])
      }
      setModalOpen(false)
      setSaving(false)
    }, 400)
  }

  const handleDelete = () => {
    setUsers(us => us.filter(u => u.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const TABS = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'permissions', label: 'Permission Matrix', icon: Shield },
    { id: 'system', label: 'System Info', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Admin Panel"
        subtitle="System administration and access control"
        icon={Crown}
        iconColor="text-red-600"
        actions={
          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Admin Only</span>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatBadge icon={Users} label="Total Users" value={users.length} color="bg-blue-50 text-blue-700" />
        <StatBadge icon={CheckCircle} label="Active" value={users.filter(u => u.status === 'active').length} color="bg-green-50 text-green-700" />
        <StatBadge icon={Crown} label="Admins" value={users.filter(u => u.role === 'admin').length} color="bg-red-50 text-red-700" />
        <StatBadge icon={UserCog} label="Managers" value={users.filter(u => u.role === 'manager').length} color="bg-purple-50 text-purple-700" />
        <StatBadge icon={Eye} label="Viewers" value={users.filter(u => u.role === 'viewer').length} color="bg-gray-100 text-gray-600" />
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
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={16} /> Add User
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => {
                  const ri = roleInfo(u.role)
                  const RoleIcon = ri.icon
                  const isMe = u.email === currentUser?.email
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">
                            {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{u.name}</span>
                              {isMe && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
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
                          ? <span className="inline-flex items-center gap-1 text-green-700 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
                          : <span className="inline-flex items-center gap-1 text-gray-500 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{u.joined}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <Pencil size={15} />
                          </button>
                          {!isMe && (
                            <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Role Permission Matrix</h3>
            <p className="text-sm text-gray-500 mt-0.5">What each role can and cannot do</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
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
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-700">{row.feature}</td>
                  <td className="px-4 py-3.5 text-center"><Tick ok={row.admin} /></td>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Activity size={18} className="text-primary-600" />System Overview</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Application', value: 'CSMS v3.0' },
                { label: 'Framework', value: 'React 18 + Vite' },
                { label: 'Backend', value: 'Node.js / Express' },
                { label: 'Database', value: 'MongoDB' },
                { label: 'Auth', value: 'JWT Tokens' },
                { label: 'Mode', value: localStorage.getItem('demoEmail') ? '⚡ Demo (no backend)' : '🟢 Live' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary-600" />Module Status</h3>
            <div className="space-y-2 text-sm">
              {[
                { icon: Building2, label: 'Companies',  status: 'Active' },
                { icon: Calendar,  label: 'Meetings',   status: 'Active' },
                { icon: FileText,  label: 'Documents',  status: 'Active' },
                { icon: CheckSquare, label: 'Tasks',    status: 'Active' },
                { icon: Users,     label: 'User Mgmt',  status: 'Active' },
              ].map(({ icon: Icon, label, status }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-gray-700"><Icon size={15} className="text-gray-400" />{label}</div>
                  <span className="flex items-center gap-1 text-green-700 text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit User' : 'Add New User'} size="md">
        <UserForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} currentUserId={currentUser?._id} />
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
