import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns'

/**
 * 生成规范文档文件名（适用于 ROM / ROD / 合同等下载）
 * 格式：{TYPE}_{公司名(英文大写)}_{注册号}_{YYYYMMDD}.{ext}
 * 例：ROM_EASY RICH CORPORATION LIMITED_1964368_20260716.docx
 *
 * @param {'ROM'|'ROD'|string} docType - 文档类型代码
 * @param {{ name?: string, registrationNumber?: string }} company - 公司对象
 * @param {object} opts - 可选：{ ext?: string, date?: Date|str, maxLength?: number }
 */
export const generateDocFilename = (docType, company, opts = {}) => {
  const { ext = 'docx', date, maxLength = 80 } = opts
  const now = date ? new Date(date) : new Date()
  const yyyymmdd = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('')

  // 公司名：取英文 → 大写 → 去除文件名非法字符 → 截断
  let rawName = (company?.name || company?.nameChinese || 'UNKNOWN').trim()
  // eslint-disable-next-line no-control-regex -- 文件名清洗需去除控制字符（\x00-\x1f），属有意逻辑
  rawName = rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim()
  if (rawName.length > maxLength) rawName = rawName.substring(0, maxLength)

  const regNo = company?.registrationNumber || 'NA'
  return `${docType}_${rawName}_${regNo}_${yyyymmdd}.${ext}`
}

/**
 * 稳健的 Blob 下载：避免浏览器忽略 a.download 导致文件名变成 blob UUID。
 * 关键：revokeObjectURL 延迟执行，确保浏览器已真正发起下载。
 */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '-'
  try { return format(new Date(date), fmt) }
  catch { return '-' }
}

export const formatDateTime = (date) => {
  if (!date) return '-'
  try { return format(new Date(date), 'dd MMM yyyy HH:mm') }
  catch { return '-' }
}

export const formatRelative = (date) => {
  if (!date) return '-'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) }
  catch { return '-' }
}

export const isOverdue = (date) => {
  if (!date) return false
  return isBefore(new Date(date), new Date())
}

export const isDueSoon = (date, days = 30) => {
  if (!date) return false
  const d = new Date(date)
  return isAfter(d, new Date()) && isBefore(d, addDays(new Date(), days))
}

export const getStatusColor = (status) => {
  const colors = {
    active: 'badge-success', draft: 'badge-gray', scheduled: 'badge-info',
    in_progress: 'badge-warning', completed: 'badge-success', cancelled: 'badge-danger',
    dormant: 'badge-gray', struck_off: 'badge-danger', overdue: 'badge-danger',
    due_soon: 'badge-warning', ok: 'badge-success', approved: 'badge-success',
    proposed: 'badge-info', rejected: 'badge-danger', deferred: 'badge-warning',
    pending: 'badge-gray', accepted: 'badge-success', declined: 'badge-danger',
    attended: 'badge-success', winding_up: 'badge-warning', dissolved: 'badge-danger',
  }
  return colors[status] || 'badge-gray'
}

export const MEETING_TYPES = [
  { value: 'board', label: 'Board Meeting' },
  { value: 'agm', label: 'AGM' },
  { value: 'egm', label: 'EGM' },
  { value: 'committee', label: 'Committee' },
  { value: 'other', label: 'Other' },
]

export const COMPANY_TYPES = [
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'llp', label: 'LLP' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
]

export const DOC_TYPES = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'resolution', label: 'Resolution' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'annual_report', label: 'Annual Report' },
  { value: 'board_resolution', label: 'Board Resolution' },
  { value: 'incorporation_doc', label: 'Incorporation Doc' },
  { value: 'passport', label: 'Passport' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'other', label: 'Other' },
]

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const TASK_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Shared document category labels (used in Documents.jsx & CompanyDetail.jsx)
export const DOC_CATEGORY_LABELS = {
  establishment: '设立文件',
  government: '政府往来',
  financial: '财务税务',
  banking: '银行文件',
  meeting: '会议文件',
  other: '其他',
}

// ── Document expiry status (red / orange / green) ──
// Returns 'expired' (红) | 'expiring' (橙) | 'ok' (绿) | 'none'
export function docExpiryStatus(doc, warnDays = 30) {
  const exp = doc?.expiresAt ? new Date(doc.expiresAt) : null
  const ren = doc?.renewalDueDate ? new Date(doc.renewalDueDate) : null
  const d = exp || ren
  if (!d) return 'none'
  const now = new Date()
  if (d < now) return 'expired'
  const soon = new Date(now.getTime() + warnDays * 86400000)
  if (d <= soon) return 'expiring'
  return 'ok'
}

export const DOC_EXPIRY_BADGE = {
  expired: { label: '已过期', cls: 'bg-danger/10 text-danger' },
  expiring: { label: '即将到期', cls: 'bg-warning/10 text-warning' },
  ok: { label: '有效', cls: 'bg-success/10 text-success' },
  none: null,
}

// ── Meeting shared constants ──

export const MEETING_TYPE_LABELS = {
  board: '董事会', agm: '周年股东大会', egm: '股东特别大会',
  committee: '委员会会议', other: '其他',
}

export const MEETING_PHASES = {
  setup: { label: '草稿', color: 'bg-gray-100 text-ink-2' },
  'notice-draft': { label: '通知草稿', color: 'bg-info/10 text-primary-700' },
  'notice-sent': { label: '已发通知', color: 'bg-info/10 text-primary-700' },
  'meeting-held': { label: '已召开', color: 'bg-success/10 text-success' },
  'minutes-draft': { label: '纪要草稿', color: 'bg-warning/10 text-warning' },
  'minutes-signed': { label: '已签署', color: 'bg-success/10 text-success' },
  completed: { label: '已完成', color: 'bg-success/10 text-success' },
}

// ── 会议归档清单（相关文件 Tab 的"应归档文件"检查表）──
// 按会议类型给出应归档的文件集合；用户在"相关文件"中可逐项查看已上传/待上传并补齐。
// 每项：{ type: 对应 Document.type, label: 中文名, nameIncludes?: 按文件名包含匹配（用于签到表等无专属 type 的文件） }
export const MEETING_ARCHIVE_CHECKLIST = {
  // v5.2 统一归档清单：所有会议类型共享 5 类（决议含在纪要内，不单独列项）
  _shared: [
    { type: 'notice', label: '会议通知' },
    { type: 'materials', label: '会议资料' },
    { type: 'attendance', label: '出席签到表' },
    { type: 'minutes', label: '会议纪要（含决议）' },
    { type: 'other', label: '其他' },
  ],
  board: null,   // ← 用 _shared
  agm: null,
  egm: null,
  committee: null,
  other: null,
}

/** 获取某会议类型的归档清单（统一返回 _shared） */
export function getMeetingChecklist(_meetingType) {
  return MEETING_ARCHIVE_CHECKLIST._shared
}

// 判断某文档是否已满足归档清单某一项
export function docMatchesChecklistItem(doc, item) {
  if (doc.type === item.type) return true
  if (item.nameIncludes && doc.name && doc.name.includes(item.nameIncludes)) return true
  return false
}

// ── v5.1 会议纪要闭环：关键词自动识别生成签署 Task（#2.1） ──
// 系统扫描纪要正文，命中以下关键词即自动生成一条签署类待办事项
export const MINUTES_SIGN_KEYWORDS = ['签署', '签字', '盖章', '签章', '落款']

// 返回命中的关键词数组（空数组表示无需生成签署 Task）
export function detectMinutesKeywords(text) {
  if (!text || typeof text !== 'string') return []
  return MINUTES_SIGN_KEYWORDS.filter(k => text.includes(k))
}

// 根据命中关键词生成签署 Task 的标题
export function buildSignTaskTitle(meetingTitle, keywords) {
  const kw = (keywords || [])[0] || '签署'
  return `${kw}：${meetingTitle || '会议纪要'}`
}

// 来源标签（公司档案文件列表展示"来自 [会议纪要]"并跳回，#3.2）
export function buildSourceLabel(meeting) {
  if (!meeting) return '来自会议纪要'
  const date = meeting.scheduledAt ? fmtDate(meeting.scheduledAt) : ''
  const type = (MEETING_TYPE_LABELS && MEETING_TYPE_LABELS[meeting.type]) || meeting.type || '会议'
  return `来自 [${date} ${type}纪要]`
}

// 哪些 Task 类型必须上传附件方可标记完成（#2.2 / #2.3）
export const TASK_ATTACHMENT_REQUIRED = ['signing', 'document_review']

export function taskRequiresAttachment(task) {
  return !!task && TASK_ATTACHMENT_REQUIRED.includes(task.type)
}


// ── v5.2 模块2：文件库多级筛选（大类 → 子类型 → 年份）──
// 大类 = category（与 DOC_CATEGORY_LABELS 一致）；子类型 = 该大类下的 doc.type 集合。
export const DOC_SUBTYPE_MAP = {
  government: [
    { value: 'return', label: '周年申报表' },
    { value: 'notice', label: '政府通知' },
    { value: 'certificate', label: '政府证书' },
    { value: 'other', label: '其他政府文件' },
  ],
  establishment: [
    { value: 'incorporation_doc', label: '成立文件' },
    { value: 'certificate', label: '注册证书' },
    { value: 'memo', label: '备忘录' },
    { value: 'other', label: '其他设立文件' },
  ],
  financial: [
    { value: 'annual_report', label: '年度财报' },
    { value: 'financial_statement', label: '财务报表' },
    { value: 'other', label: '其他财务文件' },
  ],
  banking: [
    { value: 'bank_account', label: '银行账户' },
    { value: 'other', label: '其他银行文件' },
  ],
  meeting: [
    { value: 'minutes', label: '会议纪要' },
    { value: 'resolution', label: '决议' },
    { value: 'board_resolution', label: '董事会决议' },
    { value: 'notice', label: '会议通知' },
    { value: 'agreement', label: '协议' },
    { value: 'other', label: '其他会议文件' },
  ],
  other: [
    { value: 'agreement', label: '协议' },
    { value: 'memo', label: '备忘录' },
    { value: 'id_document', label: '身份证件' },
    { value: 'passport', label: '护照' },
    { value: 'other', label: '其他' },
  ],
}

// 文档年份（用于年份筛选器）：优先 documentYear，否则从 createdAt 取
export function docYear(doc) {
  if (doc?.documentYear) return String(doc.documentYear)
  if (doc?.createdAt) return String(new Date(doc.createdAt).getFullYear())
  return ''
}

// ── v5.2 模块1 / 模块4：归档命名规则 ──
// 会议归档：[会议日期] 公司名称_文件类型_来源(可选).pdf
//   例：[2026-07-17] Easy Rich Corporation_股东大会纪要.pdf
// Dashboard 签署任务：原文件名 (ctc).pdf / 原文件名 (signed).pdf
const DOC_ARCHIVE_TYPE_LABEL = {
  notice: '会议通知', materials: '会议资料', attendance: '出席签到表',
  minutes: '会议纪要', other: '文件',
  return: '申报表', certificate: '证书',
}

// 根据会议类型 + 文档类型给出归档"文件类型"中文标签
export function archiveTypeLabel(meeting, doc) {
  if (doc?.source?.kind === 'signing_scan') return '股东签署件'
  if (doc?.type === 'minutes') return '会议纪要'  // 决议含在纪要内
  return DOC_ARCHIVE_TYPE_LABEL[doc?.type] || '文件'
}

// 会议归档命名：[YYYY-MM-DD] 公司_类型_来源(可选).pdf
export function buildArchiveDocName(meeting, company, typeLabel, sourceOpt) {
  const date = meeting?.scheduledAt ? fmtDateShort(meeting.scheduledAt) : fmtDateShort(new Date())
  const co = (company?.name || '未知公司').toString().replace(/[<>:"/\\|?*]/g, '').trim()
  const base = `[${date}] ${co}_${typeLabel || '文件'}`
  return sourceOpt ? `${base}_${sourceOpt}.pdf` : `${base}.pdf`
}

// Dashboard 签署任务归档命名：原文件名 (ctc).pdf / 原文件名 (signed).pdf
export function buildCtcDocName(origName, isCTC) {
  const base = (origName || '签署文件').toString().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*]/g, '').trim()
  return isCTC ? `${base} (ctc).pdf` : `${base} (signed).pdf`
}

export const MEETING_STATUSES = {
  draft: '草稿', scheduled: '已排期', in_progress: '进行中',
  completed: '已完成', cancelled: '已取消',
}

// ── Meeting phase icon mapping (shared by Meetings.jsx & MeetingDetail.jsx) ──

export const PHASE_ICON_MAP = {
  setup: 'PenLine', 'notice-draft': 'Clock3', 'notice-sent': 'Send',
  'meeting-held': 'CheckCircle2', 'minutes-draft': 'FileText',
  'minutes-signed': 'CheckCircle2', completed: 'CheckCircle2',
}

/** Build PHASES enriched with Lucide icon components — call with the icon imports */
export const buildPhasesWithIcons = (iconMap) => {
  const icons = {
    PenLine: iconMap.PenLine, Clock3: iconMap.Clock3, Send: iconMap.Send,
    CheckCircle2: iconMap.CheckCircle2, FileText: iconMap.FileText, AlertCircle: iconMap.AlertCircle,
  }
  return Object.fromEntries(
    Object.entries(MEETING_PHASES).map(([k, v]) => [k, { ...v, icon: icons[PHASE_ICON_MAP[k]] || icons.PenLine }])
  )
}

// ── Meeting date/time formatters ──

export function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const w = ['日', '一', '二', '三', '四', '五', '六']
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（周${w[dt.getDay()]}）`
}

export function fmtTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

export function fmtDateShort(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function fmtDateTimeShort(d) {
  if (!d) return ''
  return `${fmtDateShort(d)} ${fmtTime(d)}`
}

/**
 * extractVars — extract {{variable}} placeholders from template content
 * Used by Templates.jsx for variable detection and rendering
 */
export const extractVars = (content) => {
  if (!content) return []
  return [...new Set((content.match(/\{\{([^}]+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, '').trim()))]
}
