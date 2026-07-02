import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import api from '../services/api'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import {
  CheckSquare, Plus, Search, Filter, Calendar,
  AlertTriangle, Clock, CheckCircle2, Circle,
  MoreVertical, Pencil, Trash2, X, MessageSquare
} from 'lucide-react'

const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue']
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const TASK_TYPES = ['filing', 'compliance', 'meeting_prep', 'document', 'follow_up', 'other']

const TaskForm = ({ initial = {}, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    type: initial.type || 'other',
    priority: initial.priority || 'medium',
    status: initial.status || 'pending',
    dueDate: initial.dueDate ? format(new Date(initial.dueDate), 'yyyy-MM-dd') : '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSubmit = (e) => { e.preventDefault(); onSave(form) }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
  const lbl = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={lbl}>Task Title *</label>
        <input required className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="File annual return" />
      </div>
      <div>
        <label className={lbl}>Description</label>
        <textarea rows={3} className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Additional details..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Type</label>
          <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
            {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Priority</label>
          <select className={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Due Date *</label>
          <input required type="date" className={inp} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </div>
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

const priorityColor = (p) => ({ urgent: 'bg-red-100 text-red-700 border-red-200', high: 'bg-orange-100 text-orange-700 border-orange-200', medium: 'bg-yellow-100 text-yellow-700 border-yellow-200', low: 'bg-gray-100 text-gray-600 border-gray-200' }[p] || 'bg-gray-100 text-gray-600 border-gray-200')
const statusColor = (s) => ({ completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700', overdue: 'bg-red-100 text-red-700', pending: 'bg-gray-100 text-gray-600' }[s] || 'bg-gray-100 text-gray-600')
const statusIcon = (s) => {
  const m = { completed: <CheckCircle2 size={20} className="text-green-500" />, in_progress: <Clock size={20} className="text-blue-500" />, overdue: <AlertTriangle size={20} className="text-red-500" /> }
  return m[s] || <Circle size={20} className="text-gray-400" />
}

const Tasks = () => {
  const { canEdit, canDelete } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchTasks() }, [filterStatus, filterPriority])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterPriority !== 'all') params.priority = filterPriority
      const response = await api.get('/tasks', { params })
      setTasks(response.tasks || [])
    } catch {
      setTasks(DEMO_TASKS)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => { setEditTarget(null); setError(''); setModalOpen(true) }
  const openEdit = (t) => { setEditTarget(t); setError(''); setModalOpen(true) }

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const res = await api.put(`/tasks/${editTarget._id}`, data)
        setTasks(ts => ts.map(t => t._id === editTarget._id ? (res.task || { ...t, ...data }) : t))
      } else {
        const res = await api.post('/tasks', data)
        setTasks(ts => [res.task || { _id: Date.now().toString(), ...data }, ...ts])
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
    try { await api.delete(`/tasks/${deleteTarget._id}`) } catch {}
    setTasks(ts => ts.filter(t => t._id !== deleteTarget._id))
    setDeleteTarget(null)
  }

  const handleQuickComplete = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try { await api.put(`/tasks/${task._id}`, { status: newStatus }) } catch {}
    setTasks(ts => ts.map(t => t._id === task._id ? { ...t, status: newStatus } : t))
  }

  const handleAddNote = async () => {
    if (!noteTarget || !noteText.trim()) return
    try {
      await api.post(`/tasks/${noteTarget._id}/notes`, { content: noteText })
    } catch {}
    setTasks(ts => ts.map(t => t._id === noteTarget._id
      ? { ...t, notes: [...(t.notes || []), { content: noteText, createdAt: new Date().toISOString() }] }
      : t
    ))
    setNoteText('')
    setNoteTarget(null)
  }

  const filtered = tasks.filter(t =>
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDaysRemaining = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000)
    return diff
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Track and manage all your tasks</p>
        </div>
        <button onClick={openNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors">
          <Plus size={18} className="mr-2" /> New Task
        </button>
      </div>
      {!canEdit && <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">You have <strong>view-only</strong> access. Contact an admin to make changes.</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-white">
            <option value="all">All Status</option>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none bg-white">
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckSquare size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks found</h3>
          <p className="text-gray-500 mb-4">Create your first task to get started</p>
          <button onClick={openNew} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus size={16} className="inline mr-1" /> New Task
          </button>
        </div>
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
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${priorityColor(task.priority)}`}>{task.priority}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(overdue ? 'overdue' : task.status)}`}>{(overdue ? 'overdue' : task.status).replace('_', ' ')}</span>
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

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task" size="sm">
        <p className="text-gray-600 mb-6">Delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
        </div>
      </Modal>

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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

const DEMO_TASKS = [
  { _id: 't1', title: 'File Annual Return - Acme Holdings', type: 'filing', priority: 'urgent', status: 'pending', dueDate: '2026-03-20', description: 'Submit annual return to Companies House before deadline.' },
  { _id: 't2', title: 'Prepare Board Meeting Minutes', type: 'document', priority: 'high', status: 'in_progress', dueDate: '2026-03-28', description: 'Draft and circulate minutes from Q1 board meeting.' },
  { _id: 't3', title: 'Update Director Register', type: 'compliance', priority: 'medium', status: 'pending', dueDate: '2026-04-05', description: '' },
  { _id: 't4', title: 'Review Service Agreement', type: 'document', priority: 'low', status: 'completed', dueDate: '2026-03-10', description: 'Review and sign vendor service agreement.' },
]

export default Tasks
