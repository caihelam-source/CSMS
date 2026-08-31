// 管理后台（AdminPanel）各 Tab 共享的纯常量 / 纯函数 / 小组件。
// 从原 AdminPanel.jsx 抽出，避免拆分后重复定义；D1 等价重构，逻辑/样式不变。
import { useState } from 'react'
import {
  Crown, ShieldCheck, UserCog, Eye, CheckCircle, XCircle,
} from 'lucide-react'
import { validate, required, minLength } from '../../utils/validators'
import { inputClass, labelClass, FormField } from '../../components/UIHelpers'

// ── 用户表单 ──────────────────────────────────────────────────────
export const USER_FORM_RULES = {
  name: [required('姓名为必填')],
  email: [required('邮箱为必填'), minLength(6, '邮箱至少6位')],
  password: [minLength(8, '密码至少8位')],
}

// 角色定义（5 角色 RBAC，与后端一致；rev2 新增 auditor）
export const ROLES = [
  { value: 'admin',    label: 'Admin',    icon: Crown,   desc: 'Full access — can manage users, edit & delete anything',   color: 'bg-danger/10 text-danger' },
  { value: 'auditor',  label: 'Auditor',  icon: ShieldCheck, desc: 'Read-only across all companies — for compliance audit', color: 'bg-warning/10 text-warning' },
  { value: 'secretary',label: 'Secretary',icon: UserCog, desc: 'Can create & edit records and upload documents',            color: 'bg-info/10 text-primary-700' },
  { value: 'manager',  label: 'Manager',  icon: UserCog, desc: 'Can create & edit records, cannot manage users or delete',  color: 'bg-info/10 text-primary-700' },
  { value: 'viewer',   label: 'Viewer',   icon: Eye,     desc: 'Read-only access — cannot create, edit, or delete',         color: 'bg-canvas text-ink-2' },
]

export const roleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3]

// 后端用户 → 前端展示模型
export const normalizeUser = (u) => ({
  id: u._id || u.id,
  name: u.name,
  email: u.email,
  role: u.role || 'viewer',
  status: u.isActive === false ? 'inactive' : 'active',
  joined: u.joined || (u.createdAt ? String(u.createdAt).slice(0, 10) : '—'),
})

export const UserForm = ({ initial = {}, onSave, onCancel, loading, currentUserId }) => {
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

// ── 权限矩阵 ──────────────────────────────────────────────────────
export const PERM_MATRIX = [
  { feature: 'View Dashboard & Reports', admin: true,  auditor: true,  secretary: true,  manager: true,  viewer: true  },
  { feature: 'View Companies / Meetings / Documents / Tasks', admin: true, auditor: true, secretary: true, manager: true, viewer: true },
  { feature: 'Create & Edit Records', admin: true,  auditor: false, secretary: true,  manager: true,  viewer: false },
  { feature: 'Delete Records',         admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
  { feature: 'Upload Documents',       admin: true,  auditor: false, secretary: true,  manager: true,  viewer: false },
  { feature: 'Manage Users',           admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
  { feature: 'Access Admin Panel',     admin: true,  auditor: false, secretary: false, manager: false, viewer: false },
]

export const Tick = ({ ok }) => ok
  ? <CheckCircle size={18} className="text-success" />
  : <XCircle size={18} className="text-ink-3" />

// ── Stats banner ─────────────────────────────────────────────────
export const StatBadge = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color}`}>
    <Icon size={20} />
    <div>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
    </div>
  </div>
)

// ── 业绩排期规则库（共享常量 / 纯函数）───────────────────────────
export const PERIOD_META = {
  interim: { label: '中期（Interim）', tasksKey: 'tasks_midyear', offsetsKey: 'offsets_midyear' },
  annual:  { label: '年度（Annual）',  tasksKey: 'tasks_annual',  offsetsKey: 'offsets_annual' },
}

export const PRIORITY_OPTIONS = ['最高优', '高优', '中优', '低优']

export const PRIORITY_COLOR = {
  '最高优': 'bg-danger/10 text-danger',
  '高优': 'bg-warning/10 text-warning',
  '中优': 'bg-info/10 text-primary-700',
  '低优': 'bg-canvas text-ink-2',
}

/** 任务绑定的偏移量 id 列表（point → 1 个；range → 起止各 1 个）。 */
export const taskOffsetIds = (task) => {
  const ids = task?.type === 'range'
    ? [task.start_offset_id, task.end_offset_id].filter(Boolean)
    : [task?.offset_id].filter(Boolean)
  // 去重：区间任务起止绑定同一偏移量时，避免同一行渲染两个相同输入框（修复 D）
  return [...new Set(ids)]
}

/** 与后端 timetableEngine.resolveTaskRuleCode 同构：任务 → 规则代码。 */
export const taskRuleCode = (task, offsetMap) => {
  if (task?.rule) return task.rule
  const ids = taskOffsetIds(task)
  for (const id of ids) {
    const off = offsetMap[id]
    if (off) return off.rule_code || off.rule || ''
  }
  return ''
}
