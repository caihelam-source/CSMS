import { useState, useEffect, useCallback, memo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, Users, Plus,
  ChevronRight, ChevronLeft, Check, X, Copy, Search,
  CheckCircle2, Clock3, PenLine, Video,
  Send, AlertCircle, FileText, Pencil, Trash2, Eye
} from 'lucide-react'
import { meetingService, companyService, personnelService, signTaskService } from '../services/index.js'
import { MEETING_TYPE_LABELS as TYPES, MEETING_STATUSES as STATUS, fmtDate, fmtTime, buildPhasesWithIcons } from '../utils/helpers'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'

// ====== Phase icon mapping — uses shared buildPhasesWithIcons ======
const PHASES_WITH_ICONS = buildPhasesWithIcons({ PenLine, Clock3, Send, CheckCircle2, FileText, AlertCircle: PenLine })

// ====== Inline button ======
function Btn({ children, className, ...rest }) {
  return <button className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${className || ''}`} {...rest}>{children}</button>
}

// ====== Phase badge (memoized — re-renders only when phase changes) ======
const PhaseBadge = memo(({ phase }) => {
  const p = PHASES_WITH_ICONS[phase] || PHASES_WITH_ICONS.setup
  const Icon = p.icon
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${p.color}`}><Icon size={12} />{p.label}</span>
})

const STEP1_RULES = {
  title: [required('请输入会议标题')],
  companyId: [required('请选择关联公司')],
  date: [required('请选择日期')],
}

// ====== MAIN PAGE ======
export default function Meetings() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const { confirm, ConfirmDialogComponent } = useConfirm()

  // Sign minutes form state (replaces window.prompt)
  const [signForm, setSignForm] = useState({ open: false, name: '', title: '董事会主席' })

  // Search + filter via useSearchFilter
  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    meetings,
    (m, q, f) => {
      const matchSearch = !q || m.title?.toLowerCase().includes(q) || m.company?.name?.toLowerCase().includes(q) || m.type?.toLowerCase().includes(q)
      const matchStatus = f.status === 'all' || !f.status || m.status === f.status
      return matchSearch && matchStatus
    },
    { status: 'all' }
  )

  // Wizard states
  const [wizardStep, setWizardStep] = useState(0) // 0=closed, 1-4=steps
  const [editMeeting, setEditMeeting] = useState(null) // null = new, obj = edit
  const [step1, setStep1] = useState({ title: '', type: 'board', companyId: '', date: '', time: '', endTime: '', duration: 60, isVirtual: false, location: '', meetingId: '', meetingLink: '', meetingPassword: '' }) // prettier-ignore
  const [step2, setStep2] = useState([]) // attendees
  const [step3, setStep3] = useState([]) // agenda
  const [step4, setStep4] = useState(null) // notice result { text, html }
  const [step5, setStep5] = useState(null) // minutes result

  // Detail view — now navigates to page instead of modal
  const [detailId, setDetailId] = useState(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [detailMeeting, setDetailMeeting] = useState(null)
  const [noticeData, setNoticeData] = useState(null)
  const [minutesData, setMinutesData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState([])
  const [personnelList, setPersonnelList] = useState([])
  const [signTaskMap, setSignTaskMap] = useState({}) // meetingId → count

  // Load meetings + sign tasks
  useEffect(() => {
    const load = async () => {
      try { const { data } = await meetingService.getAll(); setMeetings(data.data || []); } catch { setMeetings([]) }
      // 并加载签署任务，用于在会议卡片上显示指示
      try { const { data: stRes } = await signTaskService.getAll(); const all = stRes?.data || []; const map = {}; all.forEach(st => { const mid = st.relatedMeeting?._id || st.meeting?._id; if (mid) map[mid] = (map[mid] || 0) + 1 }); setSignTaskMap(map) } catch { /* non-critical */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Load companies & personnel for wizard
  const loadRefs = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([companyService.getAll(), personnelService.getAll()])
      setCompanies(cRes.data?.data || [])
      setPersonnelList(pRes.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  const openWizard = () => { setWizardStep(0); setEditMeeting(null); setStep1({ title: '', type: 'board', companyId: '', date: '', time: '', endTime: '', duration: 60, isVirtual: false, location: '', meetingId: '', meetingLink: '', meetingPassword: '' }); setStep2([]); setStep3([]); setStep4(null); setStep5(null); loadRefs() } // prettier-ignore

  const openEdit = async (m) => {
    await loadRefs()
    setEditMeeting(m)
    setStep1({
      title: m.title || '', type: m.type || 'board', companyId: m.company?._id || '',
      date: fmtDate(m.scheduledAt), time: fmtTime(m.scheduledAt), endTime: fmtTime(m.scheduledEndAt),
      duration: m.duration || 60, isVirtual: !!m.isVirtual, location: m.location || '',
      meetingId: m.meetingId || '', meetingLink: m.meetingLink || '', meetingPassword: m.meetingPassword || '',
    })
    setStep2(m.attendees?.map(a => ({
      _id: a._id || `a${Date.now() + Math.random()}`,
      refId: a.ref?._id || '', refModel: a.refModel || '',
      name: a.name, role: a.role || '', status: a.status || 'pending', isAdHoc: !a.refModel,
    })) || [])
    setStep3(m.agenda?.map(a => ({ item: a.item || '', presenter: a.presenter || '', duration: a.duration || '' })) || [])
    setStep4(null)
    setStep5(null)
    setWizardStep(m.phase === 'setup' || !m.phase ? 1 : m.phase === 'notice-draft' || m.phase === 'notice-sent' ? 3 : m.phase === 'minutes-signed' || m.phase === 'completed' ? 5 : 1)
  }

  // === Wizard steps ===
  const goStep = (n) => { setWizardStep(n) }

  const [step1Errors, setStep1Errors] = useState({})

  const saveStep1 = () => {
    const { valid, errors } = validate(step1, STEP1_RULES)
    if (!valid) { setStep1Errors(errors); return }
    setStep1Errors({})
    goStep(2)
  }

  const saveStep2 = () => { goStep(3) }

  const addAttendee = () => {
    setStep2([...step2, { _id: `a${Date.now()}`, refId: '', refModel: '', name: '', role: '', status: 'pending', isAdHoc: true }])
  }
  const updateAttendee = (idx, field, value) => {
    const arr = [...step2]
    if (field === 'refId') {
      const p = personnelList.find(x => x._id === value)
      if (p) { arr[idx].name = p.name; arr[idx].refModel = 'Personnel'; arr[idx].isAdHoc = false; arr[idx].refId = p._id }
      else { arr[idx].refId = ''; arr[idx].refModel = '' }
    } else {
      arr[idx][field] = value
      if (field === 'name' && value && arr[idx].isAdHoc) arr[idx].refModel = ''
    }
    setStep2(arr)
  }
  const removeAttendee = (idx) => { setStep2(step2.filter((_, i) => i !== idx)) }
  const addAgendaItem = () => { setStep3([...step3, { item: '', presenter: '', duration: '' }]) }
  const updateAgendaItem = (idx, field, value) => { const arr = [...step3]; arr[idx][field] = value; setStep3(arr) }
  const removeAgendaItem = (idx) => { setStep3(step3.filter((_, i) => i !== idx)) }

  // Generate notice
  const generateNotice = async () => {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editMeeting) {
        const { data } = await meetingService.update(editMeeting._id, { ...payload, phase: 'notice-draft' })
        if (detailMeeting && detailMeeting._id === editMeeting._id) setDetailMeeting(data.data)
      }
      const { data } = await meetingService.getNotice(editMeeting?._id || 'm3')
      setStep4(data.data)
      // Save phase
      if (!editMeeting) {
        const { data: saved } = await meetingService.create({ ...payload, phase: 'notice-draft' })
        setEditMeeting(saved.data)
      }
      goStep(4)
    } catch { toast.error('生成通知失败') }
    finally { setSaving(false) }
  }

  const sendNotice = async () => {
    if (!editMeeting) { toast.error('需要先保存会议'); return }
    try {
      await meetingService.update(editMeeting._id, { phase: 'notice-sent', status: 'scheduled', 'notice.sentAt': new Date().toISOString() })
      setWizardStep(0)
      toast.success('会议通知已发出')
      refreshMeetings()
    } catch { toast.error('发送失败') }
  }

  const generateMinutes = async () => {
    if (!editMeeting?._id) { toast.error('需要先保存会议'); return }
    try {
      await meetingService.update(editMeeting._id, { phase: 'minutes-draft', status: 'completed' })
      const { data } = await meetingService.getMinutes(editMeeting._id)
      setStep5(data.data)
      goStep(5)
      refreshMeetings()
    } catch { toast.error('生成纪要失败') }
  }

  const signMinutes = async () => {
    if (!editMeeting?._id) return
    // Open sign form dialog instead of window.prompt
    setSignForm({ open: true, name: '', title: '董事会主席' })
  }

  const handleSignSubmit = async () => {
    if (!signForm.name) { toast.error('请输入签署人姓名'); return }
    try {
      await meetingService.signMinutes(editMeeting._id, { name: signForm.name, title: signForm.title })
      await refreshMeetings()
      setWizardStep(0)
      setSignForm({ open: false, name: '', title: '董事会主席' })
      toast.success('会议纪要已签署')
    } catch { toast.error('签署失败') }
  }

  const buildPayload = () => {
    const s = step1.date + 'T' + (step1.time || '09:00') + ':00+08:00'
    const e = step1.endTime ? (step1.date + 'T' + step1.endTime + ':00+08:00') : undefined
    return {
      title: step1.title, type: step1.type, company: step1.companyId, scheduledAt: s, scheduledEndAt: e,
      duration: step1.duration, isVirtual: step1.isVirtual, location: step1.isVirtual ? step1.location : step1.location || '',
      meetingId: step1.meetingId, meetingLink: step1.meetingLink, meetingPassword: step1.meetingPassword,
      attendees: step2.filter(a => a.name).map(a => {
        const base = { name: a.name, role: a.role, status: a.status || 'pending' }
        if (!a.isAdHoc && a.refId) { base.refModel = 'Personnel'; base.ref = a.refId }
        return base
      }),
      agenda: step3.filter(a => a.item).map(a => ({ item: a.item, presenter: a.presenter || '', duration: a.duration ? parseInt(a.duration) : undefined })),
    }
  }

  const handleSaveMeeting = async () => {
    setSaving(true)
    try {
      const payload = buildPayload()
      let saved
      if (editMeeting) { const { data } = await meetingService.update(editMeeting._id, payload); saved = data.data }
      else { const { data } = await meetingService.create(payload); saved = data.data }
      setEditMeeting(saved)
      setWizardStep(0)
      await refreshMeetings()
      toast.success('会议已保存')
    } catch { toast.error('保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (m) => {
    const ok = await confirm({ title: '删除会议', message: `删除会议「${m.title}」？此操作不可撤销。`, confirmLabel: '确认删除', variant: 'danger' })
    if (!ok) return
    try { await meetingService.delete(m._id); toast.success('会议已删除'); refreshMeetings() } catch { toast.error('删除失败') }
  }

  const refreshMeetings = async () => {
    try { const { data } = await meetingService.getAll(); setMeetings(data.data || []) } catch { /* ignore */ }
  }

  // Copy text
  const copyText = useCallback((text) => { navigator.clipboard.writeText(text); toast.success('已复制到剪贴板') }, [])

  // ====== Render ======
  if (loading) return <LoadingSpinner text="加载会议数据..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Meetings"
        subtitle={`${filtered.length} 次会议`}
        icon={Calendar}
        actions={
          <button onClick={openWizard} className="btn-primary flex items-center gap-2"><Plus size={16} /> 新建会议</button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="搜索会议..." />
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="input-field w-40">
          <option value="all">全部状态</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="暂无会议数据"
          description="创建您的第一个会议来开始使用"
          action={<button onClick={openWizard} className="btn-primary"><Plus size={14} className="inline mr-1" />新建会议</button>}
        />
      ) : filtered.map(m => (
        <div key={m._id} className="card hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/meetings/${m._id}`)}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-lg font-semibold text-ink truncate">{m.title}</h3>
                {m.company?.stockCode && <span className="text-xs bg-gray-100 text-ink-2 px-1.5 py-0.5 rounded font-mono">{m.company.stockCode}</span>}
              </div>
              <p className="text-sm text-ink-2 mb-2">{m.company?.name}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
                <span className="flex items-center gap-1"><Calendar size={14} />{fmtDate(m.scheduledAt)}</span>
                <span className="flex items-center gap-1"><Clock size={14} />{fmtTime(m.scheduledAt)}{m.duration ? ` (${m.duration}分钟)` : ''}</span>
                <span className="flex items-center gap-1"><Users size={14} />{m.attendees?.length || 0} 人</span>
                {m.isVirtual && <span className="flex items-center gap-1 text-primary-500"><Video size={14} />{m.meetingId}</span>}
              </div>
              {m.agenda?.length > 0 && (
                <p className="mt-2 text-xs text-ink-3 line-clamp-1">{m.agenda.map(a => a.item).join(' · ')}</p>
              )}
            </div>
            <div className="flex items-start gap-2 ml-4 shrink-0" onClick={e => e.stopPropagation()}>
              <PhaseBadge phase={m.phase || 'setup'} />
              {signTaskMap[m._id] ? (
                <Link to={`/meetings/${m._id}?tab=signing`} className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-info/10 text-ink-2 hover:bg-gray-100">
                  <PenLine size={12} /> 签署 {signTaskMap[m._id]}
                </Link>
              ) : (
                <Link to={`/meetings/${m._id}?tab=signing`} className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-hairline text-ink-3 hover:text-primary-600 hover:border-hairline hover:bg-info/10" title="发起签署任务">
                  <PenLine size={12} /> 签署
                </Link>
              )}
              <button onClick={() => openEdit(m)} className="p-1.5 text-ink-3 hover:text-primary-600 rounded-lg hover:bg-gray-100"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(m)} className="p-1.5 text-ink-3 hover:text-danger rounded-lg hover:bg-gray-100"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}

      {/* ========== WIZARD MODAL ========== */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setWizardStep(0)}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Wizard Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">{editMeeting ? '编辑会议' : '创建新会议'}</h2>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className={`w-8 h-1.5 rounded-full ${wizardStep === n ? 'bg-primary-500' : wizardStep > n ? 'bg-primary-300' : 'bg-gray-100'}`} />
                  ))}
                </div>
                <button onClick={() => setWizardStep(0)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
            </div>

            {/* Wizard Body */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* Step 1: Basic Info */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">1</span>基本信息</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <FormField label="会议标题" required error={step1Errors.title}>
                        <input className={inputClass} value={step1.title} onChange={e => { setStep1({ ...step1, title: e.target.value }); setStep1Errors(e => ({ ...e, title: '' })) }} placeholder="Q1 董事会会议" />
                      </FormField>
                    </div>
                    <FormField label="关联公司" required error={step1Errors.companyId}>
                      <select className={inputClass} value={step1.companyId} onChange={e => { setStep1({ ...step1, companyId: e.target.value }); setStep1Errors(e => ({ ...e, companyId: '' })) }}>
                        <option value="">请选择公司...</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </FormField>
                    <div>
                      <label className={labelClass}>会议类型</label>
                      <select className={inputClass} value={step1.type} onChange={e => setStep1({ ...step1, type: e.target.value })}>
                        {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <FormField label="日期" required error={step1Errors.date}>
                      <input type="date" className={inputClass} value={step1.date} onChange={e => { setStep1({ ...step1, date: e.target.value }); setStep1Errors(e => ({ ...e, date: '' })) }} />
                    </FormField>
                    <div>
                      <label className={labelClass}>时间</label>
                      <div className="flex gap-2">
                        <input type="time" className={`${inputClass} flex-1`} value={step1.time} onChange={e => setStep1({ ...step1, time: e.target.value })} placeholder="开始" />
                        <span className="py-2 text-ink-3">-</span>
                        <input type="time" className={`${inputClass} flex-1`} value={step1.endTime} onChange={e => setStep1({ ...step1, endTime: e.target.value })} placeholder="结束" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>预计时长(分钟)</label>
                      <input type="number" className={inputClass} value={step1.duration} onChange={e => setStep1({ ...step1, duration: parseInt(e.target.value) || 60 })} />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={step1.isVirtual} onChange={e => setStep1({ ...step1, isVirtual: e.target.checked })} className="rounded" />
                        <span className="text-sm font-medium">线上会议</span>
                      </label>
                    </div>
                    {step1.isVirtual ? (
                      <>
                        <div><label className={labelClass}>会议号</label><input className={inputClass} value={step1.meetingId} onChange={e => setStep1({ ...step1, meetingId: e.target.value })} /></div>
                        <div><label className={labelClass}>会议链接</label><input className={inputClass} value={step1.meetingLink} onChange={e => setStep1({ ...step1, meetingLink: e.target.value })} /></div>
                        <div><label className={labelClass}>会议密码</label><input className={inputClass} value={step1.meetingPassword} onChange={e => setStep1({ ...step1, meetingPassword: e.target.value })} /></div>
                        <div className="md:col-span-2"><label className={labelClass}>会议室名称</label><input className={inputClass} value={step1.location} onChange={e => setStep1({ ...step1, location: e.target.value })} placeholder="腾讯视频会议" /></div>
                      </>
                    ) : (
                      <div className="md:col-span-2">
                        <label className={labelClass}>会议地点</label>
                        <input className={inputClass} value={step1.location} onChange={e => setStep1({ ...step1, location: e.target.value })} placeholder="公司会议室A" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Attendees */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">2</span>参会人员</h3>
                    <Btn onClick={addAttendee} className="text-primary-600 border border-primary-200 hover:bg-primary-50"><Plus size={14} />添加参会人</Btn>
                  </div>
                  <p className="text-sm text-ink-3">可从人员库中选择，或手动输入外部人员（不同步到人员库）</p>

                  {step2.length === 0 && (
                    <div className="card text-center py-8 text-ink-3">
                      <Users size={40} className="mx-auto mb-2 opacity-50" />
                      <p>尚未添加参会人员</p>
                      <p className="text-xs mt-1">点击「添加参会人」从人员库选择或手动输入</p>
                    </div>
                  )}
                  {step2.map((a, i) => (
                    <div key={a._id || i} className="flex gap-2 items-start bg-canvas rounded-lg p-3">
                      <div className="flex gap-2 flex-1 items-start flex-wrap">
                        {a.isAdHoc ? (
                          <input className={`${inputClass} flex-1 min-w-[120px]`} placeholder="姓名 *" value={a.name} onChange={e => updateAttendee(i, 'name', e.target.value)} />
                        ) : (
                          <select className={`${inputClass} flex-1 min-w-[150px]`} value={a.refId} onChange={e => updateAttendee(i, 'refId', e.target.value)}>
                            <option value="">选择人员...</option>
                            {personnelList.map(p => <option key={p._id} value={p._id}>{p.name} {p.nric ? `(${p.nric})` : ''}</option>)}
                          </select>
                        )}
                        <input className={`${inputClass} flex-1 min-w-[120px]`} placeholder="职务/角色" value={a.role} onChange={e => updateAttendee(i, 'role', e.target.value)} />
                        <select className={`${inputClass} w-28`} value={a.status} onChange={e => updateAttendee(i, 'status', e.target.value)}>
                          <option value="pending">待确认</option>
                          <option value="accepted">已接受</option>
                          <option value="declined">已拒绝</option>
                          <option value="attended">已出席</option>
                        </select>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {a.isAdHoc ? (
                          <button onClick={() => { const p = personnelList.find(x => x.name === a.name); if (p) updateAttendee(i, 'refId', p._id) }} title="从人员库匹配" className="p-2 text-ink-3 hover:text-primary-600 rounded"><Search size={14} /></button>
                        ) : (
                          <button onClick={() => updateAttendee(i, 'refId', '')} title="取消关联人员" className="p-2 text-ink-3 hover:text-warning rounded"><X size={14} /></button>
                        )}
                        <button onClick={() => removeAttendee(i)} className="p-2 text-ink-3 hover:text-danger rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Agenda */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">3</span>会议议程</h3>
                    <Btn onClick={addAgendaItem} className="text-primary-600 border border-primary-200 hover:bg-primary-50"><Plus size={14} />添加议题</Btn>
                  </div>
                  {step3.length === 0 && (
                    <div className="card text-center py-8 text-ink-3">
                      <FileText size={40} className="mx-auto mb-2 opacity-50" />
                      <p>尚未添加议程</p>
                    </div>
                  )}
                  {step3.map((a, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="mt-2.5 text-sm text-ink-3 font-bold w-6 shrink-0 text-right">{i + 1}.</span>
                      <input className={`${inputClass} flex-1`} placeholder="议题描述" value={a.item} onChange={e => updateAgendaItem(i, 'item', e.target.value)} />
                      <input className={`${inputClass} w-28`} placeholder="主讲人" value={a.presenter} onChange={e => updateAgendaItem(i, 'presenter', e.target.value)} />
                      <button onClick={() => removeAgendaItem(i)} className="mt-2 text-ink-3 hover:text-danger"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: Meeting Notice */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">4</span>会议通知</h3>
                  {!step4 ? (
                    <LoadingSpinner size="sm" text="正在生成通知..." />
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2">
                        <Btn onClick={() => copyText(step4.text)} className="border border-hairline hover:bg-canvas"><Copy size={14} />复制文案</Btn>
                        {step4.html && (
                          <Btn onClick={() => { const w = window.open(''); w.document.write(step4.html); w.document.close() }} className="border border-hairline hover:bg-info/10 text-primary-600"><Eye size={14} />预览HTML</Btn>
                        )}
                      </div>
                      <div className="card bg-canvas max-h-[450px] overflow-y-auto">
                        <h4 className="text-sm font-semibold text-ink-2 mb-3">会议通知预览</h4>
                        <div className="bg-surface p-5 rounded-lg border shadow-sm">
                          {step4.html ? <iframe srcDoc={step4.html} className="w-full min-h-[400px] border-0" title="notice-preview" /> : <pre className="whitespace-pre-wrap text-sm font-sans text-ink">{step4.text}</pre>}
                        </div>
                      </div>
                    </>
                  )}
                  {step4 && <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg text-sm text-warning flex items-start gap-2"><AlertCircle size={18} className="shrink-0 mt-0.5" /><span>通知文案已自动生成，您可以在上方预览HTML效果，确认无误后可复制使用。</span></div>}
                </div>
              )}

              {/* Step 5: Minutes & Signing */}
              {wizardStep === 5 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">5</span>会议纪要 & 签署</h3>
                  {!step5 ? (
                    <LoadingSpinner size="sm" text="正在生成纪要..." />
                  ) : (
                    <>
                      <div className="card bg-canvas max-h-[450px] overflow-y-auto">
                        <h4 className="text-sm font-semibold text-ink-2 mb-3">会议纪要预览</h4>
                        <div className="bg-surface p-5 rounded-lg border shadow-sm">
                          {step5.html ? <iframe srcDoc={step5.html} className="w-full min-h-[400px] border-0" title="minutes-preview" /> : <pre className="whitespace-pre-wrap text-sm font-sans text-ink">{step5.text}</pre>}
                        </div>
                      </div>
                      {step5.signatures?.length > 0 && (
                        <div className="card">
                          <h4 className="text-sm font-semibold text-ink-2 mb-3">签署状态</h4>
                          {step5.signatures.map((s, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-3">{s.title}</p></div>
                              {s.status === 'signed' ? <CheckCircle2 size={20} className="text-success" /> : <Clock3 size={20} className="text-warning" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>

            {/* Wizard Footer */}
            <div className="px-6 py-4 border-t bg-canvas flex items-center justify-between shrink-0">
              <div>
                {wizardStep > 1 && (
                  <Btn onClick={() => goStep(wizardStep - 1)} className="border border-hairline hover:bg-gray-100"><ChevronLeft size={14} />上一步</Btn>
                )}
              </div>
              <div className="flex gap-3">
                {wizardStep === 1 && <Btn onClick={saveStep1} className="btn-primary">下一步 <ChevronRight size={14} /></Btn>}
                {wizardStep === 2 && <Btn onClick={saveStep2} className="btn-primary">下一步 <ChevronRight size={14} /></Btn>}
                {wizardStep === 3 && (
                  <>
                    <Btn onClick={handleSaveMeeting} className="border border-hairline hover:bg-gray-100"><Check size={14} />直接保存</Btn>
                    <Btn onClick={generateNotice} disabled={saving} className="btn-primary">{saving ? '生成中...' : '生成会议通知'} <FileText size={14} /></Btn>
                  </>
                )}
                {wizardStep === 4 && (
                  <>
                    <Btn onClick={() => setWizardStep(0)} className="border border-hairline hover:bg-gray-100"><X size={14} />关闭</Btn>
                    <Btn onClick={sendNotice} className="btn-primary"><Send size={14} />发送通知</Btn>
                  </>
                )}
                {wizardStep === 5 && (
                  <>
                    <Btn onClick={() => generateMinutes()} className="border border-hairline hover:bg-gray-100">重新生成</Btn>
                    <Btn onClick={signMinutes} className="btn-primary"><PenLine size={14} />签署纪要</Btn>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== DETAIL VIEW MODAL ========== */}
      {detailId && detailMeeting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setDetailId(null); setDetailMeeting(null) }}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold truncate">{detailMeeting.title}</h2>
              <button onClick={() => { setDetailId(null); setDetailMeeting(null) }} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="border-b px-6 flex gap-0 shrink-0">
              {['overview', 'notice', 'minutes'].map(t => (
                <button key={t} onClick={() => {
                  setDetailTab(t)
                  if (t === 'notice' && !noticeData) meetingService.getNotice(detailMeeting._id).then(res => setNoticeData(res.data?.data))
                  if (t === 'minutes' && !minutesData) meetingService.getMinutes(detailMeeting._id).then(res => setMinutesData(res.data?.data))
                }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-ink-2 hover:text-ink'}`}>
                  {t === 'overview' ? '概览' : t === 'notice' ? '会议通知' : '会议纪要'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card">
                      <h4 className="text-sm font-semibold text-ink-2 mb-3">基本信息</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex"><dt className="w-20 text-ink-3">类型：</dt><dd>{TYPES[detailMeeting.type] || detailMeeting.type}</dd></div>
                        <div className="flex"><dt className="w-20 text-ink-3">日期：</dt><dd>{fmtDate(detailMeeting.scheduledAt)}</dd></div>
                        <div className="flex"><dt className="w-20 text-ink-3">时间：</dt><dd>{fmtTime(detailMeeting.scheduledAt)} {detailMeeting.duration ? `(${detailMeeting.duration}分钟)` : ''}</dd></div>
                        <div className="flex"><dt className="w-20 text-ink-3">地点：</dt><dd>{detailMeeting.isVirtual ? `线上：${detailMeeting.location || '腾讯会议'}` : (detailMeeting.location || '-')}</dd></div>
                        {detailMeeting.isVirtual && detailMeeting.meetingId && <div className="flex"><dt className="w-20 text-ink-3">会议号：</dt><dd className="font-mono">{detailMeeting.meetingId}{detailMeeting.meetingPassword ? ` (密码: ${detailMeeting.meetingPassword})` : ''}</dd></div>}
                      </dl>
                    </div>
                    <div className="card">
                      <h4 className="text-sm font-semibold text-ink-2 mb-3">关联信息</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex"><dt className="w-20 text-ink-3">公司：</dt><dd className="font-medium">{detailMeeting.company?.name}</dd></div>
                        <div className="flex"><dt className="w-20 text-ink-3">状态：</dt><dd><PhaseBadge phase={detailMeeting.phase || 'setup'} /></dd></div>
                        {detailMeeting.notice?.sentAt && <div className="flex"><dt className="w-20 text-ink-3">通知发送：</dt><dd>{fmtDate(detailMeeting.notice.sentAt)}</dd></div>}
                        {detailMeeting.minutes?.signedAt && <div className="flex"><dt className="w-20 text-ink-3">纪要签署：</dt><dd className="text-success">{fmtDate(detailMeeting.minutes.signedAt)}</dd></div>}
                      </dl>
                    </div>
                  </div>

                  <div className="card">
                    <h4 className="text-sm font-semibold text-ink-2 mb-3">参会人员 ({detailMeeting.attendees?.length || 0})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {detailMeeting.attendees?.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-canvas rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">{a.name?.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-xs text-ink-3 truncate">{a.role}</p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${a.status === 'attended' ? 'bg-success/10 text-success' : a.status === 'accepted' ? 'bg-info/10 text-primary-700' : 'bg-gray-100 text-ink-2'}`}>
                            {a.status === 'attended' ? '出席' : a.status === 'accepted' ? '已确认' : a.status === 'declined' ? '已拒绝' : '待确认'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h4 className="text-sm font-semibold text-ink-2 mb-3">议程</h4>
                    {(detailMeeting.agenda || []).length === 0 ? <p className="text-ink-3 text-sm">无议程</p> :
                      <div className="space-y-2">
                        {detailMeeting.agenda.map((a, i) => (
                          <div key={i} className="flex gap-3 p-2 bg-canvas rounded-lg text-sm">
                            <span className="text-ink-3 font-bold">{i + 1}.</span>
                            <span className="flex-1">{a.item}</span>
                            {a.presenter && <span className="text-ink-3 text-xs">主讲：{a.presenter}</span>}
                          </div>
                        ))}
                      </div>
                    }
                  </div>

                  {(detailMeeting.resolutions || []).length > 0 && (
                    <div className="card">
                      <h4 className="text-sm font-semibold text-ink-2 mb-3">决议</h4>
                      <div className="space-y-2">
                        {detailMeeting.resolutions.map((r, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-canvas rounded-lg text-sm">
                            <span>{r.title}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-success/10 text-success' : 'bg-gray-100 text-ink-2'}`}>
                              {r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '未通过' : '待决议'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'notice' && (
                <div className="space-y-4">
                  {!noticeData ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Btn onClick={() => copyText(noticeData.text)} className="border border-hairline hover:bg-canvas"><Copy size={14} />复制文案</Btn>
                        {noticeData.html && (
                          <Btn onClick={() => { const w = window.open(''); w.document.write(noticeData.html); w.document.close() }} className="border border-hairline hover:bg-info/10 text-primary-600"><Eye size={14} />预览HTML</Btn>
                        )}
                      </div>
                      <div className="card bg-canvas max-h-[500px] overflow-y-auto">
                        <div className="bg-surface p-5 rounded-lg border shadow-sm">
                          {noticeData.html ? <iframe srcDoc={noticeData.html} className="w-full min-h-[400px] border-0" title="notice" /> : <pre className="whitespace-pre-wrap text-sm font-sans">{noticeData.text}</pre>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detailTab === 'minutes' && (
                <div className="space-y-4">
                  {!minutesData ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Btn onClick={() => copyText(minutesData.text)} className="border border-hairline hover:bg-canvas"><Copy size={14} />复制文案</Btn>
                        {minutesData.html && (
                          <Btn onClick={() => { const w = window.open(''); w.document.write(minutesData.html); w.document.close() }} className="border border-hairline hover:bg-info/10 text-primary-600"><Eye size={14} />预览HTML</Btn>
                        )}
                      </div>
                      <div className="card bg-canvas max-h-[500px] overflow-y-auto">
                        <div className="bg-surface p-5 rounded-lg border shadow-sm">
                          {minutesData.html ? <iframe srcDoc={minutesData.html} className="w-full min-h-[400px] border-0" title="minutes" /> : <pre className="whitespace-pre-wrap text-sm font-sans">{minutesData.text}</pre>}
                        </div>
                      </div>
                      <div className="card">
                        <h4 className="text-sm font-semibold text-ink-2 mb-3">签署状态</h4>
                        {(minutesData.signatures || []).length === 0 ? (
                          <p className="text-ink-3 text-sm">尚未签署</p>
                        ) : minutesData.signatures.map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-3">{s.title}</p></div>
                            {s.status === 'signed' ? <span className="text-xs text-success font-medium flex items-center gap-1"><CheckCircle2 size={14} />已签署 {s.signedAt ? `(${fmtDate(s.signedAt)})` : ''}</span> : <span className="text-xs text-warning flex items-center gap-1"><Clock3 size={14} />待签署</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ========== CONFIRM DIALOG ========== */}
      {ConfirmDialogComponent}

      {/* ========== SIGN MINUTES FORM ========== */}
      <Modal isOpen={signForm.open} onClose={() => setSignForm({ ...signForm, open: false })} title="签署会议纪要" size="sm">
        <div className="space-y-4">
          <FormField label="签署人姓名" required>
            <input
              className={inputClass}
              value={signForm.name}
              onChange={e => setSignForm({ ...signForm, name: e.target.value })}
              placeholder="请输入签署人姓名"
              autoFocus
            />
          </FormField>
          <FormField label="签署人职务">
            <input
              className={inputClass}
              value={signForm.title}
              onChange={e => setSignForm({ ...signForm, title: e.target.value })}
              placeholder="董事会主席"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSignForm({ ...signForm, open: false })} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={handleSignSubmit} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认签署</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
