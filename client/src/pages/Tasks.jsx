import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare, Plus, Filter, Calendar,
  AlertTriangle, Clock, CheckCircle2, Circle,
  Pencil, Trash2, MessageSquare
} from 'lucide-react'
import { taskService, documentService, companyService, meetingService, personnelService } from '../services/index.js'
import { fmtDateShort } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField, taskPriorityColor, taskStatusColor, CompleteWithAttachmentModal } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal'

const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue']
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const TASK_TYPES = ['filing', 'compliance', 'meeting_prep', 'document', 'follow_up', 'other']

const TASK_FORM_RULES = {
  title: [required('Task title is required')],
  dueDate: [required('Due date is required')],
}

const TaskForm = ({ initial = {}, onSave, onCancel, loading }) => {
  const idOf = (ref) => {
    if (!ref) return ''
    return typeof ref === 'object' ? ref._id || '' : String(ref)
  }
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    type: initial.type || 'other',
    priority: initial.priority || 'medium',
    status: initial.status || 'pending',
    dueDate: initial.dueDate ? fmtDateShort(initial.dueDate) : '',
    company: idOf(initial.company),
    meeting: idOf(initial.meeting),
    personnel: idOf(initial.personnel),
  })
  const [errors, setErrors] = useState({})
  const [options, setOptions] = useState({ companies: [], meetings: [], personnel: [] })
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [coRes, mtRes, peRes] = await Promise.all([
          companyService.getAll().catch(() => ({ data: { data: [] } })),
          meetingService.getAll().catch(() => ({ data: { data: [] } })),
          personnelService.getAll().catch(() => ({ data: { data: [] } })),
        ])
        if (!cancelled) {
          setOptions({
            companies: coRes.data?.data || [],
            meetings: mtRes.data?.data?.data || mtRes.data?.data || [],
            personnel: peRes.data?.data || [],
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
      personnel: form.personnel || undefined,
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
          <select className={inputClass} value={form.meeting} onChange={e => set('meeting', e.target.value)} disabled={loadingOptions}>
            <option value="">-- 请选择 --</option>
            {options.meetings.map(m => (
              <option key={m._id} value={m._id}>{m.title || m.name || m._id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>关联人员</label>
          <select className={inputClass} value={form.personnel} onChange={e => set('personnel', e.target.value)} disabled={loadingOptions}>
            <option value="">-- 请选择 --</option>
            {options.personnel.map(p => (
              <option key={p._id} value={p._id}>{p.name || p.englishName || p._id}</option>
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

const statusIcon = (s) => {
  const m = { completed: <CheckCircle2 size={20} className="text-success" />, in_progress: <Clock size={20} className="text-primary-500" />, overdue: <AlertTriangle size={20} className="text-danger" /> }
  return m[s] || <Circle size={20} className="text-ink-3" />
}

const Tasks = () => {
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')

  const { search: searchTerm, setSearch: setSearchTerm, filters, setFilter, filtered } = useSearchFilter(
    tasks,
    (t, q, f) => {
      const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      const matchStatus = f.status === 'all' || !f.status || t.status === f.status
      const matchPriority = f.priority === 'all' || !f.priority || t.priority === f.priority
      return matchSearch && matchStatus && matchPriority
    },
    { status: 'all', priority: 'all' }
  )

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await taskService.getAll()
      setTasks(data.data || [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const openNew = () => { setEditTarget(null); setError(''); setModalOpen(true) }
  const openEdit = (t) => { setEditTarget(t); setError(''); setModalOpen(true) }

  const handleSave = async (formData) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const { data } = await taskService.update(editTarget._id, formData)
        setTasks(ts => ts.map(t => t._id === editTarget._id ? (data.data || { ...t, ...formData }) : t))
      } else {
        const { data: resData } = await taskService.create(formData)
        setTasks(ts => [resData.data || { _id: Date.now().toString(), ...formData }, ...ts])
      }
      setModalOpen(false)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await taskService.delete(deleteTarget._id) } catch { /* ignore */ }
    setTasks(ts => ts.filter(t => t._id !== deleteTarget._id))
    setDeleteTarget(null)
  }

  const handleQuickComplete = async (task) => {
    if (task.status === 'completed') {
      // Un-complete
      try { await taskService.update(task._id, { status: 'pending' }) } catch { /* ignore */ }
      setTasks(ts => ts.map(t => t._id === task._id ? { ...t, status: 'pending' } : t))
      return
    }
    // 打开完成弹窗（备注或附件二选一）
    setNoteTarget(task)
    setNoteText('')
    setUploadFile(null)
  }

  const handleAddNote = async () => {
    if (!noteTarget || (!noteText.trim() && !uploadFile)) return
    try {
      // 1. 如果有附件，上传归档到文档
      if (uploadFile) {
        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('name', `[完成] ${noteTarget.title} - ${uploadFile.name}`)
        formData.append('type', 'other')
        formData.append('category', '任务归档')
        formData.append('description', noteText.trim() || `${noteTarget.title} 完成归档`)
        try {
          await documentService.upload(formData)
        } catch (uploadErr) {
          console.error('文件上传失败:', uploadErr)
        }
      }

      // 2. 添加备注
      const newNote = { content: noteText, createdAt: new Date().toISOString() }
      if (noteText.trim()) {
        await taskService.addNote(noteTarget._id, { content: noteText })
        setTasks(ts => ts.map(t => t._id === noteTarget._id
          ? { ...t, notes: [...(t.notes || []), newNote] }
          : t
        ))
      }

      // 3. 自动标记完成
      try { await taskService.update(noteTarget._id, { status: 'completed' }) } catch { /* ignore */ }
      setTasks(ts => ts.map(t => t._id === noteTarget._id
        ? { ...t, notes: noteText.trim() ? [...(t.notes || []), newNote] : (t.notes || []), status: 'completed' }
        : t
      ))
    } catch { /* ignore */ }
    setNoteText('')
    setUploadFile(null)
    setNoteTarget(null)
  }

  const getDaysRemaining = useCallback((dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000)
    return diff
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Track and manage all your tasks"
        actions={
          <button onClick={openNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors">
            <Plus size={18} className="mr-2" /> New Task
          </button>
        }
      />
      {!canEdit && <div className="p-3 bg-warning/10 border border-warning/20 text-warning text-sm rounded-lg">You have <strong>view-only</strong> access. Contact an admin to make changes.</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search tasks..." />
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
            className="pl-10 pr-8 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-surface">
            <option value="all">All Status</option>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}
            className="pl-10 pr-8 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-surface">
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="Create your first task to get started"
          action={
            <button onClick={openNew} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={16} className="inline mr-1" /> New Task
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const days = getDaysRemaining(task.dueDate)
            const overdue = task.status !== 'completed' && days < 0
            return (
              <div key={task._id} className={`bg-surface rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${overdue ? 'border-danger/20' : 'border-hairline'}`}>
                <div className="flex items-start gap-4">
                  {/* Quick complete toggle — 保持原有圆圈图标，但加 tooltip */}
                  <button onClick={() => handleQuickComplete(task)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform" title={task.status === 'completed' ? '重新打开' : '标记完成'}>
                    {statusIcon(overdue ? 'overdue' : task.status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* 标题可点击 → 进入详情页 */}
                        <h3
                          onClick={() => navigate(`/tasks/${task._id}`)}
                          className={`font-semibold cursor-pointer hover:text-primary-600 transition-colors ${overdue ? 'text-danger' : task.status === 'completed' ? 'line-through text-ink-3' : 'text-ink'}`}
                        >
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${taskPriorityColor(task.priority)}`}>{task.priority}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${taskStatusColor(overdue ? 'overdue' : task.status)}`}>{(overdue ? 'overdue' : task.status).replace('_', ' ')}</span>
                        {task.description && <p className="text-sm text-ink-2 line-clamp-2 mb-2">{task.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-ink-2">
                          <span className={`flex items-center gap-1 ${overdue ? 'text-danger font-medium' : days <= 3 ? 'text-warning' : ''}`}>
                            <Calendar size={13} />
                            {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d remaining`}
                          </span>
                          {task.type && <span className="capitalize">{task.type.replace('_', ' ')}</span>}
                          {task.company?.name && <span className="text-primary-700 bg-info/10 px-1.5 py-0.5 rounded">{task.company.name}</span>}
                          {task.meeting?.title && <span className="text-primary-700 bg-canvas px-1.5 py-0.5 rounded border border-hairline">{task.meeting.title}</span>}
                          {task.personnel?.name && <span className="text-success bg-success/10 px-1.5 py-0.5 rounded">{task.personnel.name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setNoteTarget(task); setNoteText('') }}
                          className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-info/10 rounded-lg transition-colors" title="添加备注">
                          <MessageSquare size={15} />
                        </button>
                        <button onClick={() => openEdit(task)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="编辑任务">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(task)} className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {/* 醒目的完成操作按钮（未完成时显示） */}
                    {task.status !== 'completed' && (
                      <div className="mt-3 pt-3 border-t border-hairline">
                        <button
                          onClick={() => handleQuickComplete(task)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-success/10 text-success border border-success/20 rounded-lg hover:bg-success/10 hover:border-success/30 transition-colors"
                        >
                          <CheckCircle2 size={14} /> 标记完成
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Task' : 'New Task'} size="md">
        {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg">{error}</div>}
        <TaskForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} />
      </Modal>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.title}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={false}
      />

      {/* 标记完成 Modal — 备注或附件二选一 */}
      <CompleteWithAttachmentModal
        isOpen={!!noteTarget}
        onClose={() => { setNoteTarget(null); setUploadFile(null) }}
        title={`标记完成：${noteTarget?.title || ''}`}
        warningText="任务必须填写备注或上传附件才能标记完成"
        noteText={noteText}
        onNoteChange={setNoteText}
        uploadFile={uploadFile}
        onFileChange={(f) => setUploadFile(f)}
        onFileRemove={() => setUploadFile(null)}
        onConfirm={handleAddNote}
        saving={false}
        fileInputRef={fileInputRef}
      />
    </div>
  )
}

export default Tasks
