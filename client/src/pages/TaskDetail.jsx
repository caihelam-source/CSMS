import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Building2, Calendar, CheckCircle2, Circle,
  MessageSquare, AlertTriangle, Paperclip,
} from 'lucide-react'
import { taskService, documentService, companyService, signTaskService } from '../services/index.js'
import { formatDate, taskRequiresAttachment, buildCtcDocName } from '../utils/helpers'
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
    // v5.1 #2.2 / #2.3 附件强控：签署类任务必须上传附件方可标记完成
    const requiresAttach = taskRequiresAttachment(task)
    if (requiresAttach && !hasFile) {
      toast.error('请先上传签署文件后再标记完成')
      return
    }
    if (!requiresAttach && !hasNote && !hasFile) {
      toast.error('请填写完成备注或上传文件后才能标记完成')
      return
    }
    setSaving(true)
    try {
      let doc = null
      // v5.2 修复：关联会议的签署任务，其扫描件暂存于会议（staged），待会议最终归档后才统一进入公司库
      const meetingRef = task.meeting ? (task.meeting._id || task.meeting) : null
      const stageUnderMeeting = !!meetingRef
      // 仅当：① 上传了文件；或 ② 有公司且无关联会议（直接归档到公司库）
      if (hasFile || (task.company && !stageUnderMeeting)) {
        const company = task.company
        const { data: docRes } = await documentService.create({
          name: hasFile ? buildCtcDocName(uploadFile.name, task.isCTC) : `任务完成附件 - ${task.title}`,
          type: stageUnderMeeting ? 'minutes' : 'task_attachment',
          category: stageUnderMeeting ? 'meeting' : 'other',
          meeting: stageUnderMeeting ? { _id: meetingRef } : undefined,
          company: company ? { _id: company._id, name: company.name, registrationNumber: company.registrationNumber } : undefined,
          fileName: hasFile ? uploadFile.name : undefined,
          fileSize: hasFile ? uploadFile.size : undefined,
          // v5.2 模块4：签署类任务归档时标记签署状态（CTC / 普通签署）
          signStatus: hasFile && task.type === 'signing' ? (task.isCTC ? 'ctc' : 'fully_signed') : undefined,
          staged: stageUnderMeeting,
          note: hasFile ? (stageUnderMeeting ? '由会议签署任务完成暂存，待会议最终归档' : (task.taskSource === 'dashboard' ? '由 Dashboard 签署任务完成自动归档' : '由任务完成自动归档')) : undefined,
          // v5.2 修复：来源统一指向签署任务（会议衍生 / Dashboard 发起均归会议或公司追溯）
          source: hasFile ? {
            kind: 'signing_scan',
            refId: task._id,
            label: `来自签署任务：${task.title}`,
          } : undefined,
          createdAt: new Date().toISOString().split('T')[0],
        }).catch(() => ({ data: { data: null } }))
        doc = docRes.data
      }
      // 新增备注
      if (hasNote) {
        await taskService.addNote(task._id, { content: noteText }).catch(() => {})
      }
      // 标记完成（携带 hasAttachment 以满足后端完成门禁 #2.3）
      const { data: upd } = await taskService.update(task._id, {
        status: 'completed',
        hasAttachment: hasFile ? true : task.hasAttachment,
      }).catch(() => ({ data: { data: task } }))
      // v6.0 双向同步：签署类 Task 完成时，同步更新关联的 SignTask 状态
      if (task.type === 'signing' && task.meeting) {
        const meetingId = task.meeting._id || task.meeting
        try {
          // 查找关联此 Task 的 SignTask 并标记完成
          const { data: stRes } = await signTaskService.getAll().catch(() => ({ data: { data: [] } }))
          const linkedST = (stRes.data || []).find(st =>
            st.taskId === task._id ||
            (st.relatedMeeting?._id === meetingId || st.relatedMeeting === meetingId)
          )
          if (linkedST) {
            await signTaskService.update(linkedST._id, {
              status: 'completed',
              completedAt: new Date().toISOString(),
            }).catch(() => {})
          }
        } catch {
          /* non-blocking: SignTask sync failure shouldn't break task completion */
        }
      }
      const newNote = hasNote ? { content: noteText, createdAt: new Date().toISOString() } : null
      setTask(prev => ({
        ...(upd.data || prev),
        status: 'completed',
        hasAttachment: hasFile ? true : prev.hasAttachment,
        notes: [...(prev.notes || []), ...(newNote ? [newNote] : [])],
      }))
      setArchivedDoc(doc)
      setCompleteOpen(false)
      setNoteText('')
      setUploadFile(null)
      toast.success(doc ? (stageUnderMeeting ? '签署文件已归入会议相关文件，待会议最终归档后进入公司库' : '任务已完成，附件已归档至公司文档') : '任务已完成')
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
        badges={
          <>
            {overdue && <span className="badge bg-danger/10 text-danger"><AlertTriangle size={12} /> 逾期</span>}
            {task.taskSource === 'dashboard' && <span className="badge bg-primary/10 text-primary-700">Dashboard 发起</span>}
            {task.taskSource === 'meeting' && <span className="badge bg-info/10 text-primary-700">会议衍生</span>}
            {task.isCTC && <span className="badge bg-danger/10 text-danger">CTC 文件</span>}
          </>
        }
      />

      {/* ====== 操作栏：完成任务 ====== */}
      {task.status !== 'completed' ? (
        <div className="card border-2 border-primary/20 bg-primary/[0.02]">
          {/* 主按钮 —— 简短、醒目、明确是按钮 */}
          <button
            onClick={() => { setNoteText(''); setUploadFile(null); setCompleteOpen(true) }}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base font-semibold"
          >
            <CheckCircle2 size={20} /> 完成此任务
          </button>

          {/* 步骤引导卡片 —— 告诉用户点了按钮后要做什么 */}
          <div className="mt-3 p-3 bg-canvas rounded-lg text-sm space-y-2">
            <p className="font-medium text-ink flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-info" /> 完成前需要：
            </p>
            <ol className="list-decimal list-inside space-y-1 text-ink-2 ml-1">
              {taskRequiresAttachment(task) ? (
                <>
                  <li>点击上方按钮，在弹窗中<strong className="text-ink">上传签署文件</strong></li>
                  <li>（可选）填写完成备注说明</li>
                  <li>确认完成后文件将自动归档{task.company ? `至「${task.company.name}」文档库` : ''}</li>
                </>
              ) : (
                <>
                  <li>点击上方按钮，<strong className="text-ink">填写完成备注</strong>或上传附件（至少一项）</li>
                  {task.company && <li>如上传附件将自动归档至「{task.company.name}」文档库</li>}
                </>
              )}
            </ol>
          </div>
        </div>
      ) : (
        /* 已完成状态 */
        <div className="card border-success/30 bg-success/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-success font-semibold">
              <CheckCircle2 size={20} /> 任务已完成
            </div>
            <button onClick={handleReopen} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Circle size={14} /> 重新打开
            </button>
          </div>
          {archivedDoc && (
            <p className="mt-2 text-sm text-ink-2 flex items-center gap-1.5">
              <Paperclip size={13} /> 归档文件：{archivedDoc.name}
            </p>
          )}
        </div>
      )}

      {/* 详情卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">任务信息</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">类型</span><span>{typeLabel(task.type)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">状态</span><span className={`px-2 py-0.5 text-xs rounded-full ${taskStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">截止日期</span><span>{task.dueDate ? formatDate(task.dueDate) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">关联公司</span><span>{task.company ? <Link to={`/companies/${task.company._id}`} className="text-primary-600 hover:underline">{task.company.name}</Link> : '未关联'}</span></div>
            {task.meeting && (task.meeting._id || task.meeting) && (
              <div className="flex justify-between"><span className="text-ink-2">关联会议</span><span><Link to={`/meetings/${task.meeting._id || task.meeting}`} className="text-primary-600 hover:underline">查看会议纪要</Link></span></div>
            )}
            {task.taskSource && (
              <div className="flex justify-between"><span className="text-ink-2">来源</span><span>{task.taskSource === 'dashboard' ? 'Dashboard 发起' : task.taskSource === 'meeting' ? '会议衍生' : task.taskSource}</span></div>
            )}
            {task.isCTC && (
              <div className="flex justify-between"><span className="text-ink-2">CTC 文件</span><span className="text-danger font-medium">是</span></div>
            )}
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">完成要求</h3>
          <p className="text-sm text-ink-2 leading-relaxed">
            任务必须 <strong>填写完成备注</strong> 或 <strong>上传文件</strong> 后才能标记完成。若关联了公司，上传的附件将自动归档到该公司的文档库，确保底层数据联动。
          </p>
          {archivedDoc && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              <Paperclip size={14} /> {task?.meeting ? '已归入会议相关文件：' : '已归档：'}{archivedDoc.name}（{archivedDoc.docNumber}）
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
        warningText={`完成此任务需要${taskRequiresAttachment(task) ? '上传签署文件' : '填写备注或上传附件'}。${task.company ? '上传的附件将自动归档至「' + task.company.name + '」文档库。' : ''}`}
        requireAttachment={taskRequiresAttachment(task)}
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
