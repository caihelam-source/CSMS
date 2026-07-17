import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Building2, Calendar, CheckCircle2, Circle,
  MessageSquare, AlertTriangle, Paperclip,
} from 'lucide-react'
import { taskService, documentService, companyService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, EmptyState, DetailHeader, taskPriorityColor, taskStatusColor, CompleteWithAttachmentModal } from '../components/UIHelpers'

const typeLabel = (t) => ({ filing: '申报', compliance: '合规', meeting_prep: '会议准备', document: '文档', follow_up: '跟进', other: '其他' }[t] || t)

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [, setCompanies] = useState([])
  const [completeOpen, setCompleteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [archivedDoc, setArchivedDoc] = useState(null)
  const fileInputRef = useRef()

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: tRes }, coRes] = await Promise.all([
        taskService.getOne(id).catch(() => ({ data: { data: null } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setTask(tRes.data)
      setCompanies(coRes.data?.data || [])
    } catch {
      toast.error('无法加载任务')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const handleComplete = async () => {
    if (!task) return
    const hasNote = noteText.trim().length > 0
    const hasFile = !!uploadFile
    if (!hasNote && !hasFile) {
      toast.error('请填写完成备注或上传文件后才能标记完成')
      return
    }
    setSaving(true)
    try {
      let doc = null
      // 若上传了文件（或要求归档），生成一条关联到公司的文档
      if (hasFile || task.company) {
        const company = task.company
        const { data: docRes } = await documentService.create({
          name: hasFile ? uploadFile.name : `任务完成附件 - ${task.title}`,
          type: 'task_attachment',
          category: 'other',
          company: company ? { _id: company._id, name: company.name, registrationNumber: company.registrationNumber } : undefined,
          fileName: hasFile ? uploadFile.name : undefined,
          fileSize: hasFile ? uploadFile.size : undefined,
          note: hasFile ? '由任务完成自动归档' : undefined,
          createdAt: new Date().toISOString().split('T')[0],
        }).catch(() => ({ data: { data: null } }))
        doc = docRes.data
      }
      // 新增备注
      if (hasNote) {
        await taskService.addNote(task._id, { content: noteText }).catch(() => {})
      }
      // 标记完成
      const { data: upd } = await taskService.update(task._id, { status: 'completed' }).catch(() => ({ data: { data: task } }))
      const newNote = hasNote ? { content: noteText, createdAt: new Date().toISOString() } : null
      setTask(prev => ({
        ...(upd.data || prev),
        status: 'completed',
        notes: [...(prev.notes || []), ...(newNote ? [newNote] : [])],
      }))
      setArchivedDoc(doc)
      setCompleteOpen(false)
      setNoteText('')
      setUploadFile(null)
      toast.success(doc ? '任务已完成，附件已归档至公司文档' : '任务已完成')
    } catch {
      toast.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReopen = async () => {
    if (!task) return
    try {
      await taskService.update(task._id, { status: 'pending' }).catch(() => {})
      setTask(prev => ({ ...prev, status: 'pending' }))
      toast.success('已重新打开任务')
    } catch { /* ignore */ }
  }

  if (loading) return <LoadingSpinner text="加载任务..." />
  if (!task) {
    return <EmptyState icon={AlertTriangle} title="任务不存在" description="该任务记录不存在或已被删除" action={<button onClick={() => navigate('/tasks')} className="btn-primary">返回任务列表</button>} />
  }

  const overdue = task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date()
  const days = task.dueDate ? Math.ceil((new Date(task.dueDate) - new Date()) / 86400000) : null

  return (
    <div className="space-y-6">
      <DetailHeader
        onBack={() => navigate('/tasks')}
        title={task.title}
        subtitle={
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-2 py-0.5 text-xs rounded-full border ${taskPriorityColor(task.priority)}`}>{task.priority}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${taskStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span>
            <span className="flex items-center gap-1"><Calendar size={13} />{task.dueDate ? formatDate(task.dueDate) : '-'}{days !== null && task.status !== 'completed' && ` (${days < 0 ? `逾期${Math.abs(days)}天` : days === 0 ? '今天' : `剩${days}天`})`}</span>
            {task.company && (
              <Link to={`/companies/${task.company._id}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                <Building2 size={13} /> {task.company.name}
              </Link>
            )}
          </div>
        }
        initials={task.title?.charAt(0) || 'T'}
        badges={overdue ? <span className="badge bg-danger/10 text-danger"><AlertTriangle size={12} /> 逾期</span> : null}
      />

      {/* 操作栏 */}
      <div className="flex gap-3">
        {task.status !== 'completed' ? (
          <button onClick={() => { setNoteText(''); setUploadFile(null); setCompleteOpen(true) }}
            className="btn-primary flex items-center gap-2">
            <CheckCircle2 size={16} /> 标记完成（需备注或附件）
          </button>
        ) : (
          <button onClick={handleReopen} className="btn-secondary flex items-center gap-2">
            <Circle size={16} /> 重新打开
          </button>
        )}
      </div>

      {/* 详情卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">任务信息</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">类型</span><span>{typeLabel(task.type)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">状态</span><span className={`px-2 py-0.5 text-xs rounded-full ${taskStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">截止日期</span><span>{task.dueDate ? formatDate(task.dueDate) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">关联公司</span><span>{task.company ? <Link to={`/companies/${task.company._id}`} className="text-primary-600 hover:underline">{task.company.name}</Link> : '未关联'}</span></div>
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">完成要求</h3>
          <p className="text-sm text-ink-2 leading-relaxed">
            任务必须 <strong>填写完成备注</strong> 或 <strong>上传文件</strong> 后才能标记完成。若关联了公司，上传的附件将自动归档到该公司的文档库，确保底层数据联动。
          </p>
          {archivedDoc && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              <Paperclip size={14} /> 已归档：{archivedDoc.name}（{archivedDoc.docNumber}）
            </div>
          )}
        </div>
      </div>

      {/* 描述 */}
      {task.description && (
        <div className="card">
          <h3 className="font-semibold mb-2">描述</h3>
          <p className="text-sm text-ink-2 whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* 备注历史 */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare size={16} /> 备注记录（{task.notes?.length || 0}）</h3>
        {!task.notes || task.notes.length === 0 ? (
          <p className="text-sm text-ink-3">暂无备注</p>
        ) : (
          <div className="space-y-2">
            {task.notes.map((n, i) => (
              <div key={i} className="bg-canvas rounded-lg px-3 py-2 text-sm text-ink">
                <p>{n.content}</p>
                {n.createdAt && <p className="text-xs text-ink-3 mt-1">{formatDate(n.createdAt)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 完成 Modal */}
      <CompleteWithAttachmentModal
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="标记任务完成"
        warningText={`必须填写完成备注或上传文件才能确认完成。${task.company ? '上传的附件将自动归档至「' + task.company.name + '」的文档库。' : ''}`}
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
