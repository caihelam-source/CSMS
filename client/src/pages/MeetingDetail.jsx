import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, ArrowLeft, CheckCircle2,
  FileText, Send, PenLine, Eye, Copy, Pencil,
  Building2, AlertCircle, Download, Upload, Archive, ClipboardCheck, Lock
} from 'lucide-react'
import { meetingService, documentService, signTaskService, taskService } from '../services/index.js'
import { formatDate, MEETING_TYPE_LABELS as TYPES, fmtDate, fmtTime, buildPhasesWithIcons, getMeetingChecklist, docMatchesChecklistItem, detectMinutesKeywords, buildSignTaskTitle, buildSourceLabel, buildArchiveDocName, archiveTypeLabel } from '../utils/helpers'
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
  draft: { label: '草稿', cls: 'bg-canvas text-ink-2' },
  pending_sign: { label: '待签署', cls: 'bg-warning/10 text-warning' },
  partially_signed: { label: '部分签署', cls: 'bg-info/10 text-primary-700' },
  fully_signed: { label: '已签署', cls: 'bg-success/10 text-success' },
  archived: { label: '已归档', cls: 'bg-success/10 text-success' },
}

const ATTACH_FORM_RULES = { name: [required('文件名称为必填')] }

function computeMeetingSteps(meeting, documents, tasks) {
  const phase = meeting?.phase || 'setup'
  const noticeDone = ['notice-sent', 'meeting-held', 'minutes-draft', 'minutes-signed', 'completed'].includes(phase) || !!meeting?.notice
  const minutesDone = meeting?.minutes?.status === 'final' || meeting?.minutes?.status === 'signed' || !!meeting?.resolutions?.length
  // v6.0 增强：同时检查 meeting 嵌入的 signTasks 和本地 meetingTasks（Task 记录）
  const signFromSignTasks = (meeting?.signTasks || []).some(st => st.status === 'completed')
  const signFromTasks = (tasks || []).some(t => t.type === 'signing' && t.status === 'completed')
  const signDone = (meeting?.signatures?.length || 0) > 0 || signFromSignTasks || signFromTasks
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
  // v6.0 内联完成：签署 Tab 不再外跳 /tasks/:id（避免 mock ID 在真实 Atlas 404）
  const [inlineCompleteOpen, setInlineCompleteOpen] = useState(false)
  const [inlineTargetTask, setInlineTargetTask] = useState(null)
  const [inlineNote, setInlineNote] = useState('')
  const [inlineFile, setInlineFile] = useState(null)
  const [inlineSaving, setInlineSaving] = useState(false)

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

  // v6.0 定稿状态：通知/纪要是否已定稿（创建对应 Document 记录）
  const [noticeFinalized, setNoticeFinalized] = useState(false)
  const [minutesFinalized, setMinutesFinalized] = useState(false)

  const fetchMeeting = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await meetingService.getOne(id)
      setMeeting(data.data)
      // v5.2 修复：重进页面时从 meeting.notice / meeting.minutes 还原最新版本，避免"生成后点入就没了"
      if (data.data?.notice) setNoticeData(data.data.notice)
      if (data.data?.minutes) setMinutesData(data.data.minutes)
      // 相关文件：仅加载本会议关联的文档（Document.meeting = id），并补齐签署任务
      const { data: docRes } = await documentService.getAll({ meetingId: id }).catch(() => ({ data: { data: [] } }))
      const docs = docRes.data || []
      setDocuments(docs)
      // v6.0 检测通知/纪要是否已定稿（有对应 Document 记录）
      setNoticeFinalized(docs.some(d => d.source?.kind === 'meeting_notice'))
      setMinutesFinalized(docs.some(d => d.source?.kind === 'meeting_minutes'))
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
      const notice = { ...data.data, generatedAt: new Date().toISOString() }
      // v5.2 修复：生成的会议通知落库到 meeting.notice，重进页面仍呈现最新版本
      await meetingService.update(id, {
        notice,
        phase: meeting?.phase === 'draft' ? 'notice-sent' : meeting?.phase,
      }).catch(() => {})
      setNoticeData(notice)
      setMeeting(prev => ({ ...prev, notice, phase: prev.phase === 'draft' ? 'notice-sent' : prev.phase }))
      toast.success('会议通知已生成')
    } catch {
      toast.error('生成通知失败')
    } finally {
      setGenerating(null)
    }
  }, [id, meeting])

  const generateMinutes = useCallback(async () => {
    setGenerating('minutes')
    try {
      const { data } = await meetingService.getMinutes(id)
      setMinutesData(data.data)
      // 生成后标记纪要状态为 final，并推进阶段，强制引导"必须签署"
      // v5.2 修复：把生成的纪要正文一并落库到 meeting.minutes（含 status），重进页面仍呈现最新版本
      const minutesPatch = {
        ...(meeting?.minutes || {}),
        status: 'final',
        text: data.data?.text,
        html: data.data?.html,
        generatedAt: new Date().toISOString(),
      }
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

  // v5.2 修复：编辑通知 / 纪要后落库，确保"编辑后呈现最新版本"
  const saveNoticeEdit = useCallback(async () => {
    if (!noticeData) return
    // v5.2 fix: 保留原有 html 不清空，编辑纯文本不应破坏预览模板
    const updated = { ...noticeData, text: editedNoticeText, editedAt: new Date().toISOString() }
    await meetingService.update(id, { notice: updated }).catch(() => {})
    setNoticeData(updated)
    setMeeting(prev => ({ ...prev, notice: updated }))
    setEditingNotice(false)
    setEditedNoticeText('')
    toast.success('会议通知已更新')
  }, [id, noticeData, editedNoticeText])

  const saveMinutesEdit = useCallback(async () => {
    if (!minutesData) return
    // v5.2 fix: 保留原有 html 不清空，编辑纯文本不应破坏预览模板
    const updated = { ...minutesData, text: editedMinutesText, editedAt: new Date().toISOString() }
    await meetingService.update(id, { minutes: updated }).catch(() => {})
    setMinutesData(updated)
    setMeeting(prev => ({ ...prev, minutes: updated }))
    setEditingMinutes(false)
    setEditedMinutesText('')
    toast.success('会议纪要已更新')
  }, [id, minutesData, editedMinutesText])

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }, [])

  // v5.2 fix: 保存为 Word 文档（.doc）— 用 HTML-Word 兼容格式，无需额外依赖
  const downloadWord = useCallback((data, filenamePrefix) => {
    const htmlContent = data.html || `<html><body><pre style="font-family: serif; white-space: pre-wrap;">${(data.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`
    const wordHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${filenamePrefix}</title></head>
      <body style="font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.6;">${htmlContent}</body>
      </html>`
    const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filenamePrefix}.doc`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filenamePrefix}.doc 已下载`)
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
        meeting: { _id: id },
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        fileName: attachForm.file?.name,
        fileSize: attachForm.file?.size,
        // v5.2 模块1：会议上传文件先"暂存"于会议子目录（staged=true），不进入公司库
        staged: true,
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
  const _openScanModalFn = useCallback((st) => {
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
        meeting: { _id: id },
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        signStatus: 'fully_signed',
        fileName: scanModal.file.name,
        fileSize: scanModal.file.size,
        fileUrl: '/scan/' + encodeURIComponent(scanModal.file.name),
        // v5.2 模块1：签署扫描件同样暂存于会议子目录
        staged: true,
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

  // 一键归档：本会议所有暂存文件批量移入公司档案库（重命名 + 解除暂存 + 锁定只读）
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
      const usedNames = new Set()
      for (const d of documents) {
        if (!d.staged && d.locked) continue // 已归档锁定，跳过
        // v5.2 模块1：按命名规则重命名 → 解除暂存（移入公司库）→ 锁定只读
        const typeLabel = archiveTypeLabel(meeting, d)
        let newName = buildArchiveDocName(meeting, meeting?.company, typeLabel)
        // v5.2 修复：同类型多文件（如多份"其他"）防重名，追加 (2)(3)...
        if (usedNames.has(newName)) {
          let i = 2
          while (usedNames.has(`${newName.replace('.pdf', '')} (${i}).pdf`)) i += 1
          newName = `${newName.replace('.pdf', '')} (${i}).pdf`
        }
        usedNames.add(newName)
        await documentService.update(d._id, {
          name: newName,
          staged: false,
          locked: true,
          lockedAt,
          signStatus: 'archived',
        }).catch(() => {})
      }
      await meetingService.updateStatus(id, { phase: 'completed', status: 'completed', archivedAt: new Date().toISOString() })
      toast.success('已全部归档并移入公司档案库，会议完成（文件只读）')
      fetchMeeting()
    } catch {
      toast.error('归档失败')
    }
  }, [documents, meetingTasks, meeting, id, fetchMeeting])

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
        const { data: tRes } =         await taskService.create({
          title: `签署：${signForm.title}`,
          type: 'signing',
          priority: signForm.priority,
          status: 'pending',
          meeting: { _id: id },
          // v5.2 模块4：标记来源为会议衍生，便于 Dashboard 统计区分
          taskSource: 'meeting',
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

  // ===== v6.0 内联完成：签署 Tab 内直接完成任务（不外跳 /tasks/:id）=====
  const openInlineComplete = useCallback((task) => {
    setInlineTargetTask(task)
    setInlineNote('')
    setInlineFile(null)
    setInlineCompleteOpen(true)
  }, [])

  const handleInlineComplete = useCallback(async () => {
    if (!inlineTargetTask) return
    const hasNote = inlineNote.trim().length > 0
    const hasFile = !!inlineFile
    if (!hasNote && !hasFile) {
      toast.error('请填写备注或上传文件')
      return
    }
    setInlineSaving(true)
    try {
      // 1. 上传文件（如有）
      if (hasFile) {
        await documentService.create({
          name: `${meeting?.title || '会议'}_签署文件`,
          type: 'minutes',
          category: 'meeting',
          meeting: { _id: id },
          company: meeting?.company?._id
            ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
            : undefined,
          signStatus: inlineTargetTask.isCTC ? 'ctc' : 'fully_signed',
          fileName: inlineFile.name,
          fileSize: inlineFile.size,
          staged: true,
          source: { kind: 'signing_scan', refId: inlineTargetTask._id, label: `来自签署任务：${inlineTargetTask.title}` },
          note: '由会议签署 Tab 完成',
          createdAt: new Date().toISOString().split('T')[0],
        })
      }
      // 2. 标记 Task 完成
      await taskService.update(inlineTargetTask._id, {
        status: 'completed',
        hasAttachment: hasFile || inlineTargetTask.hasAttachment,
      }).catch(() => {})
      // 3. 同步 SignTask（如有）
      const linkedST = signTasks.find(st => st.taskId === inlineTargetTask._id)
      if (linkedST?._id) {
        await signTaskService.update(linkedST._id, { status: 'completed', completedAt: new Date().toISOString() }).catch(() => {})
      }
      // 4. 立即更新本地状态（不等 fetchMeeting）
      setMeetingTasks(prev => prev.map(t =>
        t._id === inlineTargetTask._id ? { ...t, status: 'completed', hasAttachment: true } : t
      ))
      setSignTasks(prev => prev.map(st =>
        st.taskId === inlineTargetTask._id ? { ...st, status: 'completed' } : st
      ))
      // 5. 刷新会议数据（更新 checklist 等）
      fetchMeeting()
      setInlineCompleteOpen(false)
      setInlineTargetTask(null)
      setInlineNote('')
      setInlineFile(null)
      toast.success('✅ 签署任务已完成')
    } catch {
      toast.error('操作失败，请重试')
    } finally {
      setInlineSaving(false)
    }
  }, [inlineTargetTask, inlineNote, inlineFile, meeting, id, signTasks, fetchMeeting])

  // ===== v6.0 定稿功能：通知/纪要 → 创建 Document 记录（staged）→ 出现在相关文件 Tab =====
  const finalizeNotice = useCallback(async () => {
    if (!noticeData) return
    try {
      await documentService.create({
        name: `${meeting?.title || '会议'}_会议通知`,
        type: 'notice',
        category: 'meeting',
        meeting: { _id: id },
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        staged: true,
        source: { kind: 'meeting_notice', refId: id, label: `来自会议通知：${meeting?.title || ''}` },
        note: '由会议通知定稿生成',
        createdAt: new Date().toISOString().split('T')[0],
      })
      setNoticeFinalized(true)
      toast.success('会议通知已定稿，文件已关联至「相关文件」')
      fetchMeeting()
    } catch {
      toast.error('定稿失败')
    }
  }, [noticeData, meeting, id, fetchMeeting])

  const finalizeMinutes = useCallback(async () => {
    if (!minutesData) return
    try {
      await documentService.create({
        name: `${meeting?.title || '会议'}_会议纪要`,
        type: 'minutes',
        category: 'meeting',
        meeting: { _id: id },
        company: meeting?.company?._id
          ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
          : undefined,
        staged: true,
        source: { kind: 'meeting_minutes', refId: id, label: `来自会议纪要：${meeting?.title || ''}` },
        note: '由会议纪要定稿生成',
        createdAt: new Date().toISOString().split('T')[0],
      })
      setMinutesFinalized(true)
      toast.success('会议纪要已定稿，文件已关联至「相关文件」')
      fetchMeeting()
    } catch {
      toast.error('定稿失败')
    }
  }, [minutesData, meeting, id, fetchMeeting])

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
  // v5.2 模块1：归档后会议与关联文件为只读
  const isArchived = meeting?.phase === 'completed' || !!meeting?.archivedAt
  const checklist = getMeetingChecklist(meeting.type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailHeader
        onBack={() => navigate('/meetings')}
        title={meeting.title}
        badges={isArchived ? (
          <span className="badge bg-danger/10 text-danger flex items-center gap-1"><Archive size={12} /> 已归档</span>
        ) : null}
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

      {/* v5.2 模块1：已归档只读横幅 */}
      {isArchived && (
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm text-ink-2">
          <Lock size={16} className="text-danger shrink-0" />
          <span>会议已归档，会议及关联文件为<strong className="text-danger">只读状态</strong>（不可删除 / 修改）。如需变更，请重新发起会议或联系管理员。</span>
        </div>
      )}

      {/* 会议全流程进度 */}
      <div className="bg-surface rounded-xl border border-hairline p-4">
        <p className="text-xs text-ink-3 mb-3">会议全流程（通知 → 附件 → 纪要 → 签字 → 归档）</p>
        <div className="flex items-center">
          {MEETING_FLOW.map((step, i) => {
            const done = computeMeetingSteps(meeting, documents, meetingTasks)[step.key]
            const isLast = i === MEETING_FLOW.length - 1
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done ? 'bg-success text-white' : 'bg-canvas text-ink-2'}`}>
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span className={`mt-1 text-xs ${done ? 'text-success font-medium' : 'text-ink-3'}`}>{step.label}</span>
                </div>
                {!isLast && <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-success' : 'bg-canvas'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs —— v6.0 重排序：概览→通知→纪要→签署→相关文件 */}
      <TabNav
        tabs={[
          { key: 'overview', label: '概览' },
          { key: 'notice', label: '会议通知' },
          { key: 'minutes', label: '会议纪要' },
          { key: 'signing', label: '签署任务', icon: PenLine },
          { key: 'documents', label: '相关文件' },
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
                        : 'bg-canvas text-ink-2'
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
                        : 'bg-canvas text-ink-2'
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
                <FileText size={48} className="mx-auto text-ink-3 mb-4" />
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
                  {!editingNotice ? (
                    <button
                      onClick={() => { setEditedNoticeText(noticeData.text); setEditingNotice(true) }}
                      className="btn-secondary text-primary-600 inline-flex items-center gap-1.5 text-sm"
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                  ) : (
                    <button
                      onClick={saveNoticeEdit}
                      className="btn-primary inline-flex items-center gap-1.5 text-sm"
                    >
                      <CheckCircle2 size={14} /> 完成编辑
                    </button>
                  )}
                  {!editingNotice && (
                    <button
                      onClick={generateNotice}
                      disabled={generating === 'notice'}
                      className="btn-secondary text-primary-600 inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
                    >
                      <FileText size={14} /> 重新生成
                    </button>
                  )}
                  {/* v6.0 定稿按钮 —— 通知编辑完成后可定稿，创建 Document 记录关联到相关文件 */}
                  {!editingNotice && !noticeFinalized && (
                    <button
                      onClick={finalizeNotice}
                      disabled={isArchived}
                      className="btn-success inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={14} /> 定稿通知
                    </button>
                  )}
                  {noticeFinalized && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-success/10 text-success font-medium">
                      <CheckCircle2 size={12} /> 已定稿
                    </span>
                  )}
                  {!editingNotice && (
                    <button
                      onClick={() => downloadWord(noticeData, `${meeting?.title || '会议'}_通知`)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-primary-600"
                    >
                      <Download size={14} /> 保存Word
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
                <PenLine size={48} className="mx-auto text-ink-3 mb-4" />
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
                  {!editingMinutes ? (
                    <button
                      onClick={() => { setEditedMinutesText(minutesData.text); setEditingMinutes(true) }}
                      disabled={isArchived}
                      className="btn-secondary text-primary-600 inline-flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                  ) : (
                    <button
                      onClick={saveMinutesEdit}
                      className="btn-primary inline-flex items-center gap-1.5 text-sm"
                    >
                      <CheckCircle2 size={14} /> 完成编辑
                    </button>
                  )}
                  {!editingMinutes && (
                    <button
                      onClick={generateMinutes}
                      disabled={generating === 'minutes' || isArchived}
                      className="btn-secondary text-primary-600 inline-flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PenLine size={14} /> 重新生成
                    </button>
                  )}
                  {/* v6.0 定稿按钮 —— 纪要编辑完成后可定稿，创建 Document 记录关联到相关文件 */}
                  {!editingMinutes && !minutesFinalized && (
                    <button
                      onClick={finalizeMinutes}
                      disabled={isArchived}
                      className="btn-success inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={14} /> 定稿纪要
                    </button>
                  )}
                  {minutesFinalized && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-success/10 text-success font-medium">
                      <CheckCircle2 size={12} /> 已定稿
                    </span>
                  )}
                  {!editingMinutes && (
                    <button
                      onClick={() => downloadWord(minutesData, `${meeting?.title || '会议'}_纪要`)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-primary-600"
                    >
                      <Download size={14} /> 保存Word
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
                    <button onClick={openSignModal} disabled={isArchived} className="btn-primary inline-flex items-center gap-1.5 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
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
            {/* 会议归档清单 — v5.2 统一5类，支持多文件 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-ink-2">会议归档清单</h4>
                <button
                  onClick={archiveAll}
                  disabled={documents.length === 0 || isArchived}
                  className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Archive size={14} /> {isArchived ? '已归档' : '全部归档'}
                </button>
              </div>
              <p className="text-xs text-ink-3 mb-3">
                按会议类型应归档的文件；每类可上传多个文件。全部上传后可一键归档，归档后文件归属公司。
              </p>
              <div className="space-y-2">
                {checklist.map((item, i) => {
                  const matched = documents.filter(d => docMatchesChecklistItem(d, item))
                  const count = matched.length
                  const hasAny = count > 0
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${hasAny ? 'border-success/30 bg-success/5' : 'border-hairline'}`}>
                      <div className="flex items-center gap-2">
                        {hasAny
                          ? <CheckCircle2 size={16} className="text-success" />
                          : <Clock size={16} className="text-warning" />}
                        <span className={`text-sm ${hasAny ? 'text-ink' : 'text-ink-2'}`}>{item.label}</span>
                        {hasAny && <span className="text-xs text-success font-medium">已上传 {count} 件</span>}
                      </div>
                      <button
                        onClick={() => { setAttachForm({ name: '', type: item.type, file: null }); setAttachModal(true) }}
                        disabled={isArchived}
                        className="btn-secondary inline-flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload size={12} /> 上传
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 已关联文件 —— v6.0 增强显示：来源 + 暂存状态 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-ink-2">
                  已关联文件（{documents.length}）
                  <span className="ml-1.5 text-xs font-normal text-ink-3">
                    （{documents.filter(d => d.staged).length} 待归档 / {documents.filter(d => !d.staged && d.locked).length} 已归档）
                  </span>
                </h4>
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-ink-3">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无相关文件</p>
                  <p className="text-xs mt-1">可在会议通知/纪要 Tab 点击「定稿」，或从上方清单上传</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => {
                    // 来源标签映射
                    const sourceLabel = doc.source?.kind === 'meeting_notice' ? '通知定稿'
                      : doc.source?.kind === 'meeting_minutes' ? '纪要定稿'
                      : doc.source?.kind === 'signing_scan' ? '签署上传'
                      : '手动上传'
                    const sourceColor = doc.source?.kind === 'meeting_notice' ? 'bg-info/10 text-primary-700'
                      : doc.source?.kind === 'meeting_minutes' ? 'bg-info/10 text-primary-700'
                      : doc.source?.kind === 'signing_scan' ? 'bg-success/10 text-success'
                      : 'bg-canvas text-ink-2'
                    return (
                      <div key={doc._id} className={`flex items-center justify-between p-3 rounded-lg border ${doc.locked ? 'border-success/30 bg-success/[0.02]' : 'bg-canvas border-hairline'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={16} className={doc.locked ? 'text-success shrink-0' : 'text-ink-3 shrink-0'} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-ink-3 mt-0.5">
                              <span>{formatDate(doc.createdAt)}</span>
                              <span className={`px-1.5 py-0.5 rounded-full ${sourceColor}`}>{sourceLabel}</span>
                              {doc.staged && !doc.locked && <span className="px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">暂存</span>}
                              {doc.locked && <span className="px-1.5 py-0.5 rounded-full bg-success/10 text-success">已归档</span>}
                              {doc.signStatus && SIGN_STATUS_BADGE[doc.signStatus] && (
                                <span className={`px-1.5 py-0.5 rounded-full ${SIGN_STATUS_BADGE[doc.signStatus].cls}`}>
                                  {SIGN_STATUS_BADGE[doc.signStatus].label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {doc.fileUrl && (
                            <a href={doc.fileUrl} target="_blank" rel="noopener" className="p-1.5 text-ink-3 hover:text-primary-600 rounded">
                              <Download size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <button
                onClick={() => { setAttachForm({ name: '', type: 'minutes', file: null }); setAttachModal(true) }}
                disabled={isArchived}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={14} /> 上传其他文件
              </button>
            </div>
          </div>
        )}

        {/* ===== v6.0 签署任务 Tab（重写：统一 Task 视角 + 内联完成 + 双向状态同步）===== */}
        {activeTab === 'signing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink-2">
                签署任务
                <span className="ml-1.5 text-xs font-normal text-ink-3">
                  （{meetingTasks.filter(t => t.type === 'signing').length} 个关联 Task）
                </span>
              </h4>
              <button onClick={openSignModal} disabled={isArchived} className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <PenLine size={14} /> 发起签署任务
              </button>
            </div>

            {/* 统一视图：以 meetingTasks(Task) 为主线，关联 SignTask 信息 */}
            {meetingTasks.length === 0 ? (
              <div className="text-center py-12 text-ink-3">
                <PenLine size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无签署任务</p>
                <p className="text-xs mt-1">生成会议纪要并定稿后，可在此发起签署任务</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingTasks.map(t => {
                  const isCompleted = t.status === 'completed'
                  // 找到对应的 SignTask
                  const linkedST = signTasks.find(st => st.taskId === t._id)
                  return (
                    <div key={t._id} className={`border rounded-xl p-4 ${isCompleted ? 'border-success/30 bg-success/[0.02]' : 'border-hairline'}`}>
                      {/* 任务标题行 */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isCompleted ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            }`}>
                              {isCompleted ? '已完成' : '待签署'}
                            </span>
                            {t.autoGenerated && <span className="text-[10px] bg-info/10 text-primary-700 px-1.5 py-0.5 rounded-full">自动</span>}
                            {t.taskSource === 'dashboard' && <span className="text-[10px] bg-primary/10 text-primary-700 px-1.5 py-0.5 rounded-full">Dashboard</span>}
                            {t.isCTC && <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full">CTC</span>}
                            {t.dueDate && <span className="text-xs text-ink-3">截止: {formatDate(t.dueDate)}</span>}
                          </div>
                        </div>
                        {!isCompleted && (
                          <button onClick={() => openInlineComplete(t)} className="text-xs text-primary-600 hover:underline shrink-0 whitespace-nowrap">
                            完成任务 →
                          </button>
                        )}
                      </div>

                      {/* 签署人列表 */}
                      {linkedST?.signers?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-hairline">
                          <p className="text-xs text-ink-3 mb-1.5">签署人：</p>
                          <div className="flex flex-wrap gap-2">
                            {linkedST.signers.map((s, i) => (
                              <span key={i} className={`text-xs px-2 py-1 rounded-full border ${
                                s.status === 'signed' ? 'bg-success/5 border-success/20 text-success'
                                : 'bg-canvas border-hairline text-ink-2'
                              }`}>
                                {s.name || s.signerName || '—'}
                                <span className="ml-1">{s.status === 'signed' ? '✓' : '待签'}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 已完成的附件展示 */}
                      {isCompleted && t.hasAttachment && (
                        <div className="mt-3 pt-3 border-t border-hairline">
                          <p className="text-xs text-success font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} /> 已上传签署文件，附件已归档至会议相关文件
                          </p>
                        </div>
                      )}

                      {/* 操作按钮 —— 未完成任务内联操作（不外跳，避免 mock ID 404） */}
                      {!isCompleted && !isArchived && (
                        <div className="mt-3 pt-3 border-t border-hairline flex gap-2 flex-wrap">
                          <button
                            onClick={() => openInlineComplete(t)}
                            className="btn-primary inline-flex items-center gap-1.5 text-xs"
                          >
                            <CheckCircle2 size={12} /> 完成此任务
                          </button>
                          {/* 内联快速上传 */}
                          <label className="btn-secondary inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <Upload size={12} />
                            上传签署文件
                            <input type="file" className="hidden" onChange={async (e) => {
                              const file = e.target.files[0]
                              if (!file) return
                              // 快速上传：创建文档 + 标记 Task 完成
                              try {
                                await documentService.create({
                                  name: `${meeting?.title || '会议'}_签署文件`,
                                  type: 'minutes',
                                  category: 'meeting',
                                  meeting: { _id: id },
                                  company: meeting?.company?._id
                                    ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
                                    : undefined,
                                  signStatus: t.isCTC ? 'ctc' : 'fully_signed',
                                  fileName: file.name,
                                  fileSize: file.size,
                                  staged: true,
                                  source: { kind: 'signing_scan', refId: t._id, label: `来自签署任务：${t.title}` },
                                  note: '由会议签署 Tab 快速上传',
                                  createdAt: new Date().toISOString().split('T')[0],
                                })
                                await taskService.update(t._id, {
                                  status: 'completed',
                                  hasAttachment: true,
                                }).catch(() => {})
                                if (linkedST?._id) {
                                  await signTaskService.update(linkedST._id, { status: 'completed', completedAt: new Date().toISOString() }).catch(() => {})
                                }
                                // 立即更新本地状态（不等 fetchMeeting）
                                setMeetingTasks(prev => prev.map(mt =>
                                  mt._id === t._id ? { ...mt, status: 'completed', hasAttachment: true } : mt
                                ))
                                toast.success('✅ 签署文件已上传，任务已标记完成')
                                fetchMeeting()
                              } catch {
                                toast.error('上传失败')
                              }
                            }} />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 流程提示 */}
            <div className="bg-info/5 border border-info/15 p-3 rounded-lg text-xs text-primary-700 space-y-1">
              <p className="font-medium">💡 签署流程说明</p>
              <ol className="list-decimal list-inside ml-1 space-y-0.5 text-ink-2">
                <li>点击「完成此任务」在弹窗中上传签字文件或填写备注</li>
                <li>或直接「上传签署文件」一键完成</li>
                <li>完成后附件自动关联至「相关文件」Tab（暂存状态）</li>
                <li>所有签署任务完成后，前往「相关文件」Tab 一键归档至公司文档</li>
              </ol>
            </div>
          </div>
        )}

        {/* ===== v6.0 内联完成 Modal（签署任务不外跳 /tasks/:id）===== */}
        <CompleteWithAttachmentModal
          isOpen={inlineCompleteOpen}
          onClose={() => { setInlineCompleteOpen(false); setInlineTargetTask(null) }}
          title={`完成任务：${inlineTargetTask?.title || ''}`}
          warningText="请上传签字扫描件或填写完成备注（至少一项），完成后附件将关联到会议相关文件。"
          requireAttachment={inlineTargetTask?.type === 'signing'}
          noteText={inlineNote}
          onNoteChange={setInlineNote}
          uploadFile={inlineFile}
          onFileChange={f => setInlineFile(f)}
          onFileRemove={() => setInlineFile(null)}
          onConfirm={handleInlineComplete}
          saving={inlineSaving}
        />
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
              placeholder="默认取上传文件名，可修改"
            />
          </FormField>
          <FormField label="文件类型">
            <select
              className={inputClass}
              value={attachForm.type}
              onChange={e => setAttachForm({ ...attachForm, type: e.target.value })}
            >
              <option value="notice">会议通知</option>
              <option value="materials">会议资料</option>
              <option value="attendance">出席签到表</option>
              <option value="minutes">会议纪要（含决议）</option>
              <option value="other">其他</option>
            </select>
          </FormField>
          <FormField label="选择文件">
            <input type="file" className={inputClass}
              onChange={e => {
                const f = e.target.files[0] || null
                setAttachForm(prev => ({
                  ...prev,
                  file: f,
                  name: prev.name.trim() ? prev.name : (f ? f.name.replace(/\.[^.]+$/, '') : ''),
                }))
              }} />
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
