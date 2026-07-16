import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, ArrowLeft, CheckCircle2,
  FileText, Send, PenLine, Eye, Copy, Pencil,
  Building2, AlertCircle, Download, Printer, Upload
} from 'lucide-react'
import { meetingService, companyService, documentService, signTaskService, taskService } from '../services/index.js'
import { formatDate, MEETING_TYPE_LABELS as TYPES, MEETING_PHASES, fmtDate, fmtTime, buildPhasesWithIcons } from '../utils/helpers'
import { validate, required } from '../utils/validators'
import { LoadingSpinner, DetailHeader, FormField, inputClass, labelClass, InfoCard, TabNav } from '../components/UIHelpers'
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

const ARCHIVE_FORM_RULES = { name: [required('文档名称为必填')] }
const ATTACH_FORM_RULES = { name: [required('附件名称为必填')] }

function computeMeetingSteps(meeting, documents) {
  const phase = meeting?.phase || 'setup'
  const noticeDone = ['notice-sent', 'meeting-held', 'minutes-draft', 'minutes-signed', 'completed'].includes(phase) || !!meeting?.notice
  const minutesDone = meeting?.minutes?.status === 'draft' || meeting?.minutes?.status === 'signed' || !!meeting?.resolutions?.length
  const signDone = (meeting?.signatures?.length || 0) > 0
  const hasDocs = (documents?.length || 0) > 0
  return {
    notice: !!noticeDone,
    attachment: hasDocs,
    minutes: !!minutesDone,
    sign: !!signDone,
    archive: hasDocs,
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

  // 编辑模式状态（通知 / 纪要）
  const [editingNotice, setEditingNotice] = useState(false)
  const [editingMinutes, setEditingMinutes] = useState(false)
  const [editedNoticeText, setEditedNoticeText] = useState('')
  const [editedMinutesText, setEditedMinutesText] = useState('')

  // Actions
  const [generating, setGenerating] = useState(null) // 'notice' | 'minutes'
  const [archiveModal, setArchiveModal] = useState(false)
  const [archiveForm, setArchiveForm] = useState({ name: '', type: 'minutes', fileId: '' })
  const [archiveErrors, setArchiveErrors] = useState({})
  const [attachModal, setAttachModal] = useState(false)
  const [attachForm, setAttachForm] = useState({ name: '', type: 'attachment', file: null })
  const [attachErrors, setAttachErrors] = useState({})

  // Signing — 从会议发起签署任务（关联 meetingId）
  const [signModal, setSignModal] = useState(false)
  const [signForm, setSignForm] = useState({ title: '', priority: 'medium', signerIds: [] })
  const [signErrors, setSignErrors] = useState({})

  const fetchMeeting = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await meetingService.getOne(id)
      setMeeting(data.data)
      // Load related documents (使用 companyId 过滤，确保归档/附件可见)
      const companyId = data.data?.company?._id
      if (companyId) {
        const { data: docRes } = await documentService.getAll({ companyId }).catch(() => ({ data: { data: [] } }))
        setDocuments(docRes.data || [])
      } else {
        setDocuments([])
      }
      // v5.0: 加载关联签署任务（Signing 并入 Meeting）
      const { data: stRes } = await signTaskService.getAll().catch(() => ({ data: { data: [] } }))
      const all = stRes?.data || []
      setSignTasks(all.filter(st => st.relatedMeeting?._id === id || st.meeting?._id === id))
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
      toast.success('会议纪要已生成')
    } catch {
      toast.error('生成纪要失败')
    } finally {
      setGenerating(null)
    }
  }, [id])

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }, [])

  const archiveDocument = useCallback(async () => {
    const { valid, errors } = validate(archiveForm, ARCHIVE_FORM_RULES)
    if (!valid) { setArchiveErrors(errors); return }
    setArchiveErrors({})
    try {
      await documentService.create({
        name: archiveForm.name,
        type: archiveForm.type,
        company: meeting?.company?._id || meeting?._id,
        fileUrl: archiveForm.fileId || '/archive/temp',
        archivedAt: new Date().toISOString(),
      })
      toast.success('文档已归档到公司')
      setArchiveModal(false)
      fetchMeeting()
    } catch {
      toast.error('归档失败')
    }
  }, [archiveForm, meeting, fetchMeeting])

  const uploadAttachment = useCallback(async () => {
    const { valid, errors } = validate(attachForm, ATTACH_FORM_RULES)
    if (!valid) { setAttachErrors(errors); return }
    setAttachErrors({})
    try {
      await documentService.create({
        name: attachForm.name,
        type: attachForm.type,
        category: 'meeting',
        company: meeting?.company?._id ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber } : undefined,
        fileName: attachForm.file?.name,
        fileSize: attachForm.file?.size,
        createdAt: new Date().toISOString().split('T')[0],
      })
      toast.success('附件已上传并归档到公司文档')
      setAttachModal(false)
      setAttachForm({ name: '', type: 'attachment', file: null })
      fetchMeeting()
    } catch {
      toast.error('上传失败')
    }
  }, [attachForm, meeting, fetchMeeting])

  // 发起签署任务（关联本会议 meetingId）
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
      await signTaskService.create({
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
      // 同步创建对应 Task 记录，让签署任务在 Task 列表中可追踪、可完成
      try {
        await taskService.create({
          title: `签署：${signForm.title}`,
          type: 'document',
          priority: signForm.priority,
          status: 'pending',
          dueDate: meeting?.scheduledAt || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          description: `从会议「${meeting?.title || ''}」发起的签署任务，需 ${signers.length} 人签署。`,
          company: meeting?.company
            ? { _id: meeting.company._id, name: meeting.company.name, registrationNumber: meeting.company.registrationNumber }
            : undefined,
        })
      } catch (taskErr) {
        console.warn('签署任务已创建，但关联 Task 创建失败（非阻塞）:', taskErr)
      }
      toast.success('签署任务已发起（已同步创建对应 Task）')
      setSignModal(false)
      fetchMeeting()
    } catch {
      toast.error('发起失败')
    }
  }, [signForm, meeting, fetchMeeting])

  if (loading) {
    return <LoadingSpinner text="加载会议详情..." />
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">会议不存在</p>
        <button onClick={() => navigate('/meetings')} className="mt-4 text-primary-600 hover:underline">
          返回会议列表
        </button>
      </div>
    )
  }

  const phase = PHASES[meeting.phase] || PHASES.setup
  const PhaseIcon = phase.icon

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
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 mb-3">会议全流程（通知 → 附件 → 纪要 → 签字 → 归档）</p>
        <div className="flex items-center">
          {MEETING_FLOW.map((step, i) => {
            const done = computeMeetingSteps(meeting, documents)[step.key]
            const isLast = i === MEETING_FLOW.length - 1
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span className={`mt-1 text-xs ${done ? 'text-green-700 font-medium' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {!isLast && <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />}
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
          { key: 'documents', label: '相关文档' },
          { key: 'signing', label: '签署任务', icon: PenLine },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard title="基本信息">
                <dl className="space-y-2 text-sm">
                  <div className="flex"><dt className="w-20 text-gray-400 shrink-0">类型：</dt><dd>{TYPES[meeting.type] || meeting.type || '-'}</dd></div>
                  <div className="flex"><dt className="w-20 text-gray-400 shrink-0">日期：</dt><dd>{fmtDate(meeting.scheduledAt)}</dd></div>
                  <div className="flex"><dt className="w-20 text-gray-400 shrink-0">时间：</dt><dd>{fmtTime(meeting.scheduledAt)}</dd></div>
                  <div className="flex"><dt className="w-20 text-gray-400 shrink-0">地点：</dt><dd>{meeting.location || '-'}</dd></div>
                  {meeting.isVirtual && <div className="flex"><dt className="w-20 text-gray-400 shrink-0">会议号：</dt><dd className="font-mono">{meeting.meetingId || '-'}</dd></div>}
                  {meeting.meetingLink && <div className="flex"><dt className="w-20 text-gray-400 shrink-0">链接：</dt><dd><a href={meeting.meetingLink} target="_blank" rel="noopener" className="text-primary-600 hover:underline text-xs truncate">{meeting.meetingLink}</a></dd></div>}
                </dl>
              </InfoCard>
              <InfoCard title="关联信息">
                <dl className="space-y-2 text-sm">
                  <div className="flex"><dt className="w-20 text-gray-400 shrink-0">公司：</dt><dd className="font-medium">{meeting.company?.name || '-'}</dd></div>
                  {meeting.notice?.sentAt && <div className="flex"><dt className="w-20 text-gray-400 shrink-0">通知发送：</dt><dd>{fmtDate(meeting.notice.sentAt)}</dd></div>}
                  {meeting.minutes?.signedAt && <div className="flex"><dt className="w-20 text-gray-400 shrink-0">纪要签署：</dt><dd className="text-green-600">{fmtDate(meeting.minutes.signedAt)}</dd></div>}
                </dl>
              </InfoCard>
            </div>

            {/* Attendees */}
            {meeting.attendees?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-3">参会人员 ({meeting.attendees.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {meeting.attendees.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                        {a.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-gray-400 truncate">{a.role || '-'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.status === 'attended' ? 'bg-green-100 text-green-700'
                        : a.status === 'accepted' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
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
                <h4 className="text-sm font-semibold text-gray-500 mb-3">会议议程</h4>
                <div className="space-y-2">
                  {meeting.agenda.map((a, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-400 font-bold w-6 shrink-0 text-right">{i + 1}.</span>
                      <span className="flex-1">{a.item || '未填写'}</span>
                      {a.presenter && <span className="text-gray-400 text-xs">主讲：{a.presenter}</span>}
                      {a.duration && <span className="text-gray-400 text-xs">{a.duration}分钟</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolutions */}
            {meeting.resolutions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-3">决议</h4>
                <div className="space-y-2">
                  {meeting.resolutions.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <span>{r.title || '未填写'}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        r.status === 'approved' ? 'bg-green-100 text-green-700'
                        : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
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
                <p className="text-gray-500 mb-4">尚未生成会议通知</p>
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
                          // 退出编辑：用编辑后的文本预览（简单渲染为带格式的文本）
                          setEditingNotice(false)
                        } else {
                          // 进入编辑模式
                          setEditedNoticeText(noticeData.text)
                          setEditingNotice(true)
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 text-sm ${editingNotice ? 'btn-primary' : 'btn-secondary text-blue-600'}`}
                    >
                      {editingNotice ? <><CheckCircle2 size={14} /> 完成编辑</> : <><Pencil size={14} /> 编辑</>}
                    </button>
                  )}
                  {!editingNotice && noticeData.html && (
                    <button
                      onClick={() => { const w = window.open(''); w.document.write(noticeData.html); w.document.close() }}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-blue-600"
                    >
                      <Eye size={14} /> 预览HTML
                    </button>
                  )}
                </div>
                {editingNotice ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">编辑通知内容（修改后可复制或退出编辑预览）：</p>
                    <textarea
                      value={editedNoticeText}
                      onChange={e => setEditedNoticeText(e.target.value)}
                      rows={16}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-sans leading-relaxed focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
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
                  <div className="bg-white p-4 rounded-lg border">
                    {noticeData.html ? (
                      <iframe srcDoc={noticeData.html} className="w-full min-h-[300px] border-0" title="notice-preview" />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans text-gray-700">{noticeData.text}</pre>
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
                <p className="text-gray-500 mb-4">尚未生成会议纪要</p>
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
                      className={`inline-flex items-center gap-1.5 text-sm ${editingMinutes ? 'btn-primary' : 'btn-secondary text-blue-600'}`}
                    >
                      {editingMinutes ? <><CheckCircle2 size={14} /> 完成编辑</> : <><Pencil size={14} /> 编辑</>}
                    </button>
                  )}
                  {!editingMinutes && minutesData.html && (
                    <button
                      onClick={() => { const w = window.open(''); w.document.write(minutesData.html); w.document.close() }}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm text-blue-600"
                    >
                      <Eye size={14} /> 预览HTML
                    </button>
                  )}
                </div>
                {editingMinutes ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">编辑纪要内容（修改后可复制或退出编辑预览）：</p>
                    <textarea
                      value={editedMinutesText}
                      onChange={e => setEditedMinutesText(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-sans leading-relaxed focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
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
                  <div className="bg-white p-4 rounded-lg border">
                    {minutesData.html ? (
                      <iframe srcDoc={minutesData.html} className="w-full min-h-[300px] border-0" title="minutes-preview" />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans text-gray-700">{minutesData.text}</pre>
                    )}
                  </div>
                )}

                {/* Signatures */}
                {minutesData.signatures?.length > 0 && !editingMinutes && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">签署状态</h4>
                    <div className="space-y-2">
                      {minutesData.signatures.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.title}</p>
                          </div>
                          {s.status === 'signed' ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle2 size={14} /> 已签署
                              {s.signedAt && <span className="text-gray-400 ml-1">({fmtDate(s.signedAt)})</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <Clock size={14} /> 待签署
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-500">相关文档</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAttachForm({ name: '', type: 'attachment', file: null }); setAttachModal(true) }}
                  className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <Upload size={14} /> 上传附件
                </button>
                <button
                  onClick={() => setArchiveModal(true)}
                  className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <Download size={14} /> 归档到公司
                </button>
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无相关文档</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(doc.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {doc.fileUrl && (
                        <a href={doc.fileUrl} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                          <Download size={14} />
                        </a>
                      )}
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SIGNING TAB — v5.0: 签署任务并入会议 */}
        {activeTab === 'signing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-500">关联签署任务 ({signTasks.length})</h4>
              <button onClick={openSignModal} className="btn-primary flex items-center gap-1.5 text-sm">
                <PenLine size={14} /> 发起签署任务
              </button>
            </div>
            {signTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <PenLine size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无关联签署任务</p>
              </div>
            ) : (
              <div className="space-y-3">
                {signTasks.map(st => (
                  <div key={st._id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{st.title}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        st.status === 'completed' ? 'bg-green-100 text-green-700'
                        : st.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>{st.status}</span>
                    </div>
                    {st.signers?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {st.signers.map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{s.signerName || s.name || '签署人'}</span>
                            <span className={s.status === 'signed' ? 'text-green-600' : 'text-amber-600'}>
                              {s.status === 'signed' ? '已签署' : '待签署'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
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

      {/* Attachment Modal */}
      <Modal isOpen={attachModal} onClose={() => setAttachModal(false)} title="上传会议附件" size="md">
        <div className="space-y-4">
          <FormField label="附件名称" required error={attachErrors.name}>
            <input
              className={inputClass}
              value={attachForm.name}
              onChange={e => { setAttachForm({ ...attachForm, name: e.target.value }); setAttachErrors(ae => ({ ...ae, name: '' })) }}
              placeholder="例如：董事签字页扫描件"
            />
          </FormField>
          <FormField label="附件类型">
            <select
              className={inputClass}
              value={attachForm.type}
              onChange={e => setAttachForm({ ...attachForm, type: e.target.value })}
            >
              <option value="attachment">附件</option>
              <option value="notice">通知</option>
              <option value="minutes">纪要</option>
              <option value="resolution">决议</option>
              <option value="other">其他</option>
            </select>
          </FormField>
          <FormField label="选择文件">
            <input type="file" className={inputClass}
              onChange={e => setAttachForm({ ...attachForm, file: e.target.files[0] || null })} />
          </FormField>
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>附件将自动关联到会议所属公司（{meeting?.company?.name}），并在公司详情页的「文件」中可见。</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAttachModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={uploadAttachment} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认上传</button>
          </div>
        </div>
      </Modal>

      {/* Archive Modal */}
      <Modal isOpen={archiveModal} onClose={() => setArchiveModal(false)} title="归档文档到公司" size="md">
        <div className="space-y-4">
          <FormField label="文档名称" required error={archiveErrors.name}>
            <input
              className={inputClass}
              value={archiveForm.name}
              onChange={e => { setArchiveForm({ ...archiveForm, name: e.target.value }); setArchiveErrors(ae => ({ ...ae, name: '' })) }}
              placeholder="例如：董事会会议纪要-2026-Q2"
            />
          </FormField>
          <FormField label="文档分类">
            <select
              className={inputClass}
              value={archiveForm.type}
              onChange={e => setArchiveForm({ ...archiveForm, type: e.target.value })}
            >
              <option value="resolution">决议</option>
              <option value="minutes">纪要</option>
              <option value="notice">通知</option>
              <option value="agreement">协议</option>
              <option value="other">其他</option>
            </select>
          </FormField>
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>归档后的文档将在公司详情页面的「文档」分类中显示，方便统一管理</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setArchiveModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={archiveDocument} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认归档</button>
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
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {(meeting?.attendees || []).length === 0 && (
                <p className="text-xs text-gray-400">该会议暂无参会人员</p>
              )}
              {(meeting?.attendees || []).map(a => (
                <label key={a._id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 text-sm cursor-pointer">
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
                  <span className="text-xs text-gray-400">{a.role || '-'}</span>
                </label>
              ))}
            </div>
          </FormField>
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>签署任务将关联至本会议（meetingId: {meeting?._id}），发起后可在「签署任务」列表与会议签署页查看。</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSignModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={createSignTask} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认发起</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
