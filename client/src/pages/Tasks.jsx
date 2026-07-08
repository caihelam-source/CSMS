import { useEffect, useState, useCallback } from 'react'
import {
  CheckSquare, Plus, Filter, Calendar,
  AlertTriangle, Clock, CheckCircle2, Circle,
  Pencil, Trash2, MessageSquare
} from 'lucide-react'
import { taskService } from '../services/index.js'
import { fmtDateShort } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField, taskPriorityColor, taskStatusColor } from '../components/UIHelpers'
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
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    type: initial.type || 'other',
    priority: initial.priority || 'medium',
    status: initial.status || 'pending',
    dueDate: initial.dueDate ? fmtDateShort(initial.dueDate) : '',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, TASK_FORM_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    onSave(form)
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
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  )
}

const statusIcon = (s) => {
  const m = { completed: <CheckCircle2 size={20} className="text-green-500" />, in_progress: <Clock size={20} className="text-blue-500" />, overdue: <AlertTriangle size={20} className="text-red-500" /> }
  return m[s] || <Circle size={20} className="text-gray-400" />
}

const Tasks = () => {
  const { canEdit, canDelete } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
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
    try { await taskService.delete(deleteTarget._id) } catch {}
    setTasks(ts => ts.filter(t => t._id !== deleteTarget._id))
    setDeleteTarget(null)
  }

  const handleQuickComplete = async (task) => {
    if (task.status === 'completed') {
      // Un-complete
      try { await taskService.update(task._id, { status: 'pending' }) } catch {}
      setTasks(ts => ts.map(t => t._id === task._id ? { ...t, status: 'pending' } : t))
      return
    }
    // Require remark before marking as complete
    if (!task.notes || task.notes.length === 0) {
      // Open note modal instead
      setNoteTarget(task)
      setNoteText('')
      return
    }
    try { await taskService.update(task._id, { status: 'completed' }) } catch {}
    setTasks(ts => ts.map(t => t._id === task._id ? { ...t, status: 'completed' } : t))
  }

  const handleAddNote = async () => {
    if (!noteTarget || !noteText.trim()) return
    try {
      await taskService.addNote(noteTarget._id, { content: noteText })
      const newNote = { content: noteText, createdAt: new Date().toISOString() }
      setTasks(ts => ts.map(t => t._id === noteTarget._id
        ? { ...t, notes: [...(t.notes || []), newNote] }
        : t
      ))
      // Auto-complete after adding note
      try { await taskService.update(noteTarget._id, { status: 'completed' }) } catch {}
      setTasks(ts => ts.map(t => t._id === noteTarget._id
        ? { ...t, notes: [...(t.notes || []), newNote], status: 'completed' }
        : t
      ))
    } catch {}
    setNoteText('')
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
      {!canEdit && <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">You have <strong>view-only</strong> access. Contact an admin to make changes.</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search tasks..." />
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-white">
            <option value="all">All Status</option>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-white">
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
              <div key={task._id} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${overdue ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-4">
                  {/* Quick complete toggle */}
                  <button onClick={() => handleQuickComplete(task)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform">
                    {statusIcon(overdue ? 'overdue' : task.status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={`font-semibold ${overdue ? 'text-red-700' : task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {task.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${taskPriorityColor(task.priority)}`}>{task.priority}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${taskStatusColor(overdue ? 'overdue' : task.status)}`}>{(overdue ? 'overdue' : task.status).replace('_', ' ')}</span>
                        </div>
                        {task.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{task.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : days <= 3 ? 'text-orange-600' : ''}`}>
                            <Calendar size={13} />
                            {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d remaining`}
                          </span>
                          {task.type && <span className="capitalize">{task.type.replace('_', ' ')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setNoteTarget(task); setNoteText('') }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="添加备注">
                          <MessageSquare size={15} />
                        </button>
                        <button onClick={() => openEdit(task)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(task)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Task' : 'New Task'} size="md">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <TaskForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} />
      </Modal>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.title}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={false}
      />

      {/* 添加备注 Modal */}
      <Modal isOpen={!!noteTarget} onClose={() => setNoteTarget(null)} title={`添加备注：${noteTarget?.title}`} size="sm">
        <div className="space-y-4">
          {/* 已有备注 */}
          {noteTarget?.notes?.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {noteTarget.notes.map((n, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                  <p>{n.content}</p>
                  {n.createdAt && <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新备注</label>
            <textarea rows={3}
              className={inputClass}
              value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="输入备注内容..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setNoteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleAddNote} disabled={!noteText.trim()}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              添加备注
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Tasks
