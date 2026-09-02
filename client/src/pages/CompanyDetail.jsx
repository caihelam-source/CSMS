import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Users, FileText, Plus, Trash2, Shield, ExternalLink, BookOpen, Download, Edit3, Network, CheckSquare, AlertTriangle, Eye } from 'lucide-react'
import { companyService, documentService, personnelService, complianceReminderService, complianceRuleService, taskService, meetingService } from '../services/index.js'
import { formatDate, getStatusColor, generateDocFilename, saveBlob } from '../utils/helpers'
import { inferRegion } from '../utils/regionHelpers'
import { LoadingSpinner, EmptyState, DetailHeader, FormField, inputClass, TabNav, jurisdictionLabel } from '../components/UIHelpers'
import Breadcrumbs from '../components/Breadcrumbs'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'
import TaskForm from '../components/TaskForm'
import { validate, required } from '../utils/validators'
import { toArray } from '../utils/responseNormalize.js'
import { formatPersonName, personInitial } from '../utils/personName'
import { useCompanyTasks } from '../hooks/useCompanyTasks'
import { useRuleLibrary } from '../hooks/useRuleLibrary'
import CompanyInfoTab from '../components/company/CompanyInfoTab'
import CompanyPeopleTab from '../components/company/CompanyPeopleTab'
import CompanyDocumentsTab from '../components/company/CompanyDocumentsTab'
import CompanyEquityTab from '../components/company/CompanyEquityTab'
import CompanyRegistersTab from '../components/company/CompanyRegistersTab'
import CompanyTasksTab from '../components/company/CompanyTasksTab'
import CompanyComplianceTab from '../components/company/CompanyComplianceTab'
import ComplianceStatusStrip from '../components/company/ComplianceStatusStrip'

// 校验是否为有效 Date 对象（排除 invalid date 与 NaN）
const isValidDate = (d) => d instanceof Date && !isNaN(d)

// NAR1 / BR 与合规提醒打通所用的预设规则 ID（与 presetRules.js 一致）
const NAR1_RULE = 'HK_AR_42'
const BR_RULE = 'HK_BR_RENEW'

// 日期偏移（天）
const shiftDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * 前端轻量 calcDueDate（与后端 complianceService.calcDueDate 逻辑一致）：
 * 根据规则 baseDateType + anchorPayload 计算提醒到期日预览。
 *  - incorporationDate / financialYearEnd：dueDateOffset 正数 = 截止日后再加 N 天（相加）
 *  - fixed / reference(BR)：dueDateOffset 正数 = 提前 N 天（相减）
 *  - trigger：返回 ''（不自动计算）
 * 返回 YYYY-MM-DD 或 ''（无法计算时）
 */
function calcRuleDueDate(rule, company) {
  if (!rule || !company || rule.baseDateType === 'trigger') return ''
  const today = new Date()
  const year = today.getFullYear()
  const ap = rule.anchorPayload
  let base = null

  if (rule.baseDateType === 'incorporationDate') {
    if (!company.incorporationDate) return ''
    const inc = new Date(company.incorporationDate)
    if (!isValidDate(inc)) return ''
    base = new Date(year, inc.getMonth(), inc.getDate())
    if (base < today) base.setFullYear(year + 1)
    base = shiftDays(base, (rule.baseDateOffset || 365) - 365)
  } else if (rule.baseDateType === 'financialYearEnd') {
    if (!company.financialYearEnd) return ''
    let mm, dd
    if (typeof company.financialYearEnd === 'string') {
      [mm, dd] = company.financialYearEnd.split('-').map(Number)
    } else if (company.financialYearEnd && company.financialYearEnd.month != null) {
      mm = company.financialYearEnd.month
      dd = company.financialYearEnd.day
    } else return ''
    if (!mm || !dd) return ''
    base = new Date(year, mm - 1, dd)
    if (base < today) base.setFullYear(year + 1)
    base = shiftDays(base, rule.baseDateOffset || 0)
  } else if (rule.baseDateType === 'fixed') {
    if (ap && ap.reference === 'brExpiryDate') {
      if (!company.brExpiryDate) return ''
      const d = new Date(company.brExpiryDate)
      if (!isValidDate(d)) return ''
      base = d
    } else if (ap && ap.m && ap.d) {
      base = new Date(year, ap.m - 1, ap.d)
      if (base < today) base.setFullYear(year + 1)
    } else return ''
  }

  if (!base) return ''
  const offset = rule.dueDateOffset || 0
  // fixed 类提前 N 天 → 相减；其余（含 HKEX 月报）相加
  const sign = (rule.baseDateType === 'fixed' && rule.ruleId !== 'HKEX_MONTHLY_RETURN') ? -1 : 1
  const due = shiftDays(base, sign * offset)
  if (!isValidDate(due)) return ''
  return due.toISOString().substring(0, 10)
}

const LINK_FORM_RULES = {
  name: [required('名称为必填')],
}

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  // 自定义 hooks（D2）：公司任务 / 规则库取数，封装对应 service
  const companyTasksApi = useCompanyTasks(id)
  const ruleLibApi = useRuleLibrary()

  const [company, setCompany] = useState(null)
  const [documents, setDocuments] = useState([])
  const [meetings, setMeetings] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [reminders, setReminders] = useState([])
  const [tasks, setTasks] = useState([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkModalMode, setLinkModalMode] = useState('add') // 'add' | 'historical'
  const [editingLink, setEditingLink] = useState(null)
  const [linkForm, setLinkForm] = useState({ linkModel: 'Personnel', name: '', roles: ['director'], shares: '', shareType: 'ordinary', nric: '', appointedDate: '', ceasedDate: '', selectedId: '' })
  const [linkFormErrors, setLinkFormErrors] = useState({})
  // v6.x 曾用名维护
  const [showFormerNameModal, setShowFormerNameModal] = useState(false)
  const [newFormerName, setNewFormerName] = useState('')
  const [newFormerNameChinese, setNewFormerNameChinese] = useState('')
  const [addingFormerName, setAddingFormerName] = useState(false)
  // v6.x 系统级归位：扫描当前 formerNames，把"合法变体"自动迁移到正确字段
  const [normalizingFormerNames, setNormalizingFormerNames] = useState(false)
  const [normalizeReport, setNormalizeReport] = useState(null)
  // 登记册生成
  const [generatingReg, setGeneratingReg] = useState(null) // 'rod' | 'rom' | null
  const [previewReg, setPreviewReg] = useState(null) // { type, title, region, purpose } | null
  // 标记离任模态框
  const [showCeaseModal, setShowCeaseModal] = useState(false)
  const [ceasingLink, setCeasingLink] = useState(null) // link being ceased/restored
  const [ceasedDateInput, setCeasedDateInput] = useState('')
  // 所有 personnel 和 companies（用于联动显示最新数据）
  const [allPersonnel, setAllPersonnel] = useState([])
  const [allCompanies, setAllCompanies] = useState([])

  // v5.1 文件管理中心：补充上传相关文件（关联会议/事项）
  const [uploadRelOpen, setUploadRelOpen] = useState(false)
  const [relForm, setRelForm] = useState({ name: '', type: 'other', meetingId: '', file: null })
  // 合规规则库（用于新增提醒时联动选择 + 自定义沉淀）
  const [rules, setRules] = useState([])
  // 适配当前公司的规则（jurisdiction 匹配 或 ALL），供弹窗/快捷区过滤
  const applicableRules = useMemo(
    () => rules.filter(r => r.jurisdiction === company?.jurisdiction || r.jurisdiction === 'ALL'),
    [rules, company]
  )
  // 新增合规提醒
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderForm, setReminderForm] = useState({
    mode: 'rule', // 'rule' | 'custom'
    ruleId: '',
    title: '',
    description: '',
    priority: '中',
    dueDate: '',
    saveAsRule: false,
    ruleName: '',
    ruleCategory: '',
    ruleFrequency: '',
  })
  const [savingReminder, setSavingReminder] = useState(false)

  // NAR1 / BR 合规状态位（公司简介页双入口，与合规提醒打通）
  const [showNar1Modal, setShowNar1Modal] = useState(false)
  const [showBrModal, setShowBrModal] = useState(false)
  const [nar1Reminder, setNar1Reminder] = useState(null)
  const [nar1Form, setNar1Form] = useState({ filed: false, incorporationDate: '', file: null })
  const [brForm, setBrForm] = useState({ expiry: '', file: null })
  const [savingComplianceDate, setSavingComplianceDate] = useState(false)

  // 基本信息内联编辑
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [savingInfo, setSavingInfo] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [compRes, meetRes, compRes2, persRes, compsRes, remRes, taskRes, rulesRes, docRes] = await Promise.all([
        companyService.getOne(id),
        meetingService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        companyService.getCompliance(id).catch(() => null),
        personnelService.getAll().catch(() => ({ data: { data: [] } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getAll({ companyId: id }).catch(() => ({ data: { data: [] } })),
        taskService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        complianceRuleService.getAll().catch(() => ({ data: { data: [] } })),
        documentService.getByCompany(id).catch(() => ({ data: { data: [] } })),
      ])
      setCompany(compRes.data.data)
      // 列表状态一律经 toArray 兜底：即便后端 / normalize 返回非数组也不会白屏
      setMeetings(toArray(meetRes?.data?.data, 'meetings'))
      setDocuments(toArray(docRes?.data?.data, 'documents'))
      if (compRes2) setCompliance(compRes2.data.data)
      setReminders(toArray(remRes?.data?.data, 'reminders'))
      setTasks(toArray(taskRes?.data?.data, 'tasks'))
      setAllPersonnel(toArray(persRes?.data?.data, 'personnel', 'personnelList'))
      setAllCompanies(toArray(compsRes?.data?.data, 'companies'))
      setRules(toArray(rulesRes?.data?.data, 'rules'))
    } catch (err) {
      // 公司不存在或 id 无效：显示空状态而非强制跳回列表
      setCompany(null)
      const status = err?.response?.status
      if (status && status !== 404 && status !== 400) {
        toast.error('Failed to load company')
        navigate('/companies')
      }
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
      nameChinese: company?.nameChinese || '',
      registrationNumber: company?.registrationNumber || '',
      type: company?.type || 'private_limited',
      jurisdiction: company?.jurisdiction || 'HK',
      incorporationDate: company?.incorporationDate ? company.incorporationDate.substring(0, 10) : '',
      issuedShares: company?.shareCapital?.issued || '',
      paidUpCapital: company?.shareCapital?.paidUp || '',
      currency: company?.shareCapital?.currency || 'HKD',
      brExpiryDate: company?.brExpiryDate?.substring?.(0, 10) || '',
      bviRelevantActivity: company?.bviRelevantActivity || '',
      nonHongKongCompany: !!company?.nonHongKongCompany,
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
      const prevNonHK = !!company?.nonHongKongCompany
      const nextNonHK = !!infoForm.nonHongKongCompany
      await companyService.update(id, {
        name: infoForm.name,
        nameChinese: infoForm.nameChinese || undefined,
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
        brExpiryDate: infoForm.brExpiryDate || undefined,
        bviRelevantActivity: infoForm.bviRelevantActivity || undefined,
        nonHongKongCompany: nextNonHK,
      })
      toast.success('公司信息已更新')
      setEditingInfo(false)
      // 切换 nonHongKongCompany 后立即 ensure 对应年度申报 + BR 提醒（idempotent，幂等）
      if (infoForm.jurisdiction === 'HK' && prevNonHK !== nextNonHK) {
        const ruleIds = nextNonHK ? ['HK_NN3_AR', 'HK_BR_RENEW'] : ['HK_AR_42', 'HK_BR_RENEW']
        complianceReminderService.ensure({ companyId: id, ruleIds }).catch(() => {})
      }
      loadAll()
    } catch { toast.error('更新失败') } finally { setSavingInfo(false) }
  }, [id, infoForm, company, loadAll])

  // ---- 合规提醒新增（联动 Rules + 自定义沉淀） ----
  const openAddReminder = () => {
    setReminderForm({
      mode: 'rule', ruleId: '', title: '', description: '',
      priority: '中', dueDate: '',
      saveAsRule: false, ruleName: '', ruleCategory: 'other', ruleFrequency: 'annual',
    })
    setShowReminderModal(true)
  }

  // B3：公司工作台 tasks Tab 的「＋新建任务」入口（预填本公司，把中枢做实）
  const openAddTask = () => setTaskModalOpen(true)

  // v6.x 曾用名维护（手动 add / remove；merger 来源不可删，与后端 former-names PUT 路由对齐）
  const saveNewFormerName = useCallback(async () => {
    if (!newFormerName.trim()) return
    setAddingFormerName(true)
    try {
      await companyService.updateFormerNames(id, 'add', {
        name: newFormerName.trim(),
        nameChinese: newFormerNameChinese.trim() || undefined,
      })
      toast.success('已添加曾用名')
      setNewFormerName('')
      setNewFormerNameChinese('')
      setShowFormerNameModal(false)
      const { data } = await companyService.getOne(id)
      if (data?.data) setCompany(data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || '添加失败')
    } finally {
      setAddingFormerName(false)
    }
  }, [id, newFormerName, newFormerNameChinese])

  const removeFormerName = useCallback(async (index) => {
    if (!confirm(`确认删除这条曾用名？（仅手动/seed 来源可删；合并来源不可删）`)) return
    try {
      await companyService.updateFormerNames(id, 'remove', { index })
      toast.success('已删除')
      const { data } = await companyService.getOne(id)
      if (data?.data) setCompany(data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || '删除失败')
    }
  }, [id])

  // v6.x 系统级归位：智能识别合法变体（同英文不同拼写 / 纯中文别名）并从 formerNames 移除
  const normalizeFormerNames = useCallback(async () => {
    if (!company?.formerNames?.length) return
    if (!confirm('将扫描当前所有「曾用名」，按智能分类自动移除「合法变体」（大小写差异 / Ltd↔Limited / 标点 / 純中文别名），并回填空字段。真曾用名将保留。\n\n确定吗？')) return
    setNormalizingFormerNames(true)
    try {
      const { data } = await companyService.normalizeFormerNames(id)
      const r = data?.data || data
      if (r?.migrated?.length > 0) {
        toast.success(`已自动归位 ${r.migrated.length} 条「合法变体」`)
      } else {
        toast.success('没有发现误标记的曾用名')
      }
      // 刷新公司数据
      const refreshed = await companyService.getOne(id)
      if (refreshed?.data?.data) setCompany(refreshed.data.data)
      setNormalizeReport(r)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || '归位失败')
    } finally {
      setNormalizingFormerNames(false)
    }
  }, [id, company])
  const handleCreateTask = async (payload) => {
    setTaskSaving(true)
    try {
      await companyTasksApi.createTask(payload)
      toast.success('任务已创建')
      setTaskModalOpen(false)
      // 仅局部刷新任务列表，避免整页重载闪烁
      const fresh = await companyTasksApi.reload()
      setTasks(fresh)
    } catch {
      toast.error('创建任务失败')
    } finally {
      setTaskSaving(false)
    }
  }

  // 选择 Rule 时自动填充（标题/描述/优先级 + 按规则类型计算到期日预览）
  const handleRuleSelect = useCallback((ruleId) => {
    if (!ruleId) {
      setReminderForm(f => ({ ...f, ruleId: '', title: '', description: '', priority: '中' }))
      return
    }
    const rule = rules.find(r => r._id === ruleId)
    if (rule) {
      const due = calcRuleDueDate(rule, company)
      setReminderForm(f => ({
        ...f,
        ruleId,
        title: `${rule.ruleName || rule.name || '规则'} - ${company?.name || ''}`,
        description: rule.description || '',
        priority: rule.priority || '中',
        dueDate: f.dueDate || due || '',
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
        await ruleLibApi.createRule({
          name: reminderForm.ruleName,
          category: reminderForm.ruleCategory || 'other',
          description: reminderForm.description,
          jurisdiction: company?.jurisdiction || 'HK',
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

  // ── NAR1 / BR 状态位：与合规提醒闭环打通 ──
  const handleUpdateNar1 = useCallback((rem) => {
    setNar1Reminder(rem || null)
    setNar1Form({
      filed: !!(rem && rem.status !== '已完成'),
      incorporationDate: company?.incorporationDate ? company.incorporationDate.substring(0, 10) : '',
      file: null,
    })
    setShowNar1Modal(true)
  }, [company])

  const handleUpdateBr = useCallback((_rem) => {
    setBrForm({
      expiry: company?.brExpiryDate ? company.brExpiryDate.substring(0, 10) : '',
      file: null,
    })
    setShowBrModal(true)
  }, [company])

  const handleGenerateReminder = useCallback(async (ruleId) => {
    try {
      // 「生成提醒」按钮只 ensure（幂等、不删已有提醒），与 recompute（用于 BR/NAR1 更新后的续排重建）区分
      const { data } = await complianceReminderService.ensure({ companyId: id, ruleIds: [ruleId] })
      const r = data && data.data
      toast.success(r && r.created > 0 ? `已生成 ${r.created} 条提醒` : '提醒已存在或字段不足')
      loadAll()
    } catch { toast.error('生成失败') }
  }, [id, loadAll])

  const uploadComplianceDoc = useCallback(async (file, { name, type, category }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name)
    fd.append('type', type)
    fd.append('category', category)
    fd.append('company', JSON.stringify({ _id: id, name: company?.name, registrationNumber: company?.registrationNumber }))
    fd.append('note', '由公司简介页合规状态位上传')
    await documentService.upload(fd)
  }, [id, company])

  const handleSaveNar1 = async () => {
    setSavingComplianceDate(true)
    try {
      if (nar1Form.filed && nar1Reminder) {
        await complianceReminderService.markCompleted(nar1Reminder._id)
      }
      if (nar1Form.incorporationDate && nar1Form.incorporationDate !== (company?.incorporationDate || '').substring(0, 10)) {
        await companyService.update(id, { incorporationDate: nar1Form.incorporationDate })
      }
      if (nar1Form.file) {
        await uploadComplianceDoc(nar1Form.file, {
          name: `NAR1 - ${company?.name} (${new Date().getFullYear()})`,
          type: 'annual_report',
          category: 'annual_return',
        })
      }
      // 重新生成下一年度提醒（标记完成后确保下一周期存在；补全成立日后确保首条存在）
      await complianceReminderService.recompute({ companyId: id, ruleIds: [NAR1_RULE] })
      toast.success('NAR1 已更新，提醒已刷新')
      setShowNar1Modal(false)
      loadAll()
    } catch { toast.error('更新失败') } finally { setSavingComplianceDate(false) }
  }

  const handleSaveBr = async () => {
    setSavingComplianceDate(true)
    try {
      if (brForm.expiry) {
        await companyService.update(id, { brExpiryDate: brForm.expiry })
      }
      if (brForm.file) {
        await uploadComplianceDoc(brForm.file, {
          name: `BR - ${company?.name}`,
          type: 'certificate',
          category: 'license_renewal',
        })
      }
      await complianceReminderService.recompute({ companyId: id, ruleIds: [BR_RULE] })
      toast.success('BR 已更新，续期提醒已刷新')
      setShowBrModal(false)
      loadAll()
    } catch { toast.error('更新失败') } finally { setSavingComplianceDate(false) }
  }

  const downloadRegister = async (type) => {
    if (!company) return
    setGeneratingReg(type)
    try {
      if (type === 'rom') {
        // 真正的 .docx：香港(8列) / BVI(嵌套19列)，按地区+用途(签字栏)生成
        // 动态加载 docx 库（~300KB），仅在用户点下载时才拉取
        const { buildRomDocxBlob } = await import('../utils/romDocx')
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
        const { buildRodDocxBlob } = await import('../utils/rodDocx')
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
      <div key={link._id} className="flex items-center justify-between p-3 bg-canvas rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${link.roles.includes('director') ? 'bg-primary-100 text-primary-700' : link.roles.includes('shareholder') ? 'bg-success/10 text-success' : link.roles.includes('secretary') ? 'bg-warning/10 text-warning' : 'bg-canvas text-ink'}`}>
            {personInitial(p) || '?'}
          </div>
          <div>
            {link.linkModel === 'Personnel' ? (
              <Link to={`/personnel/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {formatPersonName(p) || 'Unknown'} <ExternalLink size={12} />
              </Link>
            ) : (
              <Link to={`/companies/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {formatPersonName(p) || 'Unknown'} <ExternalLink size={12} />
              </Link>
            )}
            <div className="flex items-center gap-2 text-xs text-ink-3 mt-0.5">
              {link.appointedDate && <span>Since {formatDate(link.appointedDate)}</span>}
              {link.ceasedDate && <span className="text-danger">Ceased {formatDate(link.ceasedDate)}</span>}
              {p.nric && <span>{p.nric}</span>}
              {link.shares > 0 && <span>{link.shares.toLocaleString()} {link.shareType}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {link.roles.map(r => <span key={r} className="badge badge-info text-xs">{r}</span>)}
          </div>
          <button onClick={() => openEditLink(link)} className="p-1 text-ink-3 hover:text-primary-600" title="Edit link"><Edit3 size={14} /></button>
          <button onClick={() => handleRemoveLink(link._id)} className="p-1 text-ink-3 hover:text-danger" title="Remove"><Trash2 size={14} /></button>
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
    <label className="reg-select">
      <span className="reg-select__label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="reg-select__field"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )

  // 登记册表格子组件：区分现任/历任，支持标记离任/恢复，保留完整记录
  const RegisterTable = ({ title, subtitle, links, columns, onDownload, onPreview, generating, regType, emptyText, extraControls }) => {
    const current = links.filter(l => !l.ceasedDate)
    const former = links.filter(l => !!l.ceasedDate)
    const renderRows = (list) => list.map(link => {
      const p = resolveLinkDisplay(link)
      return (
        <tr key={link._id} className={`border-b hover:bg-canvas ${link.ceasedDate ? 'bg-danger/10/40' : ''}`}>
          {columns.map(col => (
            <td key={col.key} data-label={col.header} className={col.tdClass || 'p-2'}>{col.cell(link, p)}</td>
          ))}
          <td data-label="操作" className="p-2 text-right">
            {link.ceasedDate ? (
              <button onClick={() => handleRestoreLink(link._id)} className="text-xs text-success hover:underline font-medium">恢复</button>
            ) : (
              <button onClick={() => handleRemoveLink(link._id)} className="text-xs text-danger hover:underline font-medium">标记离任</button>
            )}
          </td>
        </tr>
      )
    })
    const Section = ({ label, list, bg }) => (
      <div className="mb-3">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-t ${bg}`}>
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-2">({list.length})</span>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-ink-3 px-2 py-2">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-responsive">
              <tbody>{renderRows(list)}</tbody>
            </table>
          </div>
        )}
      </div>
    )
    return (
      <div className="card">
        <div className="register-card__header">
          <div className="register-card__title">
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-ink-2">{subtitle}</p>
          </div>
          <div className="register-card__actions">
            {extraControls}
            <button onClick={openAddHistorical} className="btn-secondary register-card__btn flex items-center gap-1 text-xs">
              <Plus size={14} /> 添加历史记录
            </button>
            <button onClick={onPreview} className="btn-secondary register-card__btn flex items-center gap-2 text-sm">
              <Eye size={16} /> 预览
            </button>
            <button onClick={() => onDownload(regType)} disabled={generating} className="btn-primary register-card__btn flex items-center gap-2 text-sm">
              {generating ? '生成中...' : <><Download size={16} /> 生成 Word</>}
            </button>
          </div>
        </div>
        {links.length === 0 ? (
          <p className="text-ink-3 text-sm py-4">{emptyText}</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-responsive">
              <thead>
                <tr className="bg-canvas border-b">
                  {columns.map(col => (
                    <th key={col.key} className={col.thClass || 'text-left p-2 font-medium text-ink-2'}>{col.header}</th>
                  ))}
                  <th className="text-right p-2 font-medium text-ink-2">操作</th>
                </tr>
              </thead>
            </table>
            <Section label="现任 (Current)" list={current} bg="bg-success/10" />
            <Section label="历任 (Former)" list={former} bg="bg-danger/10" />
          </div>
        )}
      </div>
    )
  }

  // 登记册预览渲染器（HTML 预览，与 Word 内容同源但简化排版）
  const RegisterPreview = ({ preview }) => {
    const { type, region, purpose } = preview
    const genDate = formatDate(new Date())
    const isBvi = region === 'BVI'
    const withSig = purpose === 'bank' || purpose === 'audit'
    const links = type === 'rom'
      ? shareholders
      : type === 'rod'
        ? directors
        : secretaries
    const current = links.filter((l) => !l.ceasedDate)
    const former = links.filter((l) => !!l.ceasedDate)

    const Header = () => (
      <div className="text-center border-b-2 border-ink pb-4 mb-4">
        <h3 className="text-lg font-bold uppercase">{(company.name || '').toUpperCase()}</h3>
        {company.nameChinese && <p className="text-base mt-1">{company.nameChinese}</p>}
        <div className="text-xs mt-2 text-ink-2 flex justify-center gap-3 flex-wrap">
          <span><strong>Company No.:</strong> {company.registrationNumber || '-'}</span>
          <span><strong>Jurisdiction:</strong> {region === 'BVI' ? 'BVI' : 'Hong Kong'}</span>
          <span><strong>Date:</strong> {genDate}</span>
          {purpose !== 'standard' && <span className="text-primary-700 font-medium">Purpose: {purpose}</span>}
        </div>
        <h4 className="text-base font-bold mt-4 uppercase tracking-wide">
          {type === 'rom' ? 'Register of Members' : type === 'rod' ? 'Register of Directors' : 'Register of Secretaries'}
        </h4>
      </div>
    )

    const Row = ({ label, list, cols }) => (
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span className="bg-canvas px-2 py-0.5 rounded">{label}</span>
          <span className="text-xs text-ink-2">({list.length})</span>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-ink-3 italic">— 无记录 —</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs table-responsive">
              <thead className="bg-canvas border-b">
                <tr>
                  {cols.map((c) => <th key={c.key} className="text-left p-2 font-medium whitespace-nowrap">{c.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const p = resolveLinkDisplay(l)
                  return (
                    <tr key={l._id} className="border-b last:border-b-0">
                      {cols.map((c) => <td key={c.key} data-label={c.header} className="p-2 align-top">{c.cell(l, p)}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )

    const rodCols = [
      { key: 'appointed', header: 'Date Appointed', cell: (l) => formatDate(l.appointedDate) },
      { key: 'name', header: 'Full Name', cell: (l, p) => p.name || '-' },
      { key: 'nric', header: 'NRIC/Passport', cell: (l, p) => p.nric || '-' },
      { key: 'nationality', header: 'Nationality', cell: (l, p) => p.nationality || '-' },
      { key: 'address', header: 'Address for Service', cell: (l, p) => [p.address?.street, p.address?.city, p.address?.country].filter(Boolean).join(', ') || '-' },
      { key: 'role', header: 'Role', cell: (l) => l.roles.map((r) => r.replace('_', ' ')).join(', ') },
      { key: 'ceased', header: 'Date Ceased', cell: (l) => (l.ceasedDate ? formatDate(l.ceasedDate) : 'Present') },
    ]

    const romCols = [
      { key: 'entered', header: 'Date Entered', cell: (l) => formatDate(l.appointedDate) },
      { key: 'name', header: 'Member Name', cell: (l, p) => p.name || '-' },
      { key: 'address', header: 'Address / Jurisdiction', cell: (l, p) => p.address?.country || p.registrationNumber || '-' },
      { key: 'shares', header: 'No. of Shares', cell: (l) => (l.shares || 0).toLocaleString() },
      { key: 'type', header: 'Type', cell: (l) => l.shareType || 'Ordinary' },
      { key: 'pct', header: '%', cell: (l) => (company.shareCapital?.paidUp && l.shares ? ((l.shares / company.shareCapital.paidUp * 100).toFixed(2) + '%') : '-') },
      { key: 'ceased', header: 'Date Ceased', cell: (l) => (l.ceasedDate ? formatDate(l.ceasedDate) : 'Present') },
    ]

    const secCols = [
      { key: 'appointed', header: 'Date Appointed', cell: (l) => formatDate(l.appointedDate) },
      { key: 'name', header: 'Name', cell: (l, p) => p.name || '-' },
      { key: 'nric', header: 'NRIC/Passport', cell: (l, p) => p.nric || '-' },
      { key: 'address', header: 'Address', cell: (l, p) => [p.address?.street, p.address?.city, p.address?.country].filter(Boolean).join(', ') || '-' },
      { key: 'ceased', header: 'Date Ceased', cell: (l) => (l.ceasedDate ? formatDate(l.ceasedDate) : 'Present') },
    ]

    const cols = type === 'rom' ? romCols : type === 'rod' ? rodCols : secCols

    return (
      <div className="bg-white text-ink p-6 rounded border shadow-sm min-h-[400px]">
        <Header />
        {isBvi ? (
          <div className="space-y-4">
            <div className="bg-info/10 text-info-700 p-3 rounded text-sm">
              BVI 格式包含多个独立分表（个人/公司 ORIGINAL + COPY），预览仅显示数据摘要。
            </div>
            <Row label="现任 (Current)" list={current} cols={cols} />
            <Row label="历任 (Former)" list={former} cols={cols} />
          </div>
        ) : (
          <>
            <Row label="现任 (Current)" list={current} cols={cols} />
            <Row label="历任 (Former)" list={former} cols={cols} />
          </>
        )}
        {withSig && (
          <div className="mt-6 pt-4 border-t border-dashed border-ink-2">
            <p className="text-xs text-ink-2 italic">{purpose === 'bank' ? '银行用途：包含签字栏与认证页脚。' : '审计用途：包含签字栏与审计页脚。'}</p>
          </div>
        )}
        <div className="mt-6 text-center text-[10px] text-ink-3 uppercase tracking-wider">Preview — Claw Company Secretary System</div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner size="md" />
  if (!company) return <EmptyState icon={Building2} title="未找到该公司" description="该公司记录不存在或已被删除" />

  // 下传给各 Tab 的共享上下文（状态 + 回调 + 共享渲染器），保持等价行为。
  const ctx = {
    company,
    companyId: id,
    documents,
    setDocuments,
    meetings,
    tasks,
    compliance,
    reminders,
    rules,
    // 基本信息
    editingInfo, setEditingInfo, infoForm, setInfoForm, savingInfo,
    openEditInfo, saveInfo,
    // 关联成员
    directors, shareholders, secretaries,
    activeDirectors, activeShareholders, activeSecretaries,
    formerDirectors, formerShareholders, formerSecretaries,
    openAddLink, openEditLink, handleRemoveLink, handleRestoreLink, openAddHistorical,
    renderLinkRow,
    // 文件
    onUploadRelated: () => { setRelForm({ name: '', type: 'other', meetingId: '', file: null }); setUploadRelOpen(true) },
    // 登记册
    romRegion, setRomRegion, romPurpose, setRomPurpose,
    rodRegion, setRodRegion, rodPurpose, setRodPurpose,
    generatingReg, downloadRegister, setPreviewReg,
    RegisterTable, RegSelect, REGION_OPTS, PURPOSE_OPTS,
    // 任务
    openAddTask,
    // v6.x 曾用名维护
    showFormerNameModal, setShowFormerNameModal,
    newFormerName, setNewFormerName,
    newFormerNameChinese, setNewFormerNameChinese,
    addingFormerName, saveNewFormerName, removeFormerName,
    normalizeFormerNames, normalizeReport, setNormalizeReport, normalizingFormerNames,
    // 合规
    openAddReminder, applicableRules, setReminderForm, handleRuleSelect, setShowReminderModal,
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Companies', to: '/companies' }, { label: company?.name || '—' }]} />
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
            {company.jurisdiction && <span className="badge badge-info">{jurisdictionLabel(company.jurisdiction)}</span>}
          </>
        }
      />

      {/* 合规状态位：NAR1 周年申报 + 商业登记证（与合规提醒打通，单一事实源） */}
      <ComplianceStatusStrip
        company={company}
        reminders={reminders}
        onUpdateNar1={handleUpdateNar1}
        onUpdateBr={handleUpdateBr}
        onViewReminders={() => setActiveTab('compliance')}
        onGenerate={handleGenerateReminder}
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

      {/* Tab 内容（全部下沉至 components/company/*，D2 等价重构） */}
      {activeTab === 'info' && <CompanyInfoTab ctx={ctx} />}
      {activeTab === 'people' && <CompanyPeopleTab ctx={ctx} />}
      {activeTab === 'documents' && <CompanyDocumentsTab ctx={ctx} />}
      {activeTab === 'equity' && <CompanyEquityTab ctx={ctx} />}
      {activeTab === 'registers' && <CompanyRegistersTab ctx={ctx} />}
      {activeTab === 'compliance' && <CompanyComplianceTab ctx={ctx} />}
      {activeTab === 'tasks' && <CompanyTasksTab ctx={ctx} />}

      {/* B3：公司工作台「＋新建任务」Modal（复用共享 TaskForm，预填本公司） */}
      <Modal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="新增任务" size="md">
        <TaskForm
          initial={{ company: id }}
          onSave={handleCreateTask}
          onCancel={() => setTaskModalOpen(false)}
          loading={taskSaving}
        />
      </Modal>

      {/* ====== Cease/Restore Modal ====== */}
      <Modal isOpen={showCeaseModal} onClose={() => { setShowCeaseModal(false); setCeasingLink(null) }} title="标记离任" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">此成员将标记为「历任」，记录保留在登记册中（可随时恢复）。</p>
          <FormField label="离任日期" required>
            <input type="date" className={inputClass} value={ceasedDateInput} onChange={e => setCeasedDateInput(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCeaseModal(false); setCeasingLink(null) }} className="btn-secondary">取消</button>
            <button onClick={handleConfirmCease} className="btn-primary bg-danger hover:opacity-90">确认离任</button>
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
                      linkForm.roles.includes(r) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-hairline text-ink-2'
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
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${reminderForm.mode === 'rule' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-hairline text-ink-2 hover:bg-canvas'}`}
            >
              📋 从规则库选择
            </button>
            <button
              onClick={() => setReminderForm(f => ({ ...f, mode: 'custom', ruleId: '', title: f.title }))}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${reminderForm.mode === 'custom' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-hairline text-ink-2 hover:bg-canvas'}`}
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
                  {applicableRules.map(r => (
                    <option key={r._id} value={r._id}>{r.ruleName || r.name} ({r.frequency}){r.isPreset ? ' ★' : ''}</option>
                  ))}
                </select>
              </FormField>
              {rules.length === 0 && <p className="text-xs text-warning">暂无可用规则，请先在「合规规则」页面创建</p>}
            </>
          ) : null}

          {/* 共用字段（自定义模式下全部可编辑，规则模式下自动填充后可微调） */}
          <FormField label="标题" required><input className={inputClass} value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} placeholder="例如：NAR1 年度申报表 - Easy Rich Corporation" /></FormField>
          <FormField label="描述"><textarea className={inputClass} rows={2} value={reminderForm.description} onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))} placeholder="说明此合规事项的要求..." /></FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="优先级">
              <select className={inputClass} value={reminderForm.priority} onChange={e => setReminderForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="低">低</option>
                <option value="中">中</option>
                <option value="高">高</option>
                <option value="紧急">紧急</option>
              </select>
            </FormField>
            <FormField label="到期日期" required>
              <input type="date" className={inputClass} value={reminderForm.dueDate} onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))} />
            </FormField>
          </div>

          {/* 自定义模式：保存为规则选项 */}
          {reminderForm.mode === 'custom' && (
            <div className="border border-dashed border-hairline rounded-lg p-3 space-y-3 bg-canvas/50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={reminderForm.saveAsRule} onChange={e => setReminderForm(f => ({ ...f, saveAsRule: e.target.checked }))} className="rounded" />
                <span className="font-medium text-ink">💾 保存为规则（沉淀到规则库，供其他公司复用）</span>
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

      {/* ====== NAR1 更新 Modal（与合规提醒打通） ====== */}
      <Modal isOpen={showNar1Modal} onClose={() => setShowNar1Modal(false)} title="更新 NAR1 周年申报表" size="md">
        <div className="space-y-4">
          {nar1Reminder && nar1Reminder.status !== '已完成' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer bg-success/10 border border-success/20 rounded-lg p-3">
              <input type="checkbox" checked={nar1Form.filed} onChange={e => setNar1Form(f => ({ ...f, filed: e.target.checked }))} className="rounded" />
              <span className="font-medium text-ink">标记本年度已提交</span>
              <span className="text-xs text-ink-3 ml-auto">下次到期：{formatDate(nar1Reminder.dueDate)}</span>
            </label>
          )}
          {nar1Reminder && nar1Reminder.status === '已完成' && (
            <div className="text-sm bg-success/10 border border-success/20 rounded-lg p-3 text-success font-medium">
              ✓ 本年度 NAR1 已提交（到期日 {formatDate(nar1Reminder.dueDate)}）
            </div>
          )}
          <FormField label="成立日期" hint="NAR1 提醒基准 = 成立周年日 + 42 天；补全后可自动续排">
            <input type="date" className={inputClass} value={nar1Form.incorporationDate}
              onChange={e => setNar1Form(f => ({ ...f, incorporationDate: e.target.value }))} />
          </FormField>
          <FormField label="上传 NAR1 正本（PDF，可选）">
            <input type="file" accept="application/pdf,.pdf" className={inputClass}
              onChange={e => setNar1Form(f => ({ ...f, file: e.target.files[0] || null }))} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowNar1Modal(false)} className="btn-secondary">取消</button>
            <button onClick={handleSaveNar1} disabled={savingComplianceDate} className="btn-primary">
              {savingComplianceDate ? '保存中...' : '保存并更新提醒'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ====== BR 更新 Modal（与合规提醒打通） ====== */}
      <Modal isOpen={showBrModal} onClose={() => setShowBrModal(false)} title="更新商业登记证（BR）" size="md">
        <div className="space-y-4">
          <FormField label="商业登记证到期日" required hint="续期提醒基准 = 到期日 - 30 天">
            <input type="date" className={inputClass} value={brForm.expiry}
              onChange={e => setBrForm(f => ({ ...f, expiry: e.target.value }))} />
          </FormField>
          <FormField label="上传 BR 证（PDF，可选）">
            <input type="file" accept="application/pdf,.pdf" className={inputClass}
              onChange={e => setBrForm(f => ({ ...f, file: e.target.files[0] || null }))} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowBrModal(false)} className="btn-secondary">取消</button>
            <button onClick={handleSaveBr} disabled={savingComplianceDate || !brForm.expiry} className="btn-primary">
              {savingComplianceDate ? '保存中...' : '保存并刷新续期提醒'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ====== v5.1 上传相关文件 Modal（关联会议/事项，#3.3） ====== */}
      <Modal isOpen={uploadRelOpen} onClose={() => setUploadRelOpen(false)} title="上传相关文件" size="md">
        <div className="space-y-4">
          <FormField label="文件名称" required>
            <input className={inputClass} value={relForm.name}
              onChange={e => setRelForm(f => ({ ...f, name: e.target.value }))} placeholder="例如：合同草案 / 法律意见书" />
          </FormField>
          <FormField label="文件类型">
            <select className={inputClass} value={relForm.type} onChange={e => setRelForm(f => ({ ...f, type: e.target.value }))}>
              <option value="other">其他</option>
              <option value="agreement">协议</option>
              <option value="resolution">决议</option>
              <option value="board_resolution">董事会决议</option>
              <option value="notice">通知</option>
              <option value="annual_report">周年申报表</option>
              <option value="certificate">证书</option>
              <option value="memo">备忘录</option>
            </select>
          </FormField>
          <FormField label="关联到会议 / 事项">
            <select className={inputClass} value={relForm.meetingId} onChange={e => setRelForm(f => ({ ...f, meetingId: e.target.value }))}>
              <option value="">不关联（仅归入公司）</option>
              {meetings.map(m => (
                <option key={m._id} value={m._id}>{m.title}（{formatDate(m.scheduledAt)}）</option>
              ))}
            </select>
          </FormField>
          <FormField label="选择文件">
            <input type="file" className={inputClass} onChange={e => setRelForm(f => ({ ...f, file: e.target.files[0] || null }))} />
          </FormField>
          <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg text-sm text-warning flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>上传的文件将归入「{company?.name}」文档库{relForm.meetingId ? '，并关联所选会议（可在会议页查看）' : ''}。</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setUploadRelOpen(false)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={async () => {
              if (!relForm.name) { toast.error('请填写文件名称'); return }
              if (!relForm.file) { toast.error('请选择要上传的文件'); return }
              try {
                const mTitle = relForm.meetingId ? (meetings.find(m => m._id === relForm.meetingId)?.title || '关联会议') : null
                const formData = new FormData()
                formData.append('file', relForm.file)
                formData.append('name', relForm.name)
                formData.append('type', relForm.type || 'other')
                formData.append('category', 'other')
                formData.append('company', JSON.stringify({ _id: id, name: company?.name, registrationNumber: company?.registrationNumber }))
                if (relForm.meetingId) formData.append('meeting', relForm.meetingId)
                formData.append('source', JSON.stringify({
                  kind: relForm.meetingId ? 'manual_upload' : 'other',
                  refId: relForm.meetingId || undefined,
                  label: relForm.meetingId ? `来自 [${mTitle}]` : '手动上传',
                }))
                formData.append('note', '由公司详情页上传')
                await documentService.upload(formData)
                toast.success('相关文件已上传并归入公司文档库')
                setUploadRelOpen(false)
                loadAll()
              } catch { toast.error('上传失败') }
            }} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">确认上传</button>
          </div>
        </div>
      </Modal>

      {/* Register Preview Modal */}
      <Modal
        isOpen={!!previewReg}
        onClose={() => setPreviewReg(null)}
        title={previewReg ? `${previewReg.title} 预览` : '登记册预览'}
        size="xl"
      >
        {previewReg && <RegisterPreview preview={previewReg} />}
      </Modal>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}
