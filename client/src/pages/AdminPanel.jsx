import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Library, Users, Shield, Settings, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Crown, Eye, UserCog, Mail,
  Activity, Building2, Calendar, FileText, CheckSquare,
  Loader2, ScrollText, Lock, ShieldCheck,
  CalendarClock, Upload, Save, RotateCcw, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { userService, companyService, auditService, scheduleService } from '../services/index.js'
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

// ─── 业绩排期规则库管理（Wave 1 — rules_editor 后端化）──────────────
// 规则库真源 = MongoDB `RuleLibrary` 单例（后端 server/services/timetableData.js 退化为种子）。
// 本面板支持：全量查看 / 单条任务启用·禁用 / 覆盖优先级 / 内联改偏移天数 / 上传规则文件整库导入。
const PERIOD_META = {
  interim: { label: '中期（Interim）', tasksKey: 'tasks_midyear', offsetsKey: 'offsets_midyear' },
  annual:  { label: '年度（Annual）',  tasksKey: 'tasks_annual',  offsetsKey: 'offsets_annual' },
}

const PRIORITY_OPTIONS = ['最高优', '高优', '中优', '低优']

const PRIORITY_COLOR = {
  '最高优': 'bg-danger/10 text-danger',
  '高优': 'bg-warning/10 text-warning',
  '中优': 'bg-info/10 text-primary-700',
  '低优': 'bg-canvas text-ink-2',
}

const _RuleStat = ({ label, value, tone = 'bg-canvas text-ink-2' }) => (
  <div className={`px-3 py-2 rounded-lg text-center min-w-[92px] ${tone}`}>
    <p className="text-base font-bold leading-none">{value}</p>
    <p className="text-[11px] opacity-75 mt-1">{label}</p>
  </div>
)

/** 任务绑定的偏移量 id 列表（point → 1 个；range → 起止各 1 个）。 */
const taskOffsetIds = (task) => {
  const ids = task?.type === 'range'
    ? [task.start_offset_id, task.end_offset_id].filter(Boolean)
    : [task?.offset_id].filter(Boolean)
  // 去重：区间任务起止绑定同一偏移量时，避免同一行渲染两个相同输入框（修复 D）
  return [...new Set(ids)]
}

/** 与后端 timetableEngine.resolveTaskRuleCode 同构：任务 → 规则代码。 */
const taskRuleCode = (task, offsetMap) => {
  if (task?.rule) return task.rule
  const ids = taskOffsetIds(task)
  for (const id of ids) {
    const off = offsetMap[id]
    if (off) return off.rule_code || off.rule || ''
  }
  return ''
}

const RulesLibraryManager = () => {
  const [lib, setLib] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tabPeriod, setTabPeriod] = useState('interim')
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'err', text }
  const fileRef = useRef(null)
  const [partyOpen, setPartyOpen] = useState(null)
  const [activeSection, setActiveSection] = useState('tasks-midyear')  // 当前激活的内容区 tab
  const [editing, setEditing] = useState(null)   // { kind:'rule'|'party'|'offset'|'task', period, idx, code/key, isNew }
  const [draft, setDraft] = useState(null)        // 弹窗编辑中的草稿对象

  const meta = PERIOD_META[tabPeriod]

  const load = async () => {
    setLoading(true)
    try {
      const res = await scheduleService.getRules()
      const data = res.data?.data || res.data || null
      setLib(data && typeof data === 'object' ? data : null)
      setDirty(false)
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '加载规则库失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const tasks = (lib && lib[meta.tasksKey]) || []
  const disabledCount = tasks.filter(t => t && t._disabled).length

  // 当前内容区内每条偏移量被多少任务引用（用于共享联动高亮提示）。
  // 必须放在早返回之前，遵守 Hooks 调用顺序恒定原则。
  const secOffsetRefCount = useMemo(() => {
    const list = activeSection === 'tasks-midyear'
      ? (lib?.tasks_midyear || [])
      : activeSection === 'tasks-annual'
        ? (lib?.tasks_annual || [])
        : []
    const c = {}
    list.forEach(t => {
      taskOffsetIds(t).forEach(id => { if (id) c[id] = (c[id] || 0) + 1 })
    })
    return c
  }, [lib, activeSection, tabPeriod])

  // ── 局部编辑（全部走不可变更新，保存时整库 PUT）──
  const patchTask = (index, patch) => {
    setLib(prev => {
      if (!prev) return prev
      const list = (prev[meta.tasksKey] || []).map((t, i) => (i === index ? { ...t, ...patch } : t))
      return { ...prev, [meta.tasksKey]: list }
    })
    setDirty(true)
  }

  const patchOffsetDays = (offsetId, rawDays) => {
    const days = Number(rawDays)
    if (Number.isNaN(days)) return
    setLib(prev => {
      if (!prev) return prev
      const list = (prev[meta.offsetsKey] || []).map(o => (o && o.id === offsetId ? { ...o, days } : o))
      return { ...prev, [meta.offsetsKey]: list }
    })
    setDirty(true)
  }

  // 参与方指派：维护「角色 → 实际机构」全局映射（如审计师 安永 / KPMG）
  const patchAssignment = (key, value) => {
    setLib(prev => {
      if (!prev) return prev
      return {
        ...prev,
        party_assignments: { ...(prev.party_assignments || {}), [key]: value },
      }
    })
    setDirty(true)
  }

  // 任务多参与方共担：在 parties 数组里增删角色，并同步单值 party 字段（向后兼容）
  const toggleTaskParty = (index, pk) => {
    setLib(prev => {
      if (!prev) return prev
      const list = (prev[meta.tasksKey] || []).map((t, i) => {
        if (i !== index) return t
        const cur = (Array.isArray(t.parties) && t.parties.length) ? t.parties : (t.party ? [t.party] : [])
        const next = cur.includes(pk) ? cur.filter(x => x !== pk) : [...cur, pk]
        return { ...t, parties: next, party: next[0] || t.party || '' }
      })
      return { ...prev, [meta.tasksKey]: list }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!lib) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await scheduleService.saveRules(lib)
      const data = res.data?.data || {}
      setDirty(false)
      setMsg({ type: 'ok', text: data.message || '规则库已保存到后端（MongoDB）' })
      // 保存成功后即时把后端返回的新 revision 回写状态，刷新「· 修订 vN」徽标，无需整页重载
      if (data && data.revision != null) setLib(prev => ({ ...prev, revision: data.revision }));
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setImporting(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await scheduleService.importRules(fd)
      const data = res.data?.data || {}
      const c = data.counts
      setMsg({
        type: 'ok',
        text: data.message
          || (c
            ? `导入成功：${file.name} — 规则 ${c.rules} / 中期偏移 ${c.offM} / 年度偏移 ${c.offA} / 中期任务 ${c.taskM} / 年度任务 ${c.taskA}`
            : `导入成功：${file.name}`),
      })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '导入失败' })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── 弹窗编辑器：打开 / 保存 / 关闭 ──
  // 规则条目（lib.rules 为对象，键即 id）
  const openRule = (code) => {
    const isNew = !code
    const base = isNew
      ? { id: '', source: '', category: '', text: '', interpretation: '', status: 'active', last_verified: '', steps_default: [] }
      : { ...(lib.rules[code] || {}) }
    setEditing({ kind: 'rule', code, isNew })
    setDraft(base)
  }
  // 参与方角色（lib.parties 为对象；指派值存于 lib.party_assignments）
  const openParty = (key) => {
    const isNew = !key
    const base = isNew
      ? { key: '', label: '', color: '#1565c0', description: '', assignment: '' }
      : {
          key,
          label: (lib.parties[key] || {}).label || '',
          color: (lib.parties[key] || {}).color || '#1565c0',
          description: (lib.parties[key] || {}).description || '',
          assignment: (lib.party_assignments || {})[key] || '',
        }
    setEditing({ kind: 'party', key, isNew })
    setDraft(base)
  }
  // 偏移量（按期间落在 offsets_midyear / offsets_annual 数组）
  const openOffset = (period, idx) => {
    const isNew = idx == null
    const list = period === 'midyear' ? lib.offsets_midyear : lib.offsets_annual
    const base = isNew
      ? { id: '', name: '', anchor: 'T1', days: 0, rule_code: '', status: 'active', last_verified: '' }
      : { ...(list[idx] || {}) }
    setEditing({ kind: 'offset', period, idx, isNew })
    setDraft(base)
  }
  // 任务（按期间落在 tasks_midyear / tasks_annual 数组；parties 数组 + party 单值兼容）
  const openTask = (period, idx) => {
    const isNew = idx == null
    const list = period === 'midyear' ? lib.tasks_midyear : lib.tasks_annual
    const base = isNew
      ? { id: '', category: '业绩公告', name: '', details: [], parties: [], priority: '中优', status: 'active', type: 'point', offset_id: '', start_offset_id: '', end_offset_id: '' }
      : { ...(list[idx] || {}), parties: (list[idx] || {}).parties || ((list[idx] || {}).party ? [(list[idx] || {}).party] : []) }
    setEditing({ kind: 'task', period, idx, isNew })
    setDraft(base)
  }
  const closeEditor = () => { setEditing(null); setDraft(null) }
  const saveEditor = () => {
    const d = draft
    const ed = editing
    if (!d) return
    setLib(prev => {
      if (!prev) return prev
      if (ed.kind === 'rule') {
        if (!d.id) return prev
        return { ...prev, rules: { ...prev.rules, [d.id]: { ...d } } }
      }
      if (ed.kind === 'party') {
        if (!d.key) return prev
        const parties = { ...prev.parties, [d.key]: { label: d.label, color: d.color || '#1565c0', description: d.description || '' } }
        const party_assignments = { ...(prev.party_assignments || {}), [d.key]: d.assignment || '' }
        return { ...prev, parties, party_assignments }
      }
      if (ed.kind === 'offset') {
        const key = ed.period === 'midyear' ? 'offsets_midyear' : 'offsets_annual'
        const list = (prev[key] || []).map(x => ({ ...x }))
        const item = { id: d.id, name: d.name, anchor: d.anchor, days: Number(d.days) || 0, rule_code: d.rule_code || '', status: d.status || 'active', last_verified: d.last_verified || '' }
        if (ed.isNew) list.push(item); else list[ed.idx] = item
        return { ...prev, [key]: list }
      }
      if (ed.kind === 'task') {
        const key = ed.period === 'midyear' ? 'tasks_midyear' : 'tasks_annual'
        const list = (prev[key] || []).map(x => ({ ...x }))
        const parties = d.parties || []
        const item = {
          id: d.id, category: d.category || '', name: d.name, details: d.details || [],
          party: parties[0] || d.party || '', parties, priority: d.priority || '中优',
          status: d.status || 'active', type: d.type || 'point', last_verified: d.last_verified || '',
        }
        if (d.type === 'range') { item.start_offset_id = d.start_offset_id; item.end_offset_id = d.end_offset_id }
        else { item.offset_id = d.offset_id }
        if (ed.isNew) list.push(item); else list[ed.idx] = item
        return { ...prev, [key]: list }
      }
      return prev
    })
    setDirty(true)
    closeEditor()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-3">
        <Loader2 className="animate-spin mr-2" size={18} /> 加载规则库…
      </div>
    )
  }

  if (!lib) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-ink-3">
        <AlertTriangle size={40} className="mb-3 opacity-40" />
        <p className="text-sm">规则库为空或加载失败</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">重试</button>
      </div>
    )
  }

  // ── Tab 定义 ──
  const ruleCount = Object.keys(lib.rules || {}).length
  const partyCount = Object.keys(lib.parties || {}).length
  const offMCount = (lib.offsets_midyear || []).length
  const offACount = (lib.offsets_annual || []).length
  const taskMCount = (lib.tasks_midyear || []).length
  const taskACount = (lib.tasks_annual || []).length

  const tabs = [
    { id: 'rules', label: '规则条目', value: ruleCount, tone: 'bg-info/10 text-primary-700' },
    { id: 'parties', label: '参与方', value: partyCount },
    { id: 'offsets-midyear', label: '中期偏移', value: offMCount },
    { id: 'offsets-annual', label: '年度偏移', value: offACount },
    { id: 'tasks-midyear', label: '中期任务', value: taskMCount, tone: 'bg-success/10 text-success' },
    { id: 'tasks-annual', label: '年度任务', value: taskACount, tone: 'bg-success/10 text-success' },
    { id: 'disabled', label: '已禁用', value: disabledCount, tone: disabledCount ? 'bg-warning/10 text-warning' : 'bg-canvas text-ink-2' },
  ]

  // 点击 tab 时自动联动期间切换
  const switchSection = (id) => {
    setActiveSection(id)
    if (id.startsWith('tasks-') || id.startsWith('offsets-')) {
      const p = id.replace(/^(tasks|offsets)-/, '')
      // p 可能是 'midyear'/'annual'，但 PERIOD_META 键是 'interim'/'annual'
      const periodKey = p === 'midyear' ? 'interim' : p
      if (periodKey === 'interim' || periodKey === 'annual') setTabPeriod(periodKey)
    }
  }

  // 当前内容区对应的 meta（仅 tasks/offsets tab 需要）
  const sectionMeta = activeSection.startsWith('tasks-') || activeSection.startsWith('offsets-')
    ? PERIOD_META[tabPeriod] : null
  const sectionTasks = (activeSection === 'tasks-midyear' ? lib.tasks_midyear : activeSection === 'tasks-annual' ? lib.tasks_annual : []) || []
  const sectionOffsets = (activeSection === 'offsets-midyear' ? lib.offsets_midyear : activeSection === 'offsets-annual' ? lib.offsets_annual : []) || []
  const _sectionOffsetsKey = activeSection === 'offsets-midyear' ? 'offsets_midyear' : activeSection === 'offsets-annual' ? 'offsets_annual' : null

  // 为当前任务区构建 offsetMap / disabledCount
  const secOffsetMap = {}
  ;(sectionOffsets || []).forEach(o => { secOffsetMap[o.id] = o })
  const secDisabledCount = (sectionTasks || []).filter(t => t._disabled).length

  return (
    <div className="space-y-4">
      {/* ═══ 顶部操作栏（始终可见）════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab 导航栏 */}
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchSection(t.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                activeSection === t.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : `${t.tone || 'bg-surface text-ink-2'} border-hairline hover:bg-canvas hover:border-primary-200`
              }`}
            >
              {t.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeSection === t.id ? 'bg-white/20' : 'bg-black/5'
              }`}>
                {t.value}
              </span>
            </button>
          ))}
        </div>

        {/* 操作按钮组 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3 mr-1">
            版本 {lib.version || lib.meta?.version || '—'}
            {lib.revision != null && <span className="ml-1">· 修订 v{lib.revision}</span>}
          </span>
          <input ref={fileRef} type="file" accept=".js,.json" onChange={handleImport} className="hidden" />
          <button onClick={() => fileRef.current && fileRef.current.click()} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink disabled:opacity-50">
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? '导入中…' : '导入规则文件'}
          </button>
          <button onClick={load} disabled={saving || importing}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink disabled:opacity-50">
            <RotateCcw size={15} /> 放弃修改
          </button>
          <button onClick={handleSave} disabled={saving || !dirty}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? '保存中…' : dirty ? '保存修改' : '无修改'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {msg.text}
        </div>
      )}

      {/* ═══ 内容区：按 tab 切换 ════ */}

      {/* ─── 规则条目 ─── */}
      {activeSection === 'rules' && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
            <Library size={16} className="text-primary-600" />
            <h3 className="font-semibold text-ink text-sm">规则条目（{ruleCount} 个）</h3>
            <button onClick={() => openRule(null)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700">
              <Plus size={14} /> 新增规则
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b border-hairline">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-28">规则编码</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-32">出处</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-24">类别</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">条文原文</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">解读</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-16">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(lib.rules || {}).map(([code, r]) => (
                  <tr key={code} onClick={() => openRule(code)} className="hover:bg-canvas cursor-pointer">
                    <td className="px-4 py-2 text-ink font-mono text-xs">{code}</td>
                    <td className="px-4 py-2 text-ink-2 text-xs">{r.source || '—'}</td>
                    <td className="px-4 py-2 text-ink-2 text-xs">{r.category || '—'}</td>
                    <td className="px-4 py-2 text-ink-2 text-xs max-w-[260px] truncate" title={r.text}>{r.text || '—'}</td>
                    <td className="px-4 py-2 text-ink-2 text-xs max-w-[200px] truncate" title={r.interpretation}>{r.interpretation || '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${r.status === 'active' ? 'bg-success/10 text-success' : r.status === 'deprecated' ? 'bg-danger/10 text-danger' : 'bg-canvas text-ink-2'}`}>{r.status || 'active'}</span>
                    </td>
                  </tr>
                ))}
                {ruleCount === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-3">暂无规则定义</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 参与方指派 ─── */}
      {activeSection === 'parties' && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-primary-600" />
            <h3 className="font-semibold text-ink text-sm">参与方指派（全局）</h3>
            <button onClick={() => openParty(null)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700">
              <Plus size={14} /> 新增参与方
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(lib.parties || {}).map(([key, p]) => (
              <div key={key} className="flex items-center gap-2 text-sm border border-hairline rounded-lg px-2.5 py-1.5">
                <span className="w-24 shrink-0 text-ink-2 flex items-center gap-1.5 truncate" title={p.description || p.label}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || '#999' }} />
                  {p.label}
                </span>
                <input
                  type="text"
                  value={(lib.party_assignments && lib.party_assignments[key]) || ''}
                  onChange={e => patchAssignment(key, e.target.value)}
                  placeholder="未指派（生成时回退角色名）"
                  className="flex-1 min-w-0 px-2 py-1 border border-hairline rounded-md text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button onClick={() => openParty(key)} className="p-1 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded shrink-0" title="编辑角色">
                  <Pencil size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 偏移量列表（可编辑）─── */}
      {(activeSection === 'offsets-midyear' || activeSection === 'offsets-annual') && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
            <CalendarClock size={16} className="text-primary-600" />
            <h3 className="font-semibold text-ink text-sm">{sectionMeta?.label || ''} 偏移量（{sectionOffsets.length} 个）</h3>
            <button onClick={() => openOffset(activeSection === 'offsets-midyear' ? 'midyear' : 'annual', null)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700">
              <Plus size={14} /> 新增偏移量
            </button>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b border-hairline sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide">偏移量</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide w-20">锚点</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide w-24">天数</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide">规则出处</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide w-24">被引用</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide w-12">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sectionOffsets.map((o, i) => {
                  const refN = secOffsetRefCount[o.id] || 0
                  return (
                  <tr key={`${o.id || 'off'}-${i}`} className={`hover:bg-canvas ${refN === 0 ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-2 text-ink">{o.name || o.id}</td>
                    <td className="px-4 py-2 text-ink-2 text-xs">{o.anchor}</td>
                    <td className="px-4 py-2">
                      <input type="number" value={o.days}
                        onChange={e => patchOffsetDays(o.id, e.target.value)}
                        className="w-20 px-2 py-1 border border-hairline rounded-md text-xs text-right focus:ring-2 focus:ring-primary-500" />
                      <span className="text-[11px] text-ink-3 ml-1">天</span>
                    </td>
                    <td className="px-4 py-2 text-ink-2 text-xs">{(lib.rules || {})[o.rule_code]?.source || o.rule_code || '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      {refN > 0 ? <span className={refN > 1 ? 'text-warning font-medium' : 'text-ink-2'}>{refN} 条</span>
                        : <span className="text-ink-3">未引用</span>}
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => openOffset(activeSection === 'offsets-midyear' ? 'midyear' : 'annual', i)} className="p-1 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded" title="编辑">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 任务表 ─── */}
      {(activeSection === 'tasks-midyear' || activeSection === 'tasks-annual') && (
          <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
              <CalendarClock size={16} className="text-primary-600" />
              <h3 className="font-semibold text-ink text-sm">{sectionMeta?.label || ''} 任务（{sectionTasks.length} 条）</h3>
              <button onClick={() => openTask(activeSection === 'tasks-midyear' ? 'midyear' : 'annual', null)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700">
                <Plus size={14} /> 新增任务
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas border-b border-hairline">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide w-16">启用</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">大类</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">任务名称</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">规则出处</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">负责人</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide w-28">优先级</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">偏移量 / 天数</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide w-12">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sectionTasks.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-3">该期间暂无任务定义</td></tr>
                  ) : sectionTasks.map((t, i) => {
                    const enabled = !t._disabled
                    const code = taskRuleCode(t, secOffsetMap)
                    const ruleSrc = (lib.rules || {})[code]?.source || code || '—'
                    const ids = taskOffsetIds(t)
                    return (
                    <tr key={`${t.id || 'task'}-${i}`} className={`hover:bg-canvas transition-colors ${enabled ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={enabled} onChange={() => patchTask(i, { _disabled: enabled })}
                          title={enabled ? '点击禁用该任务' : '点击启用该任务'} />
                      </td>
                      <td className="px-4 py-3 text-ink-2 text-xs whitespace-nowrap">{t.category || '—'}</td>
                      <td className="px-4 py-3 text-ink">
                        <div className="font-medium">{t.name || '—'}</div>
                        <div className="text-[11px] text-ink-3 mt-0.5">{t.id} · {t.type === 'range' ? '区间' : '时点'}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2 text-xs">{ruleSrc}</td>
                      <td className="px-4 py-3 text-ink-2 text-xs min-w-[140px]">
                        {(() => {
                          const cur = (Array.isArray(t.parties) && t.parties.length) ? t.parties : (t.party ? [t.party] : [])
                          const labels = cur.map(pk => (lib.parties[pk] || {}).label || pk)
                          const triggerText = cur.length ? (labels.length <= 2 ? labels.join(' + ') : `已选 ${cur.length} 个`) : '点击选择'
                          return (
                            <div className="relative">
                              <button type="button" onClick={() => setPartyOpen(partyOpen === i ? null : i)}
                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-hairline bg-white text-[11px] text-ink hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                                title={cur.length ? labels.join(', ') : '选择参与方'}>
                                <span className={`truncate ${cur.length ? 'text-ink font-medium' : 'text-ink-3'}`}>{triggerText}</span>
                                <svg className="w-3 h-3 text-ink-3 shrink-0 transition-transform" style={{ transform: partyOpen === i ? 'rotate(180deg)' : 'none' }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4"/></svg>
                              </button>
                              {partyOpen === i && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setPartyOpen(null)} />
                                  <div className="absolute z-20 mt-1 w-52 rounded-lg border border-hairline bg-white shadow-lg max-h-[240px] overflow-y-auto">
                                    <div className="px-2.5 py-1.5 text-[10px] font-semibold text-ink-3 uppercase tracking-wider border-b border-gray-100 sticky top-0 bg-white">参与方（可多选）</div>
                                    {Object.entries(lib.parties || {}).map(([pk, p]) => {
                                      const sel = cur.includes(pk)
                                      return (<label key={pk} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-primary-50/60 transition-colors ${sel ? 'bg-primary-50/40' : ''}`}>
                                        <input type="checkbox" checked={sel} onChange={() => toggleTaskParty(i, pk)}
                                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5" />
                                        <span className={`text-[11px] flex-1 ${sel ? 'text-ink font-medium' : 'text-ink-2'}`}>{p.label || pk}</span>
                                        {sel && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />}
                                      </label>)
                                    })}
                                    {cur.length > 1 && (<>
                                      <div className="border-t border-gray-100 my-1" />
                                      <div className="px-2.5 py-1"><div className="text-[10px] text-ink-3 mb-1">主负责人</div>
                                        <select value={t.owner || cur[0]} onChange={e => { patchTask(i, { owner: e.target.value }) }}
                                          className="w-full px-2 py-1 rounded border border-hairline text-[11px] bg-white focus:ring-1 focus:ring-primary-500">
                                          {cur.map(pk => <option key={pk} value={pk}>{(lib.parties[pk] || {}).label || pk}</option>)}
                                        </select>
                                      </div>
                                    </>)}
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <select value={PRIORITY_OPTIONS.includes(t.priority) ? t.priority : '中优'}
                          onChange={e => patchTask(i, { priority: e.target.value })}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-primary-500 ${PRIORITY_COLOR[t.priority] || PRIORITY_COLOR['中优']}`}>
                          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {ids.length === 0 ? (<span className="text-xs text-ink-3">未绑定偏移量</span>) : (
                          <div className="space-y-1">
                            {ids.map((oid, k) => {
                              const off = secOffsetMap[oid]
                              return (<div key={`${oid}-${k}`} className="flex items-center gap-2">
                                <span className="text-xs text-ink-2 min-w-[150px] truncate" title={oid}>{off ? off.name : oid}</span>
                                <span className="text-[11px] text-ink-3">{off ? off.anchor : '?'}</span>
                                <input type="number" value={off ? off.days : 0} disabled={!off}
                                  onChange={e => patchOffsetDays(oid, e.target.value)}
                                  className="w-20 px-2 py-1 border border-hairline rounded-md text-xs text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-canvas" />
                                <span className="text-[11px] text-ink-3">天</span>
                                {secOffsetRefCount[oid] > 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30 whitespace-nowrap"
                                    title={`该偏移量被 ${secOffsetRefCount[oid]} 条任务共用，修改将同步影响所有这些任务的排期日期`}>
                                    共用·影响{secOffsetRefCount[oid]}条
                                  </span>
                                )}
                              </div>)
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openTask(activeSection === 'tasks-midyear' ? 'midyear' : 'annual', i)} className="p-1 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded" title="编辑">
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* ─── 已禁用任务 ─── */}
      {activeSection === 'disabled' && (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
            <XCircle size={16} className="text-warning" />
            <h3 className="font-semibold text-ink text-sm">已禁用任务（{secDisabledCount} 条）</h3>
            <span className="ml-auto text-[11px] text-ink-3">被禁用的任务不会参与排期生成。点击「启用」复选框可重新激活。</span>
          </div>
          {secDisabledCount === 0 ? (
            <div className="px-5 py-10 text-center text-ink-3 text-sm">暂无已禁用任务</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas border-b border-hairline sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-16">启用</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">期间</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">大类</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">任务名称</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...(lib.tasks_midyear || []), ...(lib.tasks_annual || [])].filter(t => t._disabled).map((t, i) => {
                    const isMid = (lib.tasks_midyear || []).includes(t)
                    const _idxInPeriod = (isMid ? lib.tasks_midyear : lib.tasks_annual).indexOf(t)
                    return (
                    <tr key={`dis-${i}`} className="hover:bg-canvas opacity-60">
                      <td className="px-4 py-2 text-center">
                        <input type="checkbox" checked={false} onChange={() => {
                          // 找到正确的索引来 patch
                          const arr = isMid ? 'tasks_midyear' : 'tasks_annual'
                          const list = lib[arr]
                          const realIdx = list.indexOf(t)
                          if (realIdx >= 0) {
                            // 需要切到正确期间再 patch
                            const _oldPeriod = tabPeriod
                            setTabPeriod(isMid ? 'interim' : 'annual')
                            setTimeout(() => patchTask(realIdx, { _disabled: false }), 0)
                          }
                        }} title="点击启用该任务" />
                      </td>
                      <td className="px-4 py-2 text-xs text-ink-2">{isMid ? '中期' : '年度'}</td>
                      <td className="px-4 py-2 text-xs text-ink-2">{t.category || '—'}</td>
                      <td className="px-4 py-2 text-ink text-xs font-medium">{t.name || t.id || '—'}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── 弹窗编辑器 ─── */}
      {editing && (
        <RuleItemEditor
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          onClose={closeEditor}
          onSave={saveEditor}
          lib={lib}
        />
      )}
    </div>
  )
}

// ─── 规则库条目编辑器（弹窗）─────────────────────────────────────
/** 步骤 / 明细 列表编辑器：可增删。 */
const StepsEditor = ({ items = [], onChange, label = '步骤', addLabel = '＋ 新增步骤' }) => {
  const update = (i, v) => onChange(items.map((s, idx) => (idx === i ? v : s)))
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, ''])
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-2">{label}</span>
        <button type="button" onClick={add} className="text-xs px-2 py-1 rounded border border-primary-300 text-primary-600 hover:bg-primary-50">{addLabel}</button>
      </div>
      {items.length === 0 && <p className="text-xs text-ink-3">暂无{label}</p>}
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 h-5 shrink-0 rounded-full bg-primary-600 text-white text-[11px] flex items-center justify-center">{i + 1}</span>
          <input type="text" value={s} onChange={(e) => update(i, e.target.value)} className="flex-1 px-2 py-1 border border-hairline rounded-md text-sm focus:ring-2 focus:ring-primary-500" />
          <button type="button" onClick={() => remove(i)} className="p-1 text-danger hover:bg-danger/10 rounded"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

const RuleItemEditor = ({ editing, draft, setDraft, onClose, onSave, lib }) => {
  if (!editing || !draft) return null
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const kind = editing.kind
  const isNew = editing.isNew
  const period = editing.period

  // 校验
  let valid = true
  if (kind === 'rule') valid = !!draft.id && !!draft.text
  else if (kind === 'party') valid = !!draft.key && !!draft.label
  else if (kind === 'offset') valid = !!draft.id && !!draft.name
  else if (kind === 'task') valid = !!draft.id && !!draft.name

  // 数据源
  const offsetList = period === 'midyear' ? (lib.offsets_midyear || []) : period === 'annual' ? (lib.offsets_annual || []) : []
  const ruleEntries = Object.entries(lib.rules || {})
  const partyEntries = Object.entries(lib.parties || {})
  const TASK_CATS = ['业绩公告', '中期业绩', '年报ESG', '董事会', '审核委员会', '董事合规', 'AGM', '关连交易', 'ESG', '内幕消息', '停牌', '印刷']
  const existingCats = new Set()
  ;(lib.tasks_midyear || []).concat(lib.tasks_annual || []).forEach((t) => { if (t.category) existingCats.add(t.category) })
  const allCats = [...new Set([...TASK_CATS, ...existingCats])]

  // 联动展示：偏移量 / 任务 选中的规则原文 + 解读
  let linkedRule = null
  if (kind === 'offset') linkedRule = (lib.rules || {})[draft.rule_code]
  if (kind === 'task') {
    const offId = draft.type === 'range' ? (draft.start_offset_id || draft.end_offset_id) : draft.offset_id
    const off = offsetList.find((o) => o.id === offId)
    if (off) linkedRule = (lib.rules || {})[off.rule_code]
  }

  const titleMap = {
    rule: isNew ? '新增规则' : `编辑规则 · ${draft.id}`,
    party: isNew ? '新增参与方' : `编辑参与方 · ${draft.key}`,
    offset: isNew ? '新增偏移量' : `编辑偏移量 · ${draft.id}`,
    task: isNew ? '新增任务' : `编辑任务 · ${draft.id}`,
  }

  const LinkedRuleBox = linkedRule ? (
    <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-3 text-xs space-y-1">
      <p className="font-semibold text-primary-700">{linkedRule.source}</p>
      <p className="text-ink-2">原文：{linkedRule.text}</p>
      <p className="text-ink-2">解读：{linkedRule.interpretation}</p>
    </div>
  ) : null

  return (
    <Modal isOpen title={titleMap[kind]} size={kind === 'rule' || kind === 'task' ? 'xl' : 'lg'}>
      <div className="space-y-4">
        {/* 规则 */}
        {kind === 'rule' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>规则编码 *</label>
                <input value={draft.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} className={`${inputClass} ${!isNew ? 'bg-canvas' : ''}`} placeholder="如 LR13.48" />
              </div>
              <div>
                <label className={labelClass}>出处 (source)</label>
                <input value={draft.source || ''} onChange={(e) => set({ source: e.target.value })} className={inputClass} placeholder="如 上市规则 13.48" />
              </div>
            </div>
            <div>
              <label className={labelClass}>类别</label>
              <input value={draft.category || ''} onChange={(e) => set({ category: e.target.value })} className={inputClass} placeholder="如 时间窗口" />
            </div>
            <div>
              <label className={labelClass}>条文原文 *</label>
              <textarea value={draft.text || ''} onChange={(e) => set({ text: e.target.value })} rows={3} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>解读</label>
              <textarea value={draft.interpretation || ''} onChange={(e) => set({ interpretation: e.target.value })} rows={3} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>状态</label>
              <select value={draft.status || 'active'} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                <option value="active">active</option><option value="draft">draft</option><option value="deprecated">deprecated</option>
              </select>
            </div>
            <StepsEditor label="默认操作步骤" items={draft.steps_default || []} onChange={(v) => set({ steps_default: v })} />
          </>
        )}

        {/* 参与方 */}
        {kind === 'party' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>角色键 (key) *</label>
                <input value={draft.key} disabled={!isNew} onChange={(e) => set({ key: e.target.value })} className={`${inputClass} ${!isNew ? 'bg-canvas' : ''}`} placeholder="如 esg_team" />
              </div>
              <div>
                <label className={labelClass}>显示名 (label) *</label>
                <input value={draft.label || ''} onChange={(e) => set({ label: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>颜色</label>
                <input type="color" value={draft.color || '#1565c0'} onChange={(e) => set({ color: e.target.value })} className="w-12 h-9 border border-hairline rounded-md" />
              </div>
              <div>
                <label className={labelClass}>实际机构指派</label>
                <input value={draft.assignment || ''} onChange={(e) => set({ assignment: e.target.value })} className={inputClass} placeholder="如 安永会计师事务所" />
              </div>
            </div>
            <div>
              <label className={labelClass}>描述</label>
              <input value={draft.description || ''} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
            </div>
          </>
        )}

        {/* 偏移量 */}
        {kind === 'offset' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>偏移量 ID *</label>
                <input value={draft.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} className={`${inputClass} ${!isNew ? 'bg-canvas' : ''}`} placeholder="如 MY_blackout" />
              </div>
              <div>
                <label className={labelClass}>锚点</label>
                <select value={draft.anchor || 'T1'} onChange={(e) => set({ anchor: e.target.value })} className={inputClass}>
                  {['T0', 'T1', 'T2', 'T3'].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>名称 *</label>
              <input value={draft.name || ''} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>天数偏移</label>
                <input type="number" value={draft.days ?? 0} onChange={(e) => set({ days: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>引用规则</label>
                <select value={draft.rule_code || ''} onChange={(e) => set({ rule_code: e.target.value })} className={inputClass}>
                  <option value="">— 请选择 —</option>
                  {ruleEntries.map(([code, r]) => <option key={code} value={code}>{r.source || code}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>状态</label>
              <select value={draft.status || 'active'} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                <option value="active">active</option><option value="draft">draft</option><option value="deprecated">deprecated</option>
              </select>
            </div>
            {LinkedRuleBox}
          </>
        )}

        {/* 任务 */}
        {kind === 'task' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>任务 ID *</label>
                <input value={draft.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} className={`${inputClass} ${!isNew ? 'bg-canvas' : ''}`} placeholder="如 blackout_task" />
              </div>
              <div>
                <label className={labelClass}>类别</label>
                <select value={draft.category || ''} onChange={(e) => set({ category: e.target.value })} className={inputClass}>
                  {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>任务名称 *</label>
              <input value={draft.name || ''} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>类型</label>
                <select value={draft.type || 'point'} onChange={(e) => set({ type: e.target.value })} className={inputClass}>
                  <option value="point">时点</option><option value="range">区间(起→止)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>优先级</label>
                <select value={draft.priority || '中优'} onChange={(e) => set({ priority: e.target.value })} className={inputClass}>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {draft.type === 'range' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>起始偏移量</label>
                  <select value={draft.start_offset_id || ''} onChange={(e) => set({ start_offset_id: e.target.value })} className={inputClass}>
                    <option value="">— 请选择 —</option>
                    {offsetList.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.anchor}{o.days >= 0 ? '+' : ''}{o.days})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>结束偏移量</label>
                  <select value={draft.end_offset_id || ''} onChange={(e) => set({ end_offset_id: e.target.value })} className={inputClass}>
                    <option value="">— 请选择 —</option>
                    {offsetList.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.anchor}{o.days >= 0 ? '+' : ''}{o.days})</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>偏移量</label>
                <select value={draft.offset_id || ''} onChange={(e) => set({ offset_id: e.target.value })} className={inputClass}>
                  <option value="">— 请选择 —</option>
                  {offsetList.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.anchor}{o.days >= 0 ? '+' : ''}{o.days})</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>负责人（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {partyEntries.map(([pk, p]) => {
                  const sel = (draft.parties || []).includes(pk)
                  return (
                    <label key={pk} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer ${sel ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-hairline text-ink-2'}`}>
                      <input type="checkbox" checked={sel} onChange={() => set({ parties: sel ? (draft.parties || []).filter((x) => x !== pk) : [...(draft.parties || []), pk] })} className="rounded border-gray-300 text-primary-600" />
                      {p.label || pk}
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <label className={labelClass}>状态</label>
              <select value={draft.status || 'active'} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                <option value="active">active</option><option value="draft">draft</option><option value="deprecated">deprecated</option>
              </select>
            </div>
            <StepsEditor label="操作步骤" items={draft.details || []} onChange={(v) => set({ details: v })} />
            {LinkedRuleBox}
          </>
        )}

        {/* 底部操作 */}
        <div className="flex justify-end gap-3 pt-2 border-t border-hairline">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">取消</button>
          <button type="button" disabled={!valid} onClick={onSave} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">保存</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Component ───────────────────────────────────────────────
const AdminPanel = () => {
  const { user: currentUser, isAdmin, applyScopeUpdate } = useAuth()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab')
    // 仅管理员可见「业绩排期规则库」；非管理员深链到该 tab 时回退到默认 tab
    if (fromUrl === 'rules' && !isAdmin) return 'audit'
    return fromUrl || (isAdmin ? 'users' : 'audit')
  })
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
      // 改的是自己 → 立即同步登录态，页面无声过滤即时生效（免重新登录）
      applyScopeUpdate(scopeUserId, scopeSel)
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
      { id: 'rules', label: '业绩排期规则库', icon: CalendarClock },
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

      {/* ── RESULTS TIMETABLE RULE LIBRARY (Wave 1) ── */}
      {tab === 'rules' && isAdmin && <RulesLibraryManager />}

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
