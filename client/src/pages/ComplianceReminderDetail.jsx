import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Calendar, CheckCircle2,
  MessageSquare, Paperclip, AlertTriangle, Link as LinkIcon,
} from 'lucide-react'
import { complianceReminderService, taskService, documentService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, EmptyState, compliancePriorityColor, complianceStatusColor, CompleteWithAttachmentModal } from '../components/UIHelpers'

export default function ComplianceReminderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reminder, setReminder] = useState(null)
  const [linkedTask, setLinkedTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [archivedDoc, setArchivedDoc] = useState(null)
  const fileInputRef = useRef()

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: rRes } = await complianceReminderService.getOne(id).catch(() => ({ data: { data: null } }))
      const r = rRes.data
      setReminder(r)
      if (r?.task?._id) {
        const { data: tRes } = await taskService.getOne(r.task._id).catch(() => ({ data: { data: null } }))
        setLinkedTask(tRes.data)
      }
    } catch {
      toast.error('无法加载提醒')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const handleComplete = async () => {
    if (!reminder) return
    const hasNote = noteText.trim().length > 0
    const hasFile = !!uploadFile
    if (!hasNote && !hasFile) {
      toast.error('请填写完成备注或上传文件后才能标记完成')
      return
    }
    setSaving(true)
    try {
      let archived = null
      if (hasFile || reminder.company) {
        // 有文件时用 FormData multipart 上传（后端返回含 fileUrl 的文档）
        let docRes
        if (hasFile) {
          const formData = new FormData()
          formData.append('file', uploadFile)
          formData.append('name', uploadFile.name)
          formData.append('type', 'return')
          formData.append('category', 'government')
          if (reminder.company) formData.append('company', JSON.stringify({ _id: reminder.company._id, name: reminder.company.name, registrationNumber: reminder.company.registrationNumber }))
          docRes = await documentService.upload(formData).catch(() => ({ data: { data: null } }))
        } else {
          docRes = await documentService.create({
            name: `合规完成附件 - ${reminder.title}`,
            type: 'compliance_attachment',
            category: 'government',
            company: reminder.company ? { _id: reminder.company._id, name: reminder.company.name, registrationNumber: reminder.company.registrationNumber } : undefined,
            createdAt: new Date().toISOString().split('T')[0],
          }).catch(() => ({ data: { data: null } }))
        }
        archived = docRes.data
        setArchivedDoc(archived)
      }
      const notes = Array.isArray(reminder.notes) ? reminder.notes : []
      const newNote = hasNote ? { content: noteText, createdAt: new Date().toISOString() } : null
      const payload = {
        status: 'completed',
        completed: true,
        notes: [...notes, ...(newNote ? [newNote] : [])],
      }
      const { data: upd } = await complianceReminderService.update(reminder._id, payload).catch(() => ({ data: { data: reminder } }))
      setReminder(prev => ({ ...(upd.data || prev), ...payload }))
      // v6.0 双向联动：完成 Reminder 时同步完成关联 Task
      if (reminder.task?._id || reminder.task) {
        const taskId = reminder.task._id || reminder.task
        try {
          await taskService.update(taskId, { status: 'completed', completedAt: new Date().toISOString() }).catch(() => {})
          setLinkedTask(prev => prev ? ({ ...prev, status: 'completed' }) : null)
        } catch {
          /* non-blocking */
        }
      }
      setCompleteOpen(false)
      setNoteText('')
      setUploadFile(null)
      toast.success(archived ? '提醒已完成，附件已归档至公司文档' : '提醒已完成')
    } catch {
      toast.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="加载合规提醒..." />
  if (!reminder) {
    return <EmptyState icon={Calendar} title="合规提醒不存在" description="该提醒记录不存在或已被删除" action={<button onClick={() => navigate('/compliance-reminders')} className="btn-primary">返回提醒列表</button>} />
  }

  const days = reminder.dueDate ? Math.ceil((new Date(reminder.dueDate) - new Date()) / 86400000) : null
  const isOverdue = reminder.status !== 'completed' && days !== null && days < 0
  const notesArr = Array.isArray(reminder.notes) ? reminder.notes : (reminder.notes ? [{ content: reminder.notes, createdAt: reminder.createdAt }] : [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/compliance-reminders')} className="p-2 hover:bg-canvas rounded-lg transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={`text-2xl font-bold ${reminder.completed ? 'line-through text-ink-3' : ''}`}>{reminder.title}</h1>
            {isOverdue && <span className="badge bg-danger/10 text-danger"><AlertTriangle size={12} /> 已逾期</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-ink-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs rounded-full border ${compliancePriorityColor(reminder.priority)}`}>{reminder.priority}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${complianceStatusColor(reminder.status)}`}>{reminder.status}</span>
            <span className="flex items-center gap-1"><Calendar size={13} />{reminder.dueDate ? formatDate(reminder.dueDate) : '-'}{days !== null && reminder.status !== 'completed' && ` (${days < 0 ? `逾期${Math.abs(days)}天` : days === 0 ? '今天' : `剩${days}天`})`}</span>
            {reminder.category && <span className="bg-canvas text-ink-2 px-2 py-0.5 rounded text-xs">{reminder.category}</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {reminder.status !== 'completed' && (
          <button onClick={() => { setNoteText(''); setUploadFile(null); setCompleteOpen(true) }}
            className="btn-primary flex items-center gap-2">
            <CheckCircle2 size={16} /> 标记完成（需备注或附件）
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">提醒信息</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">类别</span><span>{reminder.category || '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">规则</span><span>{reminder.rule?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">优先级</span><span className={`px-2 py-0.5 text-xs rounded-full border ${compliancePriorityColor(reminder.priority)}`}>{reminder.priority}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">截止日期</span><span>{reminder.dueDate ? formatDate(reminder.dueDate) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">关联公司</span><span>{reminder.company ? <Link to={`/companies/${reminder.company._id}`} className="text-primary-600 hover:underline">{reminder.company.name}</Link> : '未关联'}</span></div>
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><LinkIcon size={16} /> 关联任务</h3>
          {linkedTask ? (
            <Link to={`/tasks/${linkedTask._id}`} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
              <div>
                <p className="font-medium text-primary-800">{linkedTask.title}</p>
                <p className="text-xs text-primary-600">{linkedTask.status.replace('_', ' ')}</p>
              </div>
              <span className="text-primary-500">查看 →</span>
            </Link>
          ) : reminder.task ? (
            <Link to={`/tasks/${reminder.task._id}`} className="text-primary-600 hover:underline">前往关联任务 →</Link>
          ) : (
            <p className="text-sm text-ink-3">未关联任务</p>
          )}
          {archivedDoc && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              <Paperclip size={14} /> 已归档：{archivedDoc.name}（{archivedDoc.docNumber}）
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare size={16} /> 备注记录（{notesArr.length}）</h3>
        {notesArr.length === 0 ? (
          <p className="text-sm text-ink-3">暂无备注</p>
        ) : (
          <div className="space-y-2">
            {notesArr.map((n, i) => (
              <div key={i} className="bg-canvas rounded-lg px-3 py-2 text-sm text-ink">
                <p>{n.content}</p>
                {n.createdAt && <p className="text-xs text-ink-3 mt-1">{formatDate(n.createdAt)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <CompleteWithAttachmentModal
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="标记合规提醒完成"
        warningText={`必须填写完成备注或上传文件才能确认完成。${reminder.company ? '上传的附件将自动归档至「' + reminder.company.name + '」的文档库。' : ''}`}
        noteText={noteText}
        onNoteChange={setNoteText}
        uploadFile={uploadFile}
        onFileChange={f => setUploadFile(f)}
        onFileRemove={() => setUploadFile(null)}
        onConfirm={handleComplete}
        saving={saving}
        fileInputRef={fileInputRef}
      />
    </div>
  )
}
