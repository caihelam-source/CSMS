import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, ArrowLeft, CheckCircle2,
  FileText, Send, PenLine, Eye, Copy, Pencil,
  Building2, AlertCircle, Download, Printer, Upload, Archive, ClipboardCheck
} from 'lucide-react'
import { meetingService, documentService, signTaskService, taskService } from '../services/index.js'
import { formatDate, MEETING_TYPE_LABELS as TYPES, fmtDate, fmtTime, buildPhasesWithIcons, MEETING_ARCHIVE_CHECKLIST, docMatchesChecklistItem, detectMinutesKeywords, buildSignTaskTitle, buildSourceLabel } from '../utils/helpers'
import { validate, required } from '../utils/validators'
import { LoadingSpinner, DetailHeader, FormField, inputClass, InfoCard, TabNav } from '../components/UIHelpers'
import Modal from '../components/Modal'

// Phase icon mapping — uses shared buildPhasesWithIcons
const PHASES = buildPhasesWithIcons({ PenLine, Clock3: Clock, Send, CheckCircle2, FileText, AlertCircle })

// 会议全流程步骤：通知 → 附件 → 纪要 → 签字 → 归档
const MEETING_FLOW = [
  { key: 'notice', label: '会议通知' },
  { key: 'attachment', label: '上传附件' },
  { key: 'minutes', label: '会议纪要' },
  { key: 'sign', label: '签字' },
  { key: 'archive', label: '归档' },
]

// 文件签署状态徽章（Document.signStatus）
const SIGN_STATUS_BADGE = {
  draft: { label: '草稿', cls: 'bg-gray-100 text-ink-2' },
  pending_sign: { label: '待签署', cls: 'bg-warning/10 text-warning' },
  partially_signed: { label: '部分签署', cls: 'bg-info/10 text-primary-700' },
  fully_signed: { label: '已签署', cls: 'bg-success/10 text-success' },
  archived: { label: '已归档', cls: 'bg-success/10 text-success' },
}

const ATTACH_FORM_RULES = { name: [required('文件名称为必填')] }

function computeMeetingSteps(meeting, documents) {
  const phase = meeting?.phase || 'setup'
  const noticeDone = ['notice-sent', 'meeting-held', 'minutes-draft', 'minutes-signed', 'completed'].includes(phase) || !!meeting?.notice
  const minutesDone = meeting?.minutes?.status === 'final' || meeting?.minutes?.status === 'signed' || !!meeting?.resolutions?.length
  const signDone = (meeting?.signatures?.length || 0) > 0 || (meeting?.signTasks || []).some(st => st.status === 'completed')
  const archiveDone = meeting?.phase === 'completed'
  return {
    notice: !!noticeDone,
    attachment: (documents?.length || 0) > 0,
    minutes: !!minutesDone,
    sign: !!signDone,
    archive: !!archiveDone,
  }
}

export default function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Data for tabs
  const [noticeData, setNoticeData] = useState(null)
  const [minutesData, setMinutesData] = useState(null)
  const [documents, setDocuments] = useState([])
  const [signTasks, setSignTasks] = useState([])
  // v5.1 纪要闭环：关联签署 Task（用于纪要页状态面板 + 归档防呆门禁）
  const [meetingTasks, setMeetingTasks] = useState([])

  // 编辑模式状态（通知 / 纪要）
  const [editingNotice, setEditingNotice] = useState(false)
  const [editingMinutes, setEditingMinutes] = useState(false)
  const [editedNoticeText, setEditedNoticeText] = useState('')
  const [editedMinutesText, setEditedMinutesText] = useState('')

  // Actions
  const [generating, setGenerating] = useState(null) // 'notice' | 'minutes'

  // 上传文件（相关文件 / 清单补齐，统一归属会议+公司）
  const [attachModal, setAttachModal] = useState(false)
  const [attachForm, setAttachForm] = useState({ name: '', type: 'minutes', file: null })
  const [attachErrors, setAttachErrors] = useState({})

  // 签署扫描件上传
  const [scanModal, setScanModal] = useState({ open: false, signTask: null, file: null })
  const [scanErrors, setScanErrors] = useState({})

  // Signing — 从会议发起签署任务（关联 meetingId）
  const [signModal, setSignModal] = useState(false)
  const [signForm, setSignForm] = useState({ title: '', priority: 'medium', signerIds: [] })
  const [signErrors, setSignErrors] = useState({})

  const fetchMeeting = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await meetingService.getOne(id)
      setMeeting(data.data)
      // 相关文件：仅加载本会议关联的文档（Document.meeting = id），并补齐签署任务
      const { data: docRes } = await documentService.getAll({ meetingId: id }).catch(() => ({ data: { data: [] } }))
      setDocuments(docRes.data || [])
      const { data: stRes } = await signTaskService.getAll().catch(() => ({ data: { data: [] } }))
      const all = stRes?.data || []
      setSignTasks(all.filter(st => st.relatedMeeting?._id === id || st.meeting?._id === id))
      // v5.1 关联签署 Task（会议纪要关键词自动生成 / 手动发起均在此）
      const { data: tkRes } = await taskService.getAll({ meetingId: id }).catch(() => ({ data: { data: [] } }))
      setMeetingTasks(tkRes?.data || [])
    } catch {
      toast.error('无法加载会议详情')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchMeeting() }, [fetchMeeting])

  const generateNotice = useCallback(async () => {
    setGenerating('notice')
    try {
      const { data } = await meetingService.getNotice(id)
      setNoticeData(data.data)
      toast.success('会议通知已生成')
    } catch {
      toast.error('生成通知失败')
    } finally {
      setGenerating(null)
    }
  }, [id])

  const generateMinutes = useCallback(async () => {
    setGenerating('minutes')
    try {
      const { data } = await meetingService.getMinutes(id)
      setMinutesData(data.data)
      // 生成后标记纪要状态为 final，并推进阶段，强制引导"必须签署"
      const minutesPatch = { ...(meeting?.minutes || {}), status: 'final' }
      const { data: upd } = await meetingService.update(id, { minutes: minutesPatch, phase: 'minutes-draft' }).catch(() => ({ data: { data: meeting } }))
      setMeeting(upd?.data || meeting)
      // v5.1 #2.1 关键词自动识别：纪要正文含"签署/签字/盖章"等 → 自动生成签署 Task
      const text = data.data?.text || data.data?.body || ''
      const keywords = detectMinutesKeywords(text)
      const alreadyHas = meetingTasks.some(t => t.type === 'signing' && (t.meeting?._id === id || t.meeting === id))
      if (keywords.length && !alreadyHas) {
        const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
        const { data: tkRes } = await taskService.create({
          title: buildSignTaskTitle(meeting?.title, keywords),
          type: 'signing',
          priority: 'high',
          status: 'pending',
          meeting: { _id: id },
          dueDate: due,
          autoGenerated: true,
          responsiblePerson: meeting?.attendees?.[0]?.name || meeting?.chairperson || '待指派',
          company: meeting?.company
            ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
            : undefined,
          description: `系统识别到纪要含关键词「${keywords.join('、')}」，自动生成签署待办。`,
        }).catch(() => ({ data: { data: null } }))
        if (tkRes?.data) {
          toast.success(`检测到关键词「${keywords.join('、')}」，已自动生成签署任务`)
          setMeetingTasks(prev => [...prev, tkRes.data])
        }
      } else {
        toast.success('会议纪要已生成，请发起签署')
      }
    } catch {
      toast.error('生成纪要失败')
    } finally {
      setGenerating(null)
    }
  }, [id, meeting, meetingTasks])

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }, [])

  const uploadAttachment = useCallback(async () => {
    const { valid, errors } = validate(attachForm, ATTACH_FORM_RULES)
    if (!valid) { setAttachErrors(errors); return }
    setAttachErrors({})
    try {
      // 统一归属：meeting = 本会议，company = 所属公司 → 公司文件可见
      await documentService.create({
        name: attachForm.name,
        type: attachForm.type,
        category: 'meeting',
        meeting: id,
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        fileName: attachForm.file?.name,
        fileSize: attachForm.file?.size,
        createdAt: new Date().toISOString().split('T')[0],
      })
      toast.success('文件已上传并归入会议相关文件（同时归属公司）')
      setAttachModal(false)
      setAttachForm({ name: '', type: 'minutes', file: null })
      fetchMeeting()
    } catch {
      toast.error('上传失败')
    }
  }, [attachForm, meeting, id, fetchMeeting])

  // 上传签署扫描件 → 标记签署任务 + 关联 Task 完成
  const openScanModal = useCallback((st) => {
    setScanModal({ open: true, signTask: st, file: null })
    setScanErrors({})
  }, [])

  const uploadSignedScan = useCallback(async () => {
    const st = scanModal.signTask
    if (!scanModal.file) { setScanErrors({ file: '请选择签署扫描件' }); return }
    setScanErrors({})
    try {
      await documentService.create({
        name: `${meeting?.title || '会议'} 纪要签字版扫描件`,
        type: 'minutes',
        category: 'meeting',
        meeting: id,
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        signStatus: 'fully_signed',
        fileName: scanModal.file.name,
        fileSize: scanModal.file.size,
        fileUrl: '/scan/' + encodeURIComponent(scanModal.file.name),
        // v5.1 #3.1 来源追溯：扫描件标注来源 → 公司档案可点击跳回本会议
        source: {
          kind: 'signing_scan',
          refId: st.taskId || st._id,
          label: buildSourceLabel(meeting),
        },
        createdAt: new Date().toISOString().split('T')[0],
      })
      // 标记关联 Task 完成（连带 hasAttachment，满足 #2.3 完成门禁）
      if (st.taskId) {
        await taskService.update(st.taskId, {
          status: 'completed',
          hasAttachment: true,
          completedDate: new Date().toISOString().split('T')[0],
        }).catch(() => {})
      }
      // 标记签署任务本身完成
      await signTaskService.update(st._id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      }).catch(() => {})
      toast.success('签署扫描件已上传，任务标记完成')
      setScanModal({ open: false, signTask: null, file: null })
      fetchMeeting()
    } catch {
      toast.error('上传失败')
    }
  }, [scanModal, meeting, id, fetchMeeting])

  // 一键归档：本会议所有相关文件标记 archived + 锁定只读 + 会议推进到 completed
  const archiveAll = useCallback(async () => {
    if (documents.length === 0) { toast.error('暂无相关文件可归档'); return }
    // v5.1 #2.4 防呆：存在签署 Task 但均未完成 → 禁止归档会议
    const signingTasks = meetingTasks.filter(t => t.type === 'signing' && (t.meeting?._id === id || t.meeting === id))
    const hasUnfinishedSign = signingTasks.length > 0 && !signingTasks.some(t => t.status === 'completed')
    if (hasUnfinishedSign) {
      toast.error('请先完成签署任务（归档前必须有关联签署 Task 已完成）')
      return
    }
    try {
      const lockedAt = new Date().toISOString()
      for (const d of documents) {
        if (d.signStatus !== 'archived' || !d.locked) {
          // v5.1 #3.4 归档锁定：文件变为只读（无法删除/修改）
          await documentService.update(d._id, { signStatus: 'archived', locked: true, lockedAt }).catch(() => {})
        }
      }
      await meetingService.updateStatus(id, { phase: 'completed', status: 'completed' })
      toast.success('已全部归档，会议完成（相关文件已锁定为只读）')
      fetchMeeting()
    } catch {
      toast.error('归档失败')
    }
  }, [documents, meetingTasks, id, fetchMeeting])

  // 发起签署任务（关联本会议 meetingId）→ 同步创建对应 signing Task
  const openSignModal = useCallback(() => {
    setSignForm({
      title: `${meeting?.title || '会议'} — 签署任务`,
      priority: 'medium',
      signerIds: (meeting?.attendees || []).map(a => a._id),
    })
    setSignErrors({})
    setSignModal(true)
  }, [meeting])

  const createSignTask = useCallback(async () => {
    const { valid, errors } = validate(signForm, { title: [required('任务标题为必填')] })
    if (!valid) { setSignErrors(errors); return }
    setSignErrors({})
    try {
      const signers = (meeting?.attendees || [])
        .filter(a => signForm.signerIds.includes(a._id))
        .map(a => ({ _id: a._id, name: a.name, role: a.role || '签署人', status: 'pending' }))
      const { data: stRes } = await signTaskService.create({
        title: signForm.title,
        priority: signForm.priority,
        status: 'pending',
        relatedMeeting: meeting ? { _id: meeting._id, title: meeting.title } : null,
        relatedCompany: meeting?.company
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : null,
        signers: signers.length
          ? signers
          : [{ _id: 's' + Date.now(), name: '签署人', status: 'pending' }],
      })
      // 同步创建对应 Task（type: signing），让签署任务在 Task 列表中可追踪、可完成
      try {
        const { data: tRes } = await taskService.create({
          title: `签署：${signForm.title}`,
          type: 'signing',
          priority: signForm.priority,
          status: 'pending',
          meeting: { _id: id },
          dueDate: meeting?.scheduledAt || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          description: `从会议「${meeting?.title || ''}」发起的签署任务，需 ${signers.length} 人签署。`,
          company: meeting?.company
            ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
            : undefined,
        })
        // 互链：把 Task._id 写回 SignTask，便于上传扫描件时一键标记完成
        if (stRes?.data?._id && tRes?.data?._id) {
          await signTaskService.update(stRes.data._id, { taskId: tRes.data._id }).catch(() => {})
        }
      } catch (taskErr) {
        console.warn('签署任务已创建，但关联 Task 创建失败（非阻塞）:', taskErr)
      }
      toast.success('签署任务已发起（已同步创建对应签署 Task）')
      setSignModal(false)
      fetchMeeting()
    } catch {
      toast.error('发起失败')
    }
  }, [signForm, meeting, id, fetchMeeting])

  if (loading) {
    return <LoadingSpinner text="加载会议详情..." />
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-2">会议不存在</p>
        <button onClick={() => navigate('/meetings')} className="mt-4 text-primary-600 hover:underline">
          返回会议列表
        </button>
      </div>
    )
  }

  const phase = PHASES[meeting.phase] || PHASES.setup
  const PhaseIcon = phase.icon
  const checklist = MEETING_ARCHIVE_CHECKLIST[meeting.type] || MEETING_ARCHIVE_CHECKLIST.other

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailHeader
        onBack={() => navigate('/meetings')}
        title={meeting.title}
        subtitle={
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${phase.color}`}>
              <PhaseIcon size={14} />{phase.label}
            </span>
            {meeting.company?.name && (
              <Link to={`/companies/${meeting.company?._id}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                <Building2 size={14} /> {meeting.company.name}
              </Link>
            )}
            <span className="flex items-center gap-1"><Calendar size={14} />{fmtDate(meeting.scheduledAt)}</span>
            <span className="flex items-center gap-1"><Clock size={14} />{fmtTime(meeting.scheduledAt)} {meeting.duration ? `(${meeting.duration}分钟)` : ''}</span>
          </div>
        }
        initials={meeting.title?.charAt(0) || 'M'}
      />

      {/* 会议全流程进度 */}
      <div className="bg-surface rounded-xl border border-hairline p-4">
        <p className="text-xs text-ink-3 mb-3">会议全流程（通知 → 附件 → 纪要 → 签字 → 归档）</p>
        <div className="flex items-center">
          {MEETING_FLOW.map((step, i) => {
            const done = computeMeetingSteps(meeting, documents)[step.key]
            const isLast = i === MEETING_FLOW.length - 1
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done ? 'bg-success text-white' : 'bg-gray-100 text-ink-2'}`}>
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span className={`mt-1 text-xs ${done ? 'text-success font-medium' : 'text-ink-3'}`}>{step.label}</span>
                </div>
                {!isLast && <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-success' : 'bg-gray-100'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <TabNav
        tabs={[
          { key: 'overview', label: '概览' },
          { key: 'notice', label: '会议通知' },
          { key: 'minutes', label: '会议纪要' },
          { key: 'documents', label: '相关文件' },
          { key: 'signing', label: '签署任务', icon: PenLine },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="bg-surface rounded-xl border border-hairline p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard title="基本信息">
                <dl className="space-y-2 text-sm">
                  <div className="flex"><dt className="w-20 text-ink-3 shrink-0">类型：</dt><dd>{TYPES[meeting.type] || meeting.type || '-'}</dd></div>
                  <div className="flex"><dt className="w-20 text-ink-3 shrink-0">日期：</dt><dd>{fmtDate(meeting.scheduledAt)}</dd></div>
                  <div className="flex"><dt className="w-20 text-ink-3 shrink-0">时间：</dt><dd>{fmtTime(meeting.scheduledAt)}</dd></div>
                  <div className="flex"><dt className="w-20 text-ink-3 shrink-0">地点：</dt><dd>{meeting.location || '-'}</dd></div>
                  {meeting.isVirtual && <div className="flex"><dt className="w-20 text-ink-3 shrink-0">会议号：</dt><dd className="font-mono">{meeting.meetingId || '-'}</dd></div>}
                  {meeting.meetingLink && <div className="flex"><dt className="w-20 text-ink-3 shrink-0">链接：</dt><dd><a href={meeting.meetingLink} target="_blank" rel="noopener" className="text-primary-600 hover:underline text-xs truncate">{meeting.meetingLink}</a></dd></div>}
                </dl>
              </InfoCard>
              <InfoCard title="关联信息">
                <dl className="space-y-2 text-sm">
                  <div className="flex"><dt className="w-20 text-ink-3 shrink-0">公司：</dt><dd className="font-medium">{meeting.company?.name || '-'}</dd></div>
                  {meeting.notice?.sentAt && <div className="flex"><dt className="w-20 text-ink-3 shrink-0">通知发送：</dt><dd>{fmtDate(meeting.notice.sentAt)}</dd></div>}
                  {meeting.minutes?.signedAt && <div className="flex"><dt className="w-20 text-ink-3 shrink-0">纪要签署：</dt><dd className="text-success">{fmtDate(meeting.minutes.signedAt)}</dd></div>}
                </dl>
              </InfoCard>
            </div>

            {/* Attendees */}
            {meeting.attendees?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-ink-2 mb-3">参会人员 ({meeting.attendees.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {meeting.attendees.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-canvas rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                        {a.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-ink-3 truncate">{a.role || '-'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.status === 'attended' ? 'bg-success/10 text-success'
                        : a.status === 'accepted' ? 'bg-info/10 text-primary-700'
                        : 'bg-gray-100 text-ink-2'
                      }`}>
                        {a.status === 'attended' ? '出席' : a.status === 'accepted' ? '已确认' : a.status === 'declined' ? '已拒绝' : '待确认'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agenda */}
            {meeting.agenda?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-ink-2 mb-3">会议议程</h4>
                <div className="space-y-2">
                  {meeting.agenda.map((a, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-canvas rounded-lg text-sm">
                      <span className="text-ink-3 font-bold w-6 shrink-0 text-right">{i + 1}.</span>
                      <span className="flex-1">{a.item || '未填写'}</span>
                      {a.presenter && <span className="text-ink-3 text-xs">主讲：{a.presenter}</span>}
                      {a.duration && <span className="text-ink-3 text-xs">{a.duration}分钟</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolutions */}
            {meeting.resolutions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-ink-2 mb-3">决议</h4>
                <div className="space-y-2">
                  {meeting.resolutions.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-canvas rounded-lg text-sm">
                      <span>{r.title || '未填写'}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        r.status === 'approved' ? 'bg-success/10 text-success'
                        : r.status === 'rejected' ? 'bg-danger/10 text-danger'
                        : 'bg-gray-100 text-ink-2'
                      }`}>
                        {r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '未通过' : '待决议'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTICE TAB */}
        {activeTab === 'notice' && (
          <div className="space-y-4">
            {!noticeData ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-ink-2 mb-4">尚未生成会议通知</p>
                <button
                  onClick={generateNotice}
                  disabled={generating === 'notice'}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {generating === 'notice' ? (
                    <LoadingSpinner size="xs" variant="inline" />
                  ) : (
                    <FileText size={16} />
                  )}
                  {generating === 'notice' ? '生成中...' : '生成会议通知'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => copyText(editingNotice ? editedNoticeText : noticeData.text)} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                    <Copy size={14} /> 复制文案
                  </button>
                  {(noticeData.html || editingNotice) && (
                    <button
                      onClick={() => {
                        if (editingNotice) {
                          setEditingNotice(false)
                        } else {
                          setEditedNoticeText(noticeData.text)
                          setEditingNotice(true)
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 text-sm ${editingNotice ? 'btn-primary' : 'btn-secondary text-primary-600'}`}
                    >
                      {editingNotice ? <><CheckCircle2 size={14} /> 完成编辑</> : <><Pencil size={14} /> 编辑</>}
                    </button>
                  )}
                  {!editingNotice && noticeData.html && (
                    <button
                      onClick={() => { const w = window.open(''); w.document.write(noticeData.html); w.document.close() }}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-primary-600"
                    >
                      <Eye size={14} /> 预览HTML
                    </button>
                  )}
                </div>
                {editingNotice ? (
                  <div className="space-y-3">
                    <p className="text-xs text-ink-2">编辑通知内容（修改后可复制或退出编辑预览）：</p>
                    <textarea
                      value={editedNoticeText}
                      onChange={e => setEditedNoticeText(e.target.value)}
                      rows={16}
                      className="w-full px-4 py-3 border border-hairline rounded-lg text-sm font-sans leading-relaxed focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { copyText(editedNoticeText) }} className="btn-primary inline-flex items-center gap-1.5 text-sm">
                        <Copy size={14} /> 复制已编辑内容
                      </button>
                      <button onClick={() => { setEditingNotice(false); setEditedNoticeText('') }} className="btn-secondary text-sm">
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface p-4 rounded-lg border">
                    {noticeData.html ? (
                      <iframe srcDoc={noticeData.html} className="w-full min-h-[300px] border-0" title="notice-preview" />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans text-ink">{noticeData.text}</pre>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MINUTES TAB */}
        {activeTab === 'minutes' && (
          <div className="space-y-4">
            {!minutesData ? (
              <div className="text-center py-12">
                <PenLine size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-ink-2 mb-4">尚未生成会议纪要</p>
                <button
                  onClick={generateMinutes}
                  disabled={generating === 'minutes'}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {generating === 'minutes' ? (
                    <LoadingSpinner size="xs" variant="inline" />
                  ) : (
                    <PenLine size={16} />
                  )}
                  {generating === 'minutes' ? '生成中...' : '生成会议纪要'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => copyText(editingMinutes ? editedMinutesText : minutesData.text)} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                    <Copy size={14} /> 复制文案
                  </button>
                  {(minutesData.html || editingMinutes) && (
                    <button
                      onClick={() => {
                        if (editingMinutes) {
                          setEditingMinutes(false)
                        } else {
                          setEditedMinutesText(minutesData.text)
                          setEditingMinutes(true)
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 text-sm ${editingMinutes ? 'btn-primary' : 'btn-secondary text-primary-600'}`}
                    >
                      {editingMinutes ? <><CheckCircle2 size={14} /> 完成编辑</> : <><Pencil size={14} /> 编辑</>}
                    </button>
                  )}
                  {!editingMinutes && minutesData.html && (
                    <button
                      onClick={() => { const w = window.open(''); w.document.write(minutesData.html); w.document.close() }}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-primary-600"
                    >
                      <Eye size={14} /> 预览HTML
                    </button>
                  )}
                </div>
                {editingMinutes ? (
                  <div className="space-y-3">
                    <p className="text-xs text-ink-2">编辑纪要内容（修改后可复制或退出编辑预览）：</p>
                    <textarea
                      value={editedMinutesText}
                      onChange={e => setEditedMinutesText(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-3 border border-hairline rounded-lg text-sm font-sans leading-relaxed focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { copyText(editedMinutesText) }} className="btn-primary inline-flex items-center gap-1.5 text-sm">
                        <Copy size={14} /> 复制已编辑内容
                      </button>
                      <button onClick={() => { setEditingMinutes(false); setEditedMinutesText('') }} className="btn-secondary text-sm">
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface p-4 rounded-lg border">
                    {minutesData.html ? (
                      <iframe srcDoc={minutesData.html} className="w-full min-h-[300px] border-0" title="minutes-preview" />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans text-ink">{minutesData.text}</pre>
                    )}
                  </div>
                )}

                {/* Signatures */}
                {minutesData.signatures?.length > 0 && !editingMinutes && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-ink-2 mb-2">签署状态</h4>
                    <div className="space-y-2">
                      {minutesData.signatures.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-canvas rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-ink-3">{s.title}</p>
                          </div>
                          {s.status === 'signed' ? (
                            <span className="text-xs text-success font-medium flex items-center gap-1">
                              <CheckCircle2 size={14} /> 已签署
                              {s.signedAt && <span className="text-ink-3 ml-1">({fmtDate(s.signedAt)})</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <Clock size={14} /> 待签署
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 强制引导：纪要已生成 → 必须发起签署 */}
                {!editingMinutes && (meeting.minutes?.status === 'final' || meeting.minutes?.status === 'signed') && signTasks.length === 0 && (
                  <div className="mt-4 bg-primary-50 border border-primary-200 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-primary-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-primary-700">会议纪要已生成，需发起签署</p>
                        <p className="text-xs text-ink-3 mt-0.5">签署将形成一项 Task，签署人完成签署并上传扫描件后该任务方可标记完成。</p>
                      </div>
                    </div>
                    <button onClick={openSignModal} className="btn-primary inline-flex items-center gap-1.5 text-sm shrink-0">
                      <PenLine size={14} /> 发起签署
                    </button>
                  </div>
                )}

                {/* v5.1 #2.4 防呆：纪要页展示关联签署 Task 状态（待签署/已完成），未关联禁止归档 */}
                {!editingMinutes && (() => {
                  const mt = meetingTasks.filter(t => t.type === 'signing' && (t.meeting?._id === id || t.meeting === id))
                  if (mt.length === 0) return null
                  return (
                    <div className="mt-4 bg-canvas border border-hairline rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-ink-2 mb-3 flex items-center gap-2"><ClipboardCheck size={16} /> 关联签署任务状态</h4>
                      <div className="space-y-2">
                        {mt.map(t => {
                          const done = t.status === 'completed'
                          return (
                            <div key={t._id} className="flex items-center justify-between p-2 bg-surface rounded-lg">
                              <div className="flex items-center gap-2 min-w-0">
                                {done
                                  ? <CheckCircle2 size={16} className="text-success shrink-0" />
                                  : <Clock size={16} className="text-warning shrink-0" />}
                                <span className="text-sm truncate">{t.title}</span>
                                {t.autoGenerated && <span className="text-[10px] bg-info/10 text-primary-700 px-1.5 py-0.5 rounded-full shrink-0">自动</span>}
                                {t.responsiblePerson && <span className="text-xs text-ink-3 shrink-0">负责人：{t.responsiblePerson}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${done ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{done ? '已完成' : '待签署'}</span>
                                <Link to={`/tasks/${t._id}`} className="text-xs text-primary-600 hover:underline">查看</Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB — 相关文件（按会议归属） */}
        {activeTab === 'documents' && (
          <div className="space-y-5">
            {/* 会议归档清单 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-ink-2">会议归档清单</h4>
                <button
                  onClick={archiveAll}
                  disabled={documents.length === 0}
                  className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
                >
                  <Archive size={14} /> 全部归档
                </button>
              </div>
              <p className="text-xs text-ink-3 mb-3">
                按会议类型应归档的文件；缺失项请上传补齐，全部上传后可一键归档。归档后文件仍归属公司，可在公司详情页「文件」中查看。
              </p>
              <div className="space-y-2">
                {checklist.map((item, i) => {
                  const uploaded = documents.some(d => docMatchesChecklistItem(d, item))
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-hairline">
                      <div className="flex items-center gap-2">
                        {uploaded
                          ? <CheckCircle2 size={16} className="text-success" />
                          : <Clock size={16} className="text-warning" />}
                        <span className={`text-sm ${uploaded ? 'text-ink' : 'text-ink-2'}`}>{item.label}</span>
                        {uploaded && <span className="text-xs text-success">已上传</span>}
                      </div>
                      {!uploaded && (
                        <button
                          onClick={() => { setAttachForm({ name: item.label, type: item.type, file: null }); setAttachModal(true) }}
                          className="btn-secondary inline-flex items-center gap-1 text-xs"
                        >
                          <Upload size={12} /> 上传
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 已关联文件 */}
            <div>
              <h4 className="text-sm font-semibold text-ink-2 mb-2">已关联文件（{documents.length}）</h4>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-ink-3">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无相关文件，请从上方清单或下方按钮上传</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc._id} className="flex items-center justify-between p-3 bg-canvas rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-ink-3" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <div className="flex items-center gap-2 text-xs text-ink-3">
                            <span>{formatDate(doc.createdAt)}</span>
                            {doc.signStatus && SIGN_STATUS_BADGE[doc.signStatus] && (
                              <span className={`px-1.5 py-0.5 rounded-full ${SIGN_STATUS_BADGE[doc.signStatus].cls}`}>
                                {SIGN_STATUS_BADGE[doc.signStatus].label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener" className="p-1.5 text-ink-3 hover:text-primary-600 rounded">
                            <Download size={14} />
                          </a>
                        )}
                        <button className="p-1.5 text-ink-3 hover:text-ink-2 rounded">
                          <Printer size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setAttachForm({ name: '', type: 'minutes', file: null }); setAttachModal(true) }}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm mt-3"
              >
                <Upload size={14} /> 上传其他文件
              </button>
            </div>
          </div>
        )}

        {/* SIGNING TAB — v5.0: 签署任务并入会议 */}
        {activeTab === 'signing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink-2">关联签署任务 ({signTasks.length})</h4>
              <button onClick={openSignModal} className="btn-primary flex items-center gap-1.5 text-sm">
                <PenLine size={14} /> 发起签署任务
              </button>
            </div>
            {signTasks.length === 0 ? (
              <div className="text-center py-12 text-ink-3">
                <PenLine size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无关联签署任务</p>
                <p className="text-xs mt-1">生成会议纪要后，可在此发起签署（将同步生成签署 Task）</p>
              </div>
            ) : (
              <div className="space-y-3">
                {signTasks.map(st => {
                  const allSigned = (st.signers || []).length > 0 && (st.signers || []).every(s => s.status === 'signed')
                  const canUpload = st.status === 'completed' || allSigned
                  return (
                    <div key={st._id} className="border border-hairline rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{st.title}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          st.status === 'completed' ? 'bg-success/10 text-success'
                          : st.status === 'in_progress' ? 'bg-info/10 text-primary-700'
                          : 'bg-gray-100 text-ink-2'
                        }`}>{st.status}</span>
                      </div>
                      {st.signers?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {st.signers.map((s, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-ink-2">{s.signerName || s.name || '签署人'}</span>
                              <span className={s.status === 'signed' ? 'text-success' : 'text-warning'}>
                                {s.status === 'signed' ? '已签署' : '待签署'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {canUpload && (
                        <button
                          onClick={() => openScanModal(st)}
                          className="mt-3 btn-primary inline-flex items-center gap-1.5 text-sm"
                        >
                          <Upload size={14} /> 上传签署扫描件
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={() => navigate(`/meetings`)} className="btn-secondary">
          <ArrowLeft size={16} /> 返回列表
        </button>
        <button onClick={() => navigate(`/meetings`)} className="btn-primary">
          <Pencil size={16} /> 编辑会议
        </button>
      </div>

      {/* Attachment / Checklist Upload Modal */}
      <Modal isOpen={attachModal} onClose={() => setAttachModal(false)} title="上传会议文件" size="md">
        <div className="space-y-4">
          <FormField label="文件名称" required error={attachErrors.name}>
            <input
              className={inputClass}
              value={attachForm.name}
              onChange={e => { setAttachForm({ ...attachForm, name: e.target.value }); setAttachErrors(ae => ({ ...ae, name: '' })) }}
              placeholder="例如：董事签字页扫描件"
            />
          </FormField>
          <FormField label="文件类型">
            <select
              className={inputClass}
              value={attachForm.type}
              onChange={e => setAttachForm({ ...attachForm, type: e.target.value })}
            >
              <option value="minutes">纪要</option>
              <option value="resolution">决议</option>
              <option value="board_resolution">董事会决议</option>
              <option value="notice">通知</option>
              <option value="annual_report">周年申报表</option>
              <option value="agreement">协议</option>
              <option value="other">其他</option>
            </select>
          </FormField>
          <FormField label="选择文件">
            <input type="file" className={inputClass}
              onChange={e => setAttachForm({ ...attachForm, file: e.target.files[0] || null })} />
          </FormField>
          <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg text-sm text-warning flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>文件将自动关联到本会议（{meeting?.title}），并归属公司（{meeting?.company?.name}），在公司详情页「文件」中可见。</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAttachModal(false)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={uploadAttachment} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认上传</button>
          </div>
        </div>
      </Modal>

      {/* Sign Scan Upload Modal */}
      <Modal isOpen={scanModal.open} onClose={() => setScanModal({ open: false, signTask: null, file: null })} title="上传签署扫描件" size="md">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">上传已签署的会议纪要扫描件，系统将把该签署任务与关联 Task 标记为完成，并将扫描件归入会议相关文件（归属公司）。</p>
          <FormField label="签署扫描件" required error={scanErrors.file}>
            <input type="file" className={inputClass}
              onChange={e => { setScanModal(sm => ({ ...sm, file: e.target.files[0] || null })); setScanErrors(se => ({ ...se, file: '' })) }} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setScanModal({ open: false, signTask: null, file: null })} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={uploadSignedScan} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认上传并标记完成</button>
          </div>
        </div>
      </Modal>

      {/* Sign Task Modal — 从会议发起签署任务（关联 meetingId） */}
      <Modal isOpen={signModal} onClose={() => setSignModal(false)} title="发起签署任务" size="md">
        <div className="space-y-4">
          <FormField label="任务标题" required error={signErrors.title}>
            <input
              className={inputClass}
              value={signForm.title}
              onChange={e => { setSignForm({ ...signForm, title: e.target.value }); setSignErrors(se => ({ ...se, title: '' })) }}
              placeholder="例如：签署 CNC 2025年度会议纪要"
            />
          </FormField>
          <FormField label="优先级">
            <select className={inputClass} value={signForm.priority}
              onChange={e => setSignForm({ ...signForm, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </FormField>
          <FormField label="签署人（从参会人员选择）">
            <div className="space-y-1 max-h-48 overflow-y-auto border border-hairline rounded-lg p-2">
              {(meeting?.attendees || []).length === 0 && (
                <p className="text-xs text-ink-3">该会议暂无参会人员</p>
              )}
              {(meeting?.attendees || []).map(a => (
                <label key={a._id} className="flex items-center gap-2 p-1.5 rounded hover:bg-canvas text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signForm.signerIds.includes(a._id)}
                    onChange={() => setSignForm(sf => ({
                      ...sf,
                      signerIds: sf.signerIds.includes(a._id)
                        ? sf.signerIds.filter(x => x !== a._id)
                        : [...sf.signerIds, a._id],
                    }))}
                  />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-xs text-ink-3">{a.role || '-'}</span>
                </label>
              ))}
            </div>
          </FormField>
          <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg text-sm text-warning flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>签署任务将关联至本会议（meetingId: {meeting?._id}），发起后可在「签署任务」列表与会议签署页查看，并同步生成一项签署 Task 便于追踪与标记完成。</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSignModal(false)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={createSignTask} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认发起</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
