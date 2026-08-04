import { useState, useEffect, useMemo } from 'react'
import { companyService, meetingService } from '../services/index.js'
import { fmtDateShort } from '../utils/helpers'
import { FormField, inputClass, labelClass } from '../components/UIHelpers'
import { validate, required } from '../utils/validators'

// 任务表单共享常量（Tasks 页与公司工作台复用，单一事实源）
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue']
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const TASK_TYPES = ['filing', 'compliance', 'meeting_prep', 'document', 'follow_up', 'other']

const TASK_FORM_RULES = {
  title: [required('Task title is required')],
  dueDate: [required('Due date is required')],
}

// 共享任务创建/编辑表单。公司工作台复用此组件并预填 company，避免重复实现（UX 重构 B3）
export default function TaskForm({ initial = {}, onSave, onCancel, loading, users = [] }) {
  const firstIdOf = (ref) => {
    if (!ref) return ''
    const arr = Array.isArray(ref) ? ref : [ref]
    const first = arr[0]
    if (!first) return ''
    return typeof first === 'object' ? first._id || '' : String(first)
  }
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    type: initial.type || 'other',
    priority: initial.priority || 'medium',
    status: initial.status || 'pending',
    dueDate: initial.dueDate ? fmtDateShort(initial.dueDate) : '',
    company: firstIdOf(initial.company),
    meeting: firstIdOf(initial.meeting),
    assignedTo: firstIdOf(initial.assignedTo),
  })
  const [errors, setErrors] = useState({})
  const [options, setOptions] = useState({ companies: [], meetings: [] })
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [coRes, mtRes] = await Promise.all([
          companyService.getAll().catch(() => ({ data: { data: [] } })),
          meetingService.getAll().catch(() => ({ data: { data: [] } })),
        ])
        if (!cancelled) {
          setOptions({
            companies: coRes.data?.data || [],
            meetings: mtRes.data?.data?.data || mtRes.data?.data || [],
          })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 当公司变化时，过滤会议选项；若当前所选会议不属于新公司，则清空
  useEffect(() => {
    if (!form.company) return
    const belongs = options.meetings.some(m => m._id === form.meeting && (m.company?._id === form.company || m.company === form.company))
    if (form.meeting && !belongs) {
      setForm(f => ({ ...f, meeting: '' }))
    }
  }, [form.company, options.meetings])

  const visibleMeetings = useMemo(() => {
    if (!form.company) return options.meetings
    return options.meetings.filter(m => m.company?._id === form.company || m.company === form.company)
  }, [form.company, options.meetings])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, TASK_FORM_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    const payload = {
      ...form,
      company: form.company || undefined,
      meeting: form.meeting || undefined,
      assignedTo: form.assignedTo ? [form.assignedTo] : undefined,
    }
    onSave(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Task Title" required error={errors.title}>
        <input className={inputClass} value={form.title} onChange={e => set('title', e.target.value)} placeholder="File annual return" />
      </FormField>
      <div>
        <label className={labelClass}>Description</label>
        <textarea rows={3} className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Additional details..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={form.type} onChange={e => set('type', e.target.value)}>
            {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select className={inputClass} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <FormField label="Due Date" required error={errors.dueDate}>
          <input type="date" className={inputClass} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>关联公司</label>
          <select className={inputClass} value={form.company} onChange={e => set('company', e.target.value)} disabled={loadingOptions}>
            <option value="">-- 请选择 --</option>
            {options.companies.map(c => (
              <option key={c._id} value={c._id}>{c.name}{c.nameChinese ? ` (${c.nameChinese})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>关联会议</label>
          <select className={inputClass} value={form.meeting} onChange={e => set('meeting', e.target.value)} disabled={loadingOptions || !form.company}>
            <option value="">{form.company ? '-- 请选择 --' : '-- 请先选择公司 --'}</option>
            {visibleMeetings.map(m => (
              <option key={m._id} value={m._id}>{m.title || m.name || m._id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>跟进人 / 负责人</label>
          <select className={inputClass} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} disabled={loadingOptions}>
            <option value="">-- 请选择 --</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name || u.email || u._id}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-ink border border-hairline rounded-lg hover:bg-canvas">Cancel</button>
        <button type="submit" disabled={loading || loadingOptions} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  )
}
