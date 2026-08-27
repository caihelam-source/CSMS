import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckSquare, Plus, Filter, Calendar,
  AlertTriangle, Clock, CheckCircle2, Circle,
  Pencil, Trash2, MessageSquare, Link2
} from 'lucide-react'
import { taskService, documentService, userService } from '../services/index.js'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, taskPriorityColor, taskStatusColor, CompleteWithAttachmentModal } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { useScope, useScopedItems } from '../hooks/useScope'
import { NO_SCOPE_HINT } from '../utils/scope'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal'
import VirtualList from '../components/VirtualList'
import SignTaskForm from '../components/SignTaskForm'
import TaskForm, { TASK_STATUSES, TASK_PRIORITIES } from '../components/TaskForm'
import Segmented from '../components/ui/Segmented'

const statusIcon = (s) => {
  const m = { completed: <CheckCircle2 size={20} className="text-success" />, in_progress: <Clock size={20} className="text-primary-500" />, overdue: <AlertTriangle size={20} className="text-danger" /> }
  return m[s] || <Circle size={20} className="text-ink-3" />
}

// 列表行抽成 memo 组件：父组件状态变更时仅数据变化的行会重渲染
const TaskRow = memo(function TaskRow({ task, users, getDaysRemaining, onEdit, onDelete, onQuickComplete, onAddNote, onNavigate, style }) {
  const days = getDaysRemaining(task.dueDate)
  const overdue = task.status !== 'completed' && days < 0
  return (
    <div style={style} className={`bg-surface rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${overdue ? 'border-danger/20' : 'border-hairline'}`}>
      <div className="flex items-start gap-4">
        {/* Quick complete toggle */}
        <button onClick={() => onQuickComplete(task)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform" title={task.status === 'completed' ? '重新打开' : '标记完成'}>
          {statusIcon(overdue ? 'overdue' : task.status)}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3
                onClick={() => onNavigate(`/tasks/${task._id}`)}
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
                {task.complianceRuleId && (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" title="来源：合规提醒">
                    <Link2 size={12} /> 合规·{task.complianceRuleId}
                  </span>
                )}
                {task.assignedTo && task.assignedTo.length > 0 && (
                  <span className="text-success bg-success/10 px-1.5 py-0.5 rounded">
                    {task.assignedTo.map(a => {
                      const name = typeof a === 'object' ? a.name : (users.find(u => u._id === a)?.name || a)
                      return a.role ? `${name} (${a.role})` : name
                    }).join(', ')}
                  </span>
                )}
                {!task.assignedTo?.length && task.responsiblePerson && (
                  <span className="text-success bg-success/10 px-1.5 py-0.5 rounded">{task.responsiblePerson}</span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => onAddNote(task)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-info/10 rounded-lg transition-colors" title="添加备注">
                <MessageSquare size={15} />
              </button>
              <button onClick={() => onEdit(task)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="编辑任务">
                <Pencil size={15} />
              </button>
              <button onClick={() => onDelete(task)} className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="删除任务">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          {task.status !== 'completed' && (
            <div className="mt-3 pt-3 border-t border-hairline">
              <button
                onClick={() => onQuickComplete(task)}
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
})

const Tasks = () => {
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [newTaskMode, setNewTaskMode] = useState('regular')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  // T02：列表视图切换——全部 / 我的任务（"我的任务"仅 scope 可见集合的子集，决策 #3 不变）
  const [view, setView] = useState('all')

  // 行级数据权限：渲染期无声过滤（真实模式服务端已过滤，此处幂等 no-op）
  const { noScope } = useScope()
  const scopedTasks = useScopedItems(tasks, t => t.company?._id ?? t.company)

  const { search: searchTerm, setSearch: setSearchTerm, filters, setFilter, filtered } = useSearchFilter(
    scopedTasks,
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
      // T02：切到「我的任务」时向后端传 assignedTo=me，由后端翻译为当前用户并 $in 过滤
      const params = view === 'mine' ? { assignedTo: 'me' } : {}
      const { data } = await taskService.getAll(params)
      setTasks(data.data || [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    userService.getAll()
      .then(res => setUsers(res.data?.data || []))
      .catch(() => setUsers([]))
  }, [])

  const openNew = (mode = 'regular') => { setEditTarget(null); setNewTaskMode(mode); setError(''); setModalOpen(true) }
  const openEdit = useCallback((t) => { setEditTarget(t); setError(''); setModalOpen(true) }, [])

  // 深链：Dashboard「发起签署任务」→ /tasks?mode=signing 自动打开签署任务弹窗
  //        Dashboard「新增一般任务」→ /tasks?open=new 自动打开新建任务弹窗
  useEffect(() => {
    const mode = searchParams.get('mode')
    const open = searchParams.get('open')
    if (mode === 'signing') {
      openNew('signing')
      setSearchParams({}, { replace: true })
    } else if (open === 'new') {
      openNew('regular')
      setSearchParams({}, { replace: true })
    }
    // 仅在挂载时执行一次
  }, [])

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

  const handleQuickComplete = useCallback(async (task) => {
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
  }, [])

  const handleAddNoteClick = useCallback((task) => {
    setNoteTarget(task)
    setNoteText('')
  }, [])

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

  // C1：下传给虚拟列表行的稳定回调（避免父 state 抖动触发行重渲染）
  const taskItemProps = useMemo(
    () => ({
      users,
      getDaysRemaining,
      onEdit: openEdit,
      onDelete: setDeleteTarget,
      onQuickComplete: handleQuickComplete,
      onAddNote: handleAddNoteClick,
      onNavigate: navigate,
    }),
    [users, getDaysRemaining, openEdit, handleQuickComplete, handleAddNoteClick, setDeleteTarget, navigate]
  )

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
        {/* T02：全部 / 我的任务 分段切换（Segmented · P2 组件精修） */}
        <Segmented
          options={[{ value: 'all', label: '全部' }, { value: 'mine', label: '我的任务' }]}
          value={view}
          onChange={setView}
        />
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
          title={noScope ? '暂无可访问的任务' : '还没有任务'}
          description={noScope ? NO_SCOPE_HINT : '创建第一个任务，跟踪待办与合规截止'}
          action={noScope ? null : (
            <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
              <Plus size={16} /> 新建任务
            </button>
          )}
        />
      ) : (
        <VirtualList
          mode="list"
          items={filtered}
          rowComponent={TaskRow}
          rowHeight={112}
          itemKey="task"
          itemProps={taskItemProps}
        />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Task' : 'New Task'} size="md">
        {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg">{error}</div>}
        {!editTarget && (
          <div className="mb-4 flex gap-4 p-3 bg-canvas rounded-lg">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={newTaskMode === 'regular'} onChange={() => setNewTaskMode('regular')} /> 一般任务
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={newTaskMode === 'signing'} onChange={() => setNewTaskMode('signing')} /> 签署任务
            </label>
          </div>
        )}
        {editTarget || newTaskMode === 'regular' ? (
          <TaskForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} users={users} />
        ) : (
          <SignTaskForm
            onSuccess={() => { setModalOpen(false); fetchTasks() }}
            onCancel={() => setModalOpen(false)}
            sourceKind="task_sign"
            sourceLabel="来自 [Tasks 签署任务]"
          />
        )}
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
