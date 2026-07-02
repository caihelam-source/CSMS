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
