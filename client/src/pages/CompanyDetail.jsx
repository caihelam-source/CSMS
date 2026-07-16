import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Users, FileText, Plus, Trash2, Calendar, Shield, ExternalLink, BookOpen, Download, Edit3, Network, ClipboardCheck, CheckSquare } from 'lucide-react'
import { companyService, documentService, meetingService, personnelService, complianceReminderService, complianceRuleService, taskService } from '../services/index.js'
import EquityGraph from './EquityGraph'
import { formatDate, getStatusColor, DOC_CATEGORY_LABELS, docExpiryStatus, DOC_EXPIRY_BADGE, generateDocFilename, saveBlob } from '../utils/helpers'
import { buildRomDocxBlob } from '../utils/romDocx'
import { buildRodDocxBlob } from '../utils/rodDocx'
import { inferRegion } from '../utils/docxCommon'
import { LoadingSpinner, EmptyState, DetailHeader, FormField, inputClass, labelClass, TabNav, taskPriorityColor } from '../components/UIHelpers'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'
import { validate, required } from '../utils/validators'

const LINK_FORM_RULES = {
  name: [required('名称为必填')],
}

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [company, setCompany] = useState(null)
  const [documents, setDocuments] = useState([])
  const [meetings, setMeetings] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [reminders, setReminders] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [docFilterCategory, setDocFilterCategory] = useState('all')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkModalMode, setLinkModalMode] = useState('add') // 'add' | 'historical'
  const [editingLink, setEditingLink] = useState(null)
  const [linkForm, setLinkForm] = useState({ linkModel: 'Personnel', name: '', roles: ['director'], shares: '', shareType: 'ordinary', nric: '', appointedDate: '', ceasedDate: '', selectedId: '' })
  const [linkFormErrors, setLinkFormErrors] = useState({})
  // 登记册生成
  const [generatingReg, setGeneratingReg] = useState(null) // 'rod' | 'rom' | null
  // 标记离任模态框
  const [showCeaseModal, setShowCeaseModal] = useState(false)
  const [ceasingLink, setCeasingLink] = useState(null) // link being ceased/restored
  const [ceasedDateInput, setCeasedDateInput] = useState('')
  // 所有 personnel 和 companies（用于联动显示最新数据）
  const [allPersonnel, setAllPersonnel] = useState([])
  const [allCompanies, setAllCompanies] = useState([])

  // 合规规则库（用于新增提醒时联动选择 + 自定义沉淀）
  const [rules, setRules] = useState([])
  // 新增合规提醒
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderForm, setReminderForm] = useState({
    mode: 'rule', // 'rule' | 'custom'
    ruleId: '',
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    saveAsRule: false,
    ruleName: '',
    ruleCategory: '',
    ruleFrequency: '',
  })
  const [savingReminder, setSavingReminder] = useState(false)

  // 基本信息内联编辑
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [savingInfo, setSavingInfo] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [compRes, docRes, meetRes, compRes2, persRes, compsRes, remRes, taskRes, rulesRes] = await Promise.all([
        companyService.getOne(id),
        documentService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        meetingService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        companyService.getCompliance(id).catch(() => null),
        personnelService.getAll().catch(() => ({ data: { data: [] } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getAll({ companyId: id }).catch(() => ({ data: { data: [] } })),
        taskService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        complianceRuleService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setCompany(compRes.data.data)
      setDocuments(docRes.data.data || [])
      setMeetings(meetRes.data.data || [])
      if (compRes2) setCompliance(compRes2.data.data)
      setReminders(remRes?.data?.data || [])
      setTasks(taskRes?.data?.data || [])
      setAllPersonnel(persRes?.data?.data || [])
      setAllCompanies(compsRes?.data?.data || [])
      setRules(rulesRes?.data?.data || [])
    } catch {
      toast.error('Failed to load company')
      navigate('/companies')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadAll() }, [loadAll])

  // Build maps for display (always use latest personnel/company data)
  const personnelMap = useMemo(() => {
    const map = {}
    allPersonnel.forEach(p => { map[p._id] = p })
    return map
  }, [allPersonnel])
  const companyMap = useMemo(() => {
    const map = {}
    allCompanies.forEach(c => { map[c._id] = c })
    return map
  }, [allCompanies])

  // Resolve a link's display data: always prefer the map (latest data)
  const resolveLinkDisplay = useCallback((link) => {
    if (link.linkModel === 'Personnel' && link.link?._id && personnelMap[link.link._id]) {
      return personnelMap[link.link._id]
    }
    if (link.linkModel === 'Company' && link.link?._id && companyMap[link.link._id]) {
      return companyMap[link.link._id]
    }
    return link.link || {}
  }, [personnelMap, companyMap])

  const directors = useMemo(() => (company?.links || []).filter(l => l.roles.includes('director') || l.roles.includes('alternate_director')), [company?.links])
  const shareholders = useMemo(() => (company?.links || []).filter(l => l.roles.includes('shareholder')), [company?.links])
  const secretaries = useMemo(() => (company?.links || []).filter(l => l.roles.includes('secretary')), [company?.links])

  // ROM / ROD 生成选项（地区 + 用途），公司地区加载后自动推断默认
  const [romRegion, setRomRegion] = useState('HK')
  const [romPurpose, setRomPurpose] = useState('standard')
  const [rodRegion, setRodRegion] = useState('HK')
  const [rodPurpose, setRodPurpose] = useState('standard')
  const didAutoRegion = useRef(false)
  useEffect(() => {
    if (company?.jurisdiction && !didAutoRegion.current) {
      const r = inferRegion(company)
      setRomRegion(r); setRodRegion(r); didAutoRegion.current = true
    }
  }, [company?.jurisdiction, company])

  // Active (current) members — for People tab; excludes those with ceasedDate
  const activeDirectors = useMemo(() => directors.filter(l => !l.ceasedDate), [directors])
  const activeShareholders = useMemo(() => shareholders.filter(l => !l.ceasedDate), [shareholders])
  const activeSecretaries = useMemo(() => secretaries.filter(l => !l.ceasedDate), [secretaries])

  // Former (ceased) counts — for register display
  const formerDirectors = useMemo(() => directors.filter(l => !!l.ceasedDate), [directors])
  const formerShareholders = useMemo(() => shareholders.filter(l => !!l.ceasedDate), [shareholders])
  const formerSecretaries = useMemo(() => secretaries.filter(l => !!l.ceasedDate), [secretaries])

  // ---- Link CRUD ----
  const openAddLink = () => {
    setEditingLink(null)
    setLinkModalMode('add')
    setLinkForm({ linkModel: 'Personnel', name: '', roles: ['director'], shares: '', shareType: 'ordinary', nric: '', appointedDate: '', ceasedDate: '', selectedId: '' })
    setShowLinkModal(true)
  }

  const openEditLink = (link) => {
    setEditingLink(link._id)
    setLinkForm({
      linkModel: link.linkModel || 'Personnel',
      name: link.link?.name || '',
      roles: [...(link.roles || [])],
      shares: link.shares || '',
      shareType: link.shareType || 'ordinary',
      nric: link.link?.nric || '',
      appointedDate: link.appointedDate ? link.appointedDate.substring(0, 10) : '',
      ceasedDate: link.ceasedDate ? link.ceasedDate.substring(0, 10) : '',
      selectedId: link.link?._id || '',
    })
    setShowLinkModal(true)
  }

  const handleRemoveLink = async (linkId) => {
    // In registers context, "remove" means marking as ceased, not deleting
    const ok = await confirm({
      title: '标记离任',
      message: '确定要标记此成员为离任吗？记录将保留在登记册中（可恢复）。',
      confirmLabel: '确认离任'
    })
    if (!ok) return
    setCeasingLink(linkId)
    setCeasedDateInput(new Date().toISOString().substring(0, 10))
    setShowCeaseModal(true)
  }

  // Mark a link as ceased (set ceasedDate)
  const handleConfirmCease = async () => {
    if (!ceasingLink || !ceasedDateInput) return
    try {
      await companyService.updateLink(id, ceasingLink, { ceasedDate: ceasedDateInput })
      toast.success('已标记为离任')
      setShowCeaseModal(false)
      setCeasingLink(null)
      loadAll()
    } catch { toast.error('操作失败') }
  }

  // Restore a ceased link (clear ceasedDate)
  const handleRestoreLink = async (linkId) => {
    const ok = await confirm({ title: '恢复任职', message: '确定要恢复此成员为现任？', confirmLabel: '确认恢复' })
    if (!ok) return
    try {
      await companyService.updateLink(id, linkId, { ceasedDate: null })
      toast.success('已恢复为现任')
      loadAll()
    } catch { toast.error('恢复失败') }
  }

  // Open modal to add a historical register entry (曾任/曾持，填写任职+离任日期，记录完整保留)
  const openAddHistorical = () => {
    setEditingLink(null)
    setLinkModalMode('historical')
    setLinkForm({
      linkModel: 'Personnel', name: '', roles: ['director'],
      shares: '', shareType: 'ordinary', nric: '',
      appointedDate: '', ceasedDate: '', selectedId: '',
    })
    setShowLinkModal(true)
  }

  const handleAddLink = async (e) => {
    e.preventDefault()
    const { valid, errors } = validate(linkForm, LINK_FORM_RULES)
    if (!valid) { setLinkFormErrors(errors); return }
    setLinkFormErrors({})
    try {
      // Determine the _id for link.link
      let linkId = linkForm.selectedId
      if (!linkId && linkForm.name) {
        // No existing personnel selected — will create a new personnel first (only in real backend)
        // For now, generate a temp ID
        linkId = 'p' + Date.now()
      }
      const payload = {
        linkModel: linkForm.linkModel,
        link: {
          _id: linkId,
          name: linkForm.name,
          nric: linkForm.nric || undefined,
          registrationNumber: linkForm.linkModel === 'Company' ? (linkForm.registrationNumber || 'N/A') : undefined,
        },
        roles: linkForm.roles,
        shares: linkForm.roles.includes('shareholder') ? Number(linkForm.shares) || 0 : undefined,
        shareType: linkForm.roles.includes('shareholder') ? linkForm.shareType : undefined,
        appointedDate: linkForm.appointedDate || undefined,
        ceasedDate: linkForm.ceasedDate || undefined,
      }
      if (editingLink) {
        await companyService.updateLink(id, editingLink, payload)
        toast.success('Link updated')
      } else {
        await companyService.addLink(id, payload)
        toast.success('Link added')
      }
      setShowLinkModal(false)
      setEditingLink(null)
      loadAll()
    } catch {
      toast.error('Failed to save link')
    }
  }

  // Handle selecting existing personnel in Link Modal
  const handlePersonnelSelect = useCallback((e) => {
    const pid = e.target.value
    if (!pid) {
      setLinkForm({ ...linkForm, selectedId: '', name: '', nric: '', nationality: '' })
      return
    }
    const p = allPersonnel.find(pp => pp._id === pid)
    if (p) {
      setLinkForm({ ...linkForm, selectedId: pid, name: p.name, nric: p.nric || '', nationality: p.nationality || '' })
    }
  }, [linkForm, allPersonnel])
  const handleCompanySelect = useCallback((e) => {
    const cid = e.target.value
    if (!cid) {
      setLinkForm({ ...linkForm, selectedId: '', name: '' })
      return
    }
    const c = allCompanies.find(cc => cc._id === cid)
    if (c) {
      setLinkForm({ ...linkForm, selectedId: cid, name: c.name, registrationNumber: c.registrationNumber || '' })
    }
  }, [linkForm, allCompanies])
  // ---- 基本信息内联编辑 ----
  const openEditInfo = useCallback(() => {
    setInfoForm({
      name: company?.name || '',
      registrationNumber: company?.registrationNumber || '',
      type: company?.type || 'private_limited',
      jurisdiction: company?.jurisdiction || 'Hong Kong',
      incorporationDate: company?.incorporationDate ? company.incorporationDate.substring(0, 10) : '',
      issuedShares: company?.shareCapital?.issued || '',
      paidUpCapital: company?.shareCapital?.paidUp || '',
      currency: company?.shareCapital?.currency || 'HKD',
      street: company?.registeredAddress?.street || '',
      city: company?.registeredAddress?.city || '',
      state: company?.registeredAddress?.state || '',
      addressCountry: company?.registeredAddress?.country || '中国香港',
    })
    setEditingInfo(true)
  }, [company])

  const saveInfo = useCallback(async () => {
    setSavingInfo(true)
    try {
      await companyService.update(id, {
        name: infoForm.name,
        registrationNumber: infoForm.registrationNumber,
        type: infoForm.type,
        jurisdiction: infoForm.jurisdiction,
        incorporationDate: infoForm.incorporationDate,
        shareCapital: {
          issued: Number(infoForm.issuedShares) || undefined,
          paidUp: Number(infoForm.paidUpCapital) || undefined,
          currency: infoForm.currency,
        },
        registeredAddress: {
          street: infoForm.street,
          city: infoForm.city,
          state: infoForm.state,
          country: infoForm.addressCountry,
        },
      })
      toast.success('公司信息已更新')
      setEditingInfo(false)
      loadAll()
    } catch { toast.error('更新失败') } finally { setSavingInfo(false) }
  }, [id, infoForm, loadAll])

  // ---- 合规提醒新增（联动 Rules + 自定义沉淀） ----
  const openAddReminder = () => {
    setReminderForm({
      mode: 'rule', ruleId: '', title: '', description: '',
      priority: 'medium', dueDate: '',
      saveAsRule: false, ruleName: '', ruleCategory: 'other', ruleFrequency: 'annual',
    })
    setShowReminderModal(true)
  }

  // 选择 Rule 时自动填充
  const handleRuleSelect = useCallback((ruleId) => {
    if (!ruleId) {
      setReminderForm(f => ({ ...f, ruleId: '', title: '', description: '', priority: 'medium' }))
      return
    }
    const rule = rules.find(r => r._id === ruleId)
    if (rule) {
      // 根据频率计算默认到期日
      let defaultDue = ''
      if (company?.inccorporationDate) {
        const inc = new Date(company.incorporationDate)
        const now = new Date()
        // 简单策略：规则描述的 dueDaysBefore 或默认30天后的同月同日
        defaultDue = new Date(now.getTime() + (rule.dueDaysBefore || 30) * 86400000).toISOString().substring(0, 10)
      } else {
        defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10)
      }
      setReminderForm(f => ({
        ...f,
        ruleId,
        title: `${rule.name} - ${company?.name || ''}`,
        description: rule.description || '',
        priority: rule.category === 'annual_return' ? 'high' : rule.category === 'license_renewal' ? 'critical' : 'medium',
        dueDate: f.dueDate || defaultDue,
      }))
    }
  }, [rules, company])

  const handleSaveReminder = async () => {
    if (!reminderForm.title || !reminderForm.dueDate) { toast.error('标题和到期日为必填'); return }
    setSavingReminder(true)
    try {
      // 1. 创建提醒
      await complianceReminderService.create({
        title: reminderForm.title,
        description: reminderForm.description,
        priority: reminderForm.priority,
        dueDate: reminderForm.dueDate,
        company: { _id: id, name: company?.name },
        rule: reminderForm.ruleId ? rules.find(r => r._id === reminderForm.ruleId) : null,
        status: 'upcoming',
        completed: false,
      })
      // 2. 如果勾选了「保存为规则」，同时创建/更新合规规则库
      if (reminderForm.saveAsRule && reminderForm.ruleName) {
        await complianceRuleService.create({
          name: reminderForm.ruleName,
          category: reminderForm.ruleCategory || 'other',
          description: reminderForm.description,
          jurisdiction: company?.jurisdiction || 'Hong Kong',
          frequency: reminderForm.ruleFrequency || 'event_driven',
          isPreset: false,
        })
        toast.success('已保存为新规则，可复用于其他公司')
      }
      toast.success('合规提醒已添加')
      setShowReminderModal(false)
      loadAll()
    } catch { toast.error('添加失败') } finally { setSavingReminder(false) }
  }

  const downloadRegister = async (type) => {
    if (!company) return
    setGeneratingReg(type)
    try {
      if (type === 'rom') {
        // 真正的 .docx：香港(8列) / BVI(嵌套19列)，按地区+用途(签字栏)生成
        const blob = await buildRomDocxBlob(
          company,
          (company.links || []).filter((l) => l.roles.includes('shareholder')),
          { region: romRegion, purpose: romPurpose }
        )
        const filename = generateDocFilename('ROM', company, { ext: 'docx' })
        saveBlob(blob, filename)
        toast.success(`ROM downloaded (.docx, ${romRegion}${romPurpose !== 'standard' ? ' / ' + romPurpose : ''})`)
      } else {
        // 真正的 .docx：香港(7列) / BVI(4表)，按地区+用途(签字栏)生成
        const blob = await buildRodDocxBlob(
          company,
          (company.links || []).filter((l) => l.roles.includes('director') || l.roles.includes('alternate_director')),
          { region: rodRegion, purpose: rodPurpose }
        )
        const filename = generateDocFilename('ROD', company, { ext: 'docx' })
        saveBlob(blob, filename)
        toast.success(`ROD downloaded (.docx, ${rodRegion}${rodPurpose !== 'standard' ? ' / ' + rodPurpose : ''})`)
      }
    } catch {
      toast.error('Failed to generate register')
    } finally {
      setGeneratingReg(null)
    }
  }

  // ---- Render helpers ----
  const renderLinkRow = (link) => {
    const p = resolveLinkDisplay(link)
    return (
      <div key={link._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${link.roles.includes('director') ? 'bg-primary-100 text-primary-700' : link.roles.includes('shareholder') ? 'bg-green-100 text-green-700' : link.roles.includes('secretary') ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
            {p.name?.charAt(0) || '?'}
          </div>
          <div>
            {link.linkModel === 'Personnel' ? (
              <Link to={`/personnel/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {p.name || link.link?.name || 'Unknown'} <ExternalLink size={12} />
              </Link>
            ) : (
              <Link to={`/companies/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {p.name || link.link?.name || 'Unknown'} <ExternalLink size={12} />
              </Link>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              {link.appointedDate && <span>Since {formatDate(link.appointedDate)}</span>}
              {link.ceasedDate && <span className="text-red-500">Ceased {formatDate(link.ceasedDate)}</span>}
              {p.nric && <span>{p.nric}</span>}
              {link.shares > 0 && <span>{link.shares.toLocaleString()} {link.shareType}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {link.roles.map(r => <span key={r} className="badge badge-info text-xs">{r}</span>)}
          </div>
          <button onClick={() => openEditLink(link)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit link"><Edit3 size={14} /></button>
          <button onClick={() => handleRemoveLink(link._id)} className="p-1 text-gray-400 hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
        </div>
      </div>
    )
  }

  // 登记册生成选项（地区 / 用途）
  const REGION_OPTS = [
    { value: 'HK', label: '香港 HK' },
    { value: 'BVI', label: 'BVI' },
  ]
  const PURPOSE_OPTS = [
    { value: 'standard', label: '标准' },
    { value: 'bank', label: '银行' },
    { value: 'audit', label: '审计' },
  ]
  const RegSelect = ({ label, value, onChange, options }) => (
    <label className="flex items-center gap-1 text-xs text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-1.5 py-1 text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )

  // 登记册表格子组件：区分现任/历任，支持标记离任/恢复，保留完整记录
  const RegisterTable = ({ title, subtitle, links, columns, onDownload, generating, regType, emptyText, extraControls }) => {
    const current = links.filter(l => !l.ceasedDate)
    const former = links.filter(l => !!l.ceasedDate)
    const renderRows = (list) => list.map(link => {
      const p = resolveLinkDisplay(link)
      return (
        <tr key={link._id} className={`border-b hover:bg-gray-50 ${link.ceasedDate ? 'bg-red-50/40' : ''}`}>
          {columns.map(col => (
            <td key={col.key} className={col.tdClass || 'p-2'}>{col.cell(link, p)}</td>
          ))}
          <td className="p-2 text-right">
            {link.ceasedDate ? (
              <button onClick={() => handleRestoreLink(link._id)} className="text-xs text-green-600 hover:underline font-medium">恢复</button>
            ) : (
              <button onClick={() => handleRemoveLink(link._id)} className="text-xs text-red-500 hover:underline font-medium">标记离任</button>
            )}
          </td>
        </tr>
      )
    })
    const Section = ({ label, list, bg }) => (
      <div className="mb-3">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-t ${bg}`}>
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-gray-500">({list.length})</span>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-2">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>{renderRows(list)}</tbody>
            </table>
          </div>
        )}
      </div>
    )
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {extraControls}
            <button onClick={openAddHistorical} className="btn-secondary flex items-center gap-1 text-xs py-1.5 px-3">
              <Plus size={14} /> 添加历史记录
            </button>
            <button onClick={() => onDownload(regType)} disabled={generating} className="btn-primary flex items-center gap-2 text-sm">
              {generating ? '生成中...' : <><Download size={16} /> 生成 Word</>}
            </button>
          </div>
        </div>
        {links.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">{emptyText}</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {columns.map(col => (
                    <th key={col.key} className={col.thClass || 'text-left p-2 font-medium text-gray-600'}>{col.header}</th>
                  ))}
                  <th className="text-right p-2 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
            </table>
            <Section label="现任 (Current)" list={current} bg="bg-green-50" />
            <Section label="历任 (Former)" list={former} bg="bg-red-50" />
          </div>
        )}
      </div>
    )
  }

  if (loading) return <LoadingSpinner size="md" />
  if (!company) return <EmptyState icon={Building2} title="未找到该公司" description="该公司记录不存在或已被删除" />

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailHeader
        onBack={() => navigate('/companies')}
        title={company.name}
        subtitle={
          <>
            {company.registrationNumber}
            {company.type && <> &middot; {company.type.replace(/_/g, ' ')}</>}
            {company.incorporationDate && <> &middot; Incorporated {formatDate(company.incorporationDate)}</>}
          </>
        }
        initials={company.name?.charAt(0) || '?'}
        badges={
          <>
            <span className={`badge ${getStatusColor(company.status)}`}>{company.status}</span>
            {company.jurisdiction && <span className="badge badge-info">{company.jurisdiction}</span>}
          </>
        }
      />

      {/* Tabs */}
      <TabNav
        tabs={[
          { key: 'info', label: '基本信息', icon: Building2 },
          { key: 'people', label: `董事/股东 (${(company.links || []).length})`, icon: Users },
          { key: 'documents', label: `文件 (${documents.length})`, icon: FileText },
          { key: 'equity', label: '股权架构', icon: Network },
          { key: 'registers', label: '登记册', icon: BookOpen },
          { key: 'compliance', label: '合规', icon: Shield },
          { key: 'tasks', label: `任务 (${tasks.length})`, icon: CheckSquare },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">公司信息</h3>
              {!editingInfo ? (
                <button onClick={openEditInfo} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  <Edit3 size={14} /> 编辑
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingInfo(false)} className="text-sm text-gray-500 hover:text-gray-700">取消</button>
                  <button onClick={saveInfo} disabled={savingInfo} className="text-sm btn-primary">{savingInfo ? '保存中...' : '保存'}</button>
                </div>
              )}
            </div>
            {editingInfo ? (
              /* 编辑模式 */
              <div className="space-y-3">
                <FormField label="公司名称" required>
                  <input className={inputClass} value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="注册号"><input className={inputClass} value={infoForm.registrationNumber} onChange={e => setInfoForm(f => ({ ...f, registrationNumber: e.target.value }))} /></FormField>
                  <FormField label="类型">
                    <select className={inputClass} value={infoForm.type} onChange={e => setInfoForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="private_limited">Private Limited</option>
                      <option value="public_limited">Public Limited</option>
                      <option value="llp">LLP</option>
                      <option value="service_provider">Service Provider</option>
                    </select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="属地"><input className={inputClass} value={infoForm.jurisdiction} onChange={e => setInfoForm(f => ({ ...f, jurisdiction: e.target.value }))} /></FormField>
                  <FormField label="成立日期"><input type="date" className={inputClass} value={infoForm.incorporationDate} onChange={e => setInfoForm(f => ({ ...f, incorporationDate: e.target.value }))} /></FormField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="已发行股份"><input type="number" className={inputClass} value={infoForm.issuedShares} onChange={e => setInfoForm(f => ({ ...f, issuedShares: e.target.value }))} /></FormField>
                  <FormField label="已缴股本"><input type="number" className={inputClass} value={infoForm.paidUpCapital} onChange={e => setInfoForm(f => ({ ...f, paidUpCapital: e.target.value }))} /></FormField>
                  <FormField label="货币">
                    <select className={inputClass} value={infoForm.currency} onChange={e => setInfoForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="HKD">HKD</option>
                      <option value="USD">USD</option>
                      <option value="CNY">CNY</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </FormField>
                </div>
              </div>
            ) : (
              /* 只读模式 */
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">注册号</span><span>{company.registrationNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">类型</span><span className="capitalize">{company.type?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">属地</span><span>{company.jurisdiction || company.registeredAddress?.country || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">成立日期</span><span>{formatDate(company.incorporationDate)}</span></div>
              {company.shareCapital && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">已发行股份</span><span>{company.shareCapital.issued?.toLocaleString()} {company.shareCapital.currency}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">已缴股本</span><span>{company.shareCapital.paidUp?.toLocaleString()} {company.shareCapital.currency}</span></div>
                </>
              )}
            </dl>
            )}
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              地址
              {editingInfo && <span className="text-xs text-primary-500 font-normal">（编辑中）</span>}
            </h3>
            {editingInfo ? (
              <div className="space-y-3">
                <FormField label="街道"><input className={inputClass} value={infoForm.street} onChange={e => setInfoForm(f => ({ ...f, street: e.target.value }))} placeholder="例如：皇后大道中 1 号" /></FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="城市"><input className={inputClass} value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))} /></FormField>
                  <FormField label="省份/州"><input className={inputClass} value={infoForm.state} onChange={e => setInfoForm(f => ({ ...f, state: e.target.value }))} /></FormField>
                </div>
                <FormField label="国家/地区"><input className={inputClass} value={infoForm.addressCountry} onChange={e => setInfoForm(f => ({ ...f, addressCountry: e.target.value }))} /></FormField>
              </div>
            ) : company.registeredAddress ? (
              <p className="text-sm text-gray-600">
                {[company.registeredAddress.street, company.registeredAddress.city, company.registeredAddress.state, company.registeredAddress.country].filter(Boolean).join(', ') || company.registeredAddress.country || '-'}
              </p>
            ) : <p className="text-sm text-gray-400">-</p>}
          </div>
          {/* Compliance dates */}
          <div className="card">
            <h3 className="font-semibold mb-4">合规日期</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">AGM 到期</span><span>{formatDate(company.compliance?.agmDueDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">年报到期</span><span className={company.compliance?.arDueDate && new Date(company.compliance.arDueDate) < new Date() ? 'text-red-600 font-medium' : ''}>{formatDate(company.compliance?.arDueDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">上次 AGM</span><span>{formatDate(company.compliance?.lastAgmDate)}</span></div>
            </dl>
          </div>
          {meetings.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar size={16} /> 近期会议</h3>
              <div className="space-y-2">
                {meetings.slice(0, 3).map(m => (
                  <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                    <span className="text-primary-600">{m.title}</span>
                    <span className="text-gray-400">{formatDate(m.scheduledAt)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {/* 新增 Task 区域 — 在概览页直接可见，无需切换 Tab */}
          {tasks.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><CheckSquare size={16} /> 近期任务</h3>
              <div className="space-y-2">
                {tasks.slice(0, 3).map(t => (
                  <div key={t._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                    <span className="text-primary-600 truncate">{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${taskPriorityColor(t.priority)}`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* People Tab */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">董事、股东及公司秘书</h2>
            <button onClick={openAddLink} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> Add Link
            </button>
          </div>

          {/* Directors Section */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> 董事 ({directors.length})</h3>
            {directors.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无董事</p>
            ) : (
              <div className="space-y-2">
                {directors.map(link => renderLinkRow(link))}
              </div>
            )}
          </div>

          {/* Shareholders Section */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 size={18} /> 股东 ({shareholders.length})</h3>
            {shareholders.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无股东</p>
            ) : (
              <div className="space-y-2">
                {shareholders.map(link => renderLinkRow(link))}
              </div>
            )}
          </div>

          {/* Secretary Section */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield size={18} /> 公司秘书 ({secretaries.length})</h3>
            {secretaries.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无公司秘书</p>
            ) : (
              <div className="space-y-2">
                {secretaries.map(link => renderLinkRow(link))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab — 分类侧栏 */}
      {activeTab === 'documents' && (
        <div className="flex gap-6">
          {/* 侧栏：分类 */}
          <aside className="w-48 shrink-0 space-y-1">
            <h3 className="text-sm font-semibold text-gray-500 px-2 pb-2">文档分类</h3>
            <button onClick={() => setDocFilterCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${docFilterCategory === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
              <span>全部</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{documents.length}</span>
            </button>
            {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => {
              const count = documents.filter(d => (d.category || 'other') === key).length
              return (
                <button key={key} onClick={() => setDocFilterCategory(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${docFilterCategory === key ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                  <span className="flex items-center gap-2"><ClipboardCheck size={14} /> {label}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{count}</span>
                </button>
              )
            })}
          </aside>

          {/* 主区：文件列表 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold mb-4">关联文件</h2>
            {documents.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无关联文件</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents
                  .filter(d => docFilterCategory === 'all' || (d.category || 'other') === docFilterCategory)
                  .map(doc => (
                    <div key={doc._id} className="card flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={20} className="text-primary-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {doc.docNumber && <span className="text-xs font-mono text-gray-400">{doc.docNumber}</span>}
                            <p className="font-medium truncate">{doc.name}</p>
                            {/* v5.0: isExpiring 徽章逻辑（红=已过期 / 橙=即将到期 / 绿=有效） */}
                            {(() => {
                              const st = docExpiryStatus(doc)
                              const badge = DOC_EXPIRY_BADGE[st]
                              return badge ? (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                              ) : null
                            })()}
                          </div>
                          <p className="text-xs text-gray-400">
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{DOC_CATEGORY_LABELS[doc.category] || '其他'}</span>
                            {doc.type && <> &middot; {doc.type.replace(/_/g, ' ')}</>}
                            {doc.fileSize && <> &middot; {(doc.fileSize / 1024).toFixed(0)} KB</>}
                            {doc.createdAt && <> &middot; {formatDate(doc.createdAt)}</>}
                          </p>
                        </div>
                      </div>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm shrink-0">Download</a>
                      ) : (
                        <span className="text-xs text-gray-400 shrink-0">无文件</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equity Graph Tab — 股权穿透架构 */}
      {activeTab === 'equity' && (
        <div className="space-y-4">
          <EquityGraph companyId={id} />
        </div>
      )}

      {/* ======== 登记册 Tab ======== */}
      {activeTab === 'registers' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={20} /> 公司登记册</h2>

          {/* ROD — Register of Directors */}
          <RegisterTable
            title="Register of Directors (ROD)"
            subtitle={`董事登记册 — 现任 ${activeDirectors.length} 位 / 历任 ${formerDirectors.length} 位`}
            links={directors}
            regType="rod"
            onDownload={downloadRegister}
            generating={generatingReg === 'rod'}
            emptyText="No directors registered"
            extraControls={
              <>
                <RegSelect label="地区" value={rodRegion} onChange={setRodRegion} options={REGION_OPTS} />
                <RegSelect label="用途" value={rodPurpose} onChange={setRodPurpose} options={PURPOSE_OPTS} />
              </>
            }
            columns={[
              { key: 'appointed', header: 'Date Appointed', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
              { key: 'name', header: 'Full Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
              { key: 'nric', header: 'NRIC / Passport', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.nric || '-' },
              { key: 'nationality', header: 'Nationality', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.nationality || '-' },
              { key: 'address', header: 'Address', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.address?.country || '-' },
              { key: 'role', header: 'Role', tdClass: 'p-2', cell: (l) => l.roles.map(r => <span key={r} className="badge badge-info text-xs mr-1">{r}</span>) },
              { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
            ]}
          />

          {/* ROM — Register of Members */}
          <RegisterTable
            title="Register of Members (ROM)"
            subtitle={`股东登记册 — 现任 ${activeShareholders.length} 位 / 历任 ${formerShareholders.length} 位 · Issued: ${(company.shareCapital?.issued || 0).toLocaleString()} ${company.shareCurrency?.currency || ''}`}
            links={shareholders}
            regType="rom"
            onDownload={downloadRegister}
            generating={generatingReg === 'rom'}
            emptyText="No shareholders registered"
            extraControls={
              <>
                <RegSelect label="地区" value={romRegion} onChange={setRomRegion} options={REGION_OPTS} />
                <RegSelect label="用途" value={romPurpose} onChange={setRomPurpose} options={PURPOSE_OPTS} />
              </>
            }
            columns={[
              { key: 'entered', header: 'Date Entered', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
              { key: 'name', header: 'Member Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
              { key: 'address', header: 'Address / Jurisdiction', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.address?.country || p.registrationNumber || '-' },
              { key: 'shares', header: 'No. of Shares', tdClass: 'p-2 text-right text-xs', cell: (l) => (l.shares || 0).toLocaleString() },
              { key: 'type', header: 'Type', tdClass: 'p-2 text-xs', cell: (l) => l.shareType || 'Ordinary' },
              { key: 'pct', header: '%', tdClass: 'p-2 text-right text-xs', cell: (l) => company.shareCapital?.paidUp && l.shares ? ((l.shares / company.shareCapital.paidUp * 100).toFixed(2) + '%') : '-' },
              { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
            ]}
          />

          {/* Secretary Register */}
          <RegisterTable
            title="Register of Secretaries"
            subtitle={`公司秘书登记册 — 现任 ${activeSecretaries.length} 位 / 历任 ${formerSecretaries.length} 位`}
            links={secretaries}
            regType="sec"
            onDownload={() => {} /* TODO: generate ROS Word */ }
            generating={false}
            emptyText="No secretary registered"
            columns={[
              { key: 'appointed', header: 'Date Appointed', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
              { key: 'name', header: 'Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
              { key: 'nric', header: 'NRIC / Passport', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.nric || '-' },
              { key: 'address', header: 'Address', tdClass: 'p-2 text-xs text-gray-500', cell: (l, p) => p.address?.country || '-' },
              { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
            ]}
          />
        </div>
      )}

      {/* Tasks Tab — 公司关联任务 */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">关联任务 ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <CheckSquare size={40} className="mx-auto mb-3 opacity-50" />
              <p>暂无关联任务</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t._id} className="card flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.type} &middot; 到期 {formatDate(t.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${taskPriorityColor(t.priority)}`}>{t.priority}</span>
                    <span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          {/* 合规提醒列表 + 新增入口 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">合规提醒 ({reminders.length})</h3>
              <div className="flex items-center gap-3">
                <Link to="/compliance-reminders" className="text-sm text-primary-600 hover:underline">查看全部</Link>
                <button onClick={openAddReminder} className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3">
                  <Plus size={14} /> 新增提醒
                </button>
              </div>
            </div>
            {reminders.length === 0 ? (
              <p className="text-sm text-gray-400">暂无与该公司的合规提醒，点击"新增提醒"添加</p>
            ) : (
              <div className="space-y-2">
                {reminders.map(r => (
                  <div key={r._id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{r.title}</p>
                      <p className="text-xs text-gray-500">
                        到期: {formatDate(r.dueDate)} · 优先级: {r.priority}
                        {r.rule?.name && <> · 规则: <span className="text-primary-600">{r.rule.name}</span></>}
                      </p>
                    </div>
                    <span className={`badge ${getStatusColor(r.status)}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 可用规则库（快捷参考） */}
          {rules.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">可用规则 ({rules.length})</h3>
              <div className="flex flex-wrap gap-2">
                {rules.map(r => (
                  <button
                    key={r._id}
                    onClick={() => {
                      setReminderForm({ mode: 'rule', ruleId: r._id, title: '', description: '', priority: 'medium', dueDate: '', saveAsRule: false, ruleName: '', ruleCategory: r.category, ruleFrequency: r.frequency })
                      handleRuleSelect(r._id)
                      setShowReminderModal(true)
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                    title={`${r.description || ''} (${r.frequency})`}
                  >
                    {r.name}
                    {r.isPreset && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">预设</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold">合规状态</h2>
          {compliance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="font-semibold mb-3">统计</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-600">{compliance.links?.active || 0}</p>
                    <p className="text-gray-500">Active Links</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-600">{compliance.items?.length || 0}</p>
                    <p className="text-gray-500">Items</p>
                  </div>
                </div>
                {compliance.links?.roles && (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <p>董事: {compliance.links.roles.director || 0}</p>
                    <p>股东: {compliance.links.roles.shareholder || 0}</p>
                    <p>秘书: {compliance.links.roles.secretary || 0}</p>
                    <p>个人: {compliance.links.byType?.Personnel || 0} | 公司: {compliance.links.byType?.Company || 0}</p>
                  </div>
                )}
              </div>
              {compliance.items?.map((item) => (
                <div key={`${item.type}-${item.dueDate}`} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.type}</p>
                    <p className="text-sm text-gray-500">Due: {formatDate(item.dueDate)}</p>
                  </div>
                  <span className={`badge ${getStatusColor(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
                <p>Compliance data not available</p>
          )}
        </div>
      )}

      {/* ====== Cease/Restore Modal ====== */}
      <Modal isOpen={showCeaseModal} onClose={() => { setShowCeaseModal(false); setCeasingLink(null) }} title="标记离任" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">此成员将标记为「历任」，记录保留在登记册中（可随时恢复）。</p>
          <FormField label="离任日期" required>
            <input type="date" className={inputClass} value={ceasedDateInput} onChange={e => setCeasedDateInput(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCeaseModal(false); setCeasingLink(null) }} className="btn-secondary">取消</button>
            <button onClick={handleConfirmCease} className="btn-primary bg-red-600 hover:bg-red-700">确认离任</button>
          </div>
        </div>
      </Modal>

      {/* ======== Add/Edit Link Modal ======== */}
      <Modal isOpen={showLinkModal} onClose={() => { setShowLinkModal(false); setEditingLink(null) }} title={
        editingLink ? '编辑关联' :
        linkModalMode === 'historical' ? '添加历史记录（历任/曾持）' :
        '新增关联成员'
      } size="md">
        <form onSubmit={handleAddLink} className="space-y-4">
              <FormField label="Link Type">
                <select className={inputClass} value={linkForm.linkModel}
                  onChange={(e) => setLinkForm({ ...linkForm, linkModel: e.target.value, roles: e.target.value === 'Company' ? ['shareholder'] : ['director'] })}>
                  <option value="Personnel">Person (Personnel)</option>
                  <option value="Company">Company</option>
                </select>
              </FormField>
              {/* Select existing personnel/company */}
              {linkForm.linkModel === 'Personnel' && (
                <FormField label="Select Existing Personnel (optional)">
                  <select className={inputClass} value={linkForm.selectedId} onChange={handlePersonnelSelect}>
                    <option value="">-- Enter new person --</option>
                    {allPersonnel.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.nric || 'no ID'})</option>
                    ))}
                  </select>
                </FormField>
              )}
              {linkForm.linkModel === 'Company' && (
                <FormField label="Select Existing Company (optional)">
                  <select className={inputClass} value={linkForm.selectedId} onChange={handleCompanySelect}>
                    <option value="">-- Enter new company --</option>
                    {allCompanies.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.registrationNumber || 'N/A'})</option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Name" required error={linkFormErrors.name}>
                <input className={inputClass} value={linkForm.name}
                  onChange={(e) => { setLinkForm({ ...linkForm, name: e.target.value, selectedId: '' }); setLinkFormErrors(fe => ({ ...fe, name: '' })) }} />
              </FormField>
              {linkForm.linkModel === 'Personnel' && (
                <FormField label="NRIC">
                  <input className={inputClass} value={linkForm.nric}
                    onChange={(e) => setLinkForm({ ...linkForm, nric: e.target.value })} />
                </FormField>
              )}
              <FormField label="Roles">
                <div className="flex flex-wrap gap-2">
                  {['director', 'shareholder', 'secretary', 'other'].map(r => (
                    <label key={r} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer border ${
                      linkForm.roles.includes(r) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'
                    }`}>
                      <input type="checkbox" className="hidden" checked={linkForm.roles.includes(r)}
                        onChange={() => {
                          setLinkForm({ ...linkForm, roles: linkForm.roles.includes(r) ? linkForm.roles.filter(x => x !== r) : [...linkForm.roles, r] })
                        }} />
                      {r}
                    </label>
                  ))}
                </div>
              </FormField>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Appointed Date">
                  <input type="date" className={inputClass} value={linkForm.appointedDate}
                    onChange={(e) => setLinkForm({ ...linkForm, appointedDate: e.target.value })} />
                </FormField>
                <FormField label="Ceased Date">
                  <input type="date" className={inputClass} value={linkForm.ceasedDate}
                    onChange={(e) => setLinkForm({ ...linkForm, ceasedDate: e.target.value })} />
                </FormField>
              </div>

              {linkForm.roles.includes('shareholder') && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Shares">
                    <input type="number" className={inputClass} value={linkForm.shares}
                      onChange={(e) => setLinkForm({ ...linkForm, shares: e.target.value })} />
                  </FormField>
                  <FormField label="Share Type">
                    <select className={inputClass} value={linkForm.shareType}
                      onChange={(e) => setLinkForm({ ...linkForm, shareType: e.target.value })}>
                      <option value="ordinary">Ordinary</option>
                      <option value="preference">Preference</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowLinkModal(false); setEditingLink(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingLink ? 'Save Changes' : 'Add Link'}</button>
              </div>
            </form>
      </Modal>

      {/* ====== Add Compliance Reminder Modal ====== */}
      <Modal isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} title="新增合规提醒" size="md">
        <div className="space-y-4">
          {/* 模式切换：联动规则 / 自定义 */}
          <div className="flex gap-2">
            <button
              onClick={() => setReminderForm(f => ({ ...f, mode: 'rule' }))}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${reminderForm.mode === 'rule' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              📋 从规则库选择
            </button>
            <button
              onClick={() => setReminderForm(f => ({ ...f, mode: 'custom', ruleId: '', title: f.title }))}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${reminderForm.mode === 'custom' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              ✏️ 自定义填写
            </button>
          </div>

          {reminderForm.mode === 'rule' ? (
            /* 联动规则模式 */
            <>
              <FormField label="选择合规规则" required>
                <select className={inputClass} value={reminderForm.ruleId} onChange={e => handleRuleSelect(e.target.value)}>
                  <option value="">-- 选择规则 --</option>
                  {rules.map(r => (
                    <option key={r._id} value={r._id}>{r.name} ({r.frequency}){r.isPreset ? ' ★' : ''}</option>
                  ))}
                </select>
              </FormField>
              {rules.length === 0 && <p className="text-xs text-amber-600">暂无可用规则，请先在「合规规则」页面创建</p>}
            </>
          ) : null}

          {/* 共用字段（自定义模式下全部可编辑，规则模式下自动填充后可微调） */}
          <FormField label="标题" required><input className={inputClass} value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} placeholder="例如：NAR1 年度申报表 - Easy Rich Corporation" /></FormField>
          <FormField label="描述"><textarea className={inputClass} rows={2} value={reminderForm.description} onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))} placeholder="说明此合规事项的要求..." /></FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="优先级">
              <select className={inputClass} value={reminderForm.priority} onChange={e => setReminderForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="critical">紧急</option>
              </select>
            </FormField>
            <FormField label="到期日期" required>
              <input type="date" className={inputClass} value={reminderForm.dueDate} onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))} />
            </FormField>
          </div>

          {/* 自定义模式：保存为规则选项 */}
          {reminderForm.mode === 'custom' && (
            <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-3 bg-gray-50/50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={reminderForm.saveAsRule} onChange={e => setReminderForm(f => ({ ...f, saveAsRule: e.target.checked }))} className="rounded" />
                <span className="font-medium text-gray-700">💾 保存为规则（沉淀到规则库，供其他公司复用）</span>
              </label>
              {reminderForm.saveAsRule && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="规则名称" required><input className={inputClass} value={reminderForm.ruleName} onChange={e => setReminderForm(f => ({ ...f, ruleName: e.target.value }))} placeholder="例如：年度税务申报" /></FormField>
                    <FormField label="分类">
                      <select className={inputClass} value={reminderForm.ruleCategory} onChange={e => setReminderForm(f => ({ ...f, ruleCategory: e.target.value }))}>
                        <option value="annual_return">年报/申报</option>
                        <option value="general_meeting">股东大会</option>
                        <option value="director_change">董事变更</option>
                        <option value="license_renewal">证照续期</option>
                        <option value="auditor">审计相关</option>
                        <option value="tax">税务</option>
                        <option value="other">其他</option>
                      </select>
                    </FormField>
                  </div>
                  <FormField label="频率"><input className={inputClass} value={reminderForm.ruleFrequency} onChange={e => setReminderForm(f => ({ ...f, ruleFrequency: e.target.value }))} placeholder="例如：12 months / event_driven" /></FormField>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowReminderModal(false)} className="btn-secondary">取消</button>
            <button onClick={handleSaveReminder} disabled={savingReminder || !reminderForm.title || !reminderForm.dueDate} className="btn-primary">{savingReminder ? '添加中...' : '添加提醒'}</button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}
