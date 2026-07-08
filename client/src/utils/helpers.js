import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns'

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

// ── Meeting shared constants ──

export const MEETING_TYPE_LABELS = {
  board: '董事会', agm: '周年股东大会', egm: '股东特别大会',
  committee: '委员会会议', other: '其他',
}

export const MEETING_PHASES = {
  setup: { label: '草稿', color: 'bg-gray-200 text-gray-600' },
  'notice-draft': { label: '通知草稿', color: 'bg-blue-100 text-blue-600' },
  'notice-sent': { label: '已发通知', color: 'bg-blue-100 text-blue-700' },
  'meeting-held': { label: '已召开', color: 'bg-green-100 text-green-700' },
  'minutes-draft': { label: '纪要草稿', color: 'bg-purple-100 text-purple-700' },
  'minutes-signed': { label: '已签署', color: 'bg-green-100 text-green-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
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
