import api from './api.js'
import {
  auth as mockAuth,
  companies as mockCompanies,
  personnel as mockPersonnel,
  meetings as mockMeetings,
  documents as mockDocuments,
  tasks as mockTasks,
  complianceRules as mockComplianceRules,
  complianceReminders as mockComplianceReminders,
  templates as mockTemplates,
  signTasks as mockSignTasks,
} from './mock.js'

// Default to mock mode — app always works without backend
let useMock = true

// ====== wrap — unifies API and mock ======
// Both return { data: { data: ..., count: ... } } format
const wrap = (apiFn, mockFn) => async (...args) => {
  if (useMock) return mockFn(...args)
  try {
    const res = await apiFn(...args)
    return res // keep full axios response — pages destructure .data
  } catch (err) {
    if (!err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED')) {
      useMock = true
      console.log('[DEMO MODE] Backend unavailable, switching to mock data')
      return mockFn(...args)
    }
    throw err
  }
}

const buildParams = (params) => {
  if (!params) return ''
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) q.append(k, v)
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ====== Auth Service ======
export const authService = {
  login: wrap(
    (email, password) => api.post('/api/auth/login', { email, password }),
    mockAuth.login,
  ),
  register: wrap(
    (data) => api.post('/api/auth/register', data),
    mockAuth.register,
  ),
  getMe: wrap(
    () => api.get('/api/auth/me'),
    mockAuth.getMe,
  ),
  updateProfile: wrap(
    (data) => api.put('/api/auth/me', data),
    mockAuth.updateProfile,
  ),
  updatePassword: wrap(
    (data) => api.put('/api/auth/password', data),
    mockAuth.updatePassword,
  ),
}

// ====== Company Service ======
export const companyService = {
  getAll: wrap(
    (params) => api.get(`/api/companies${buildParams(params)}`),
    mockCompanies.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/companies/${id}`),
    mockCompanies.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/companies', data),
    mockCompanies.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/companies/${id}`, data),
    mockCompanies.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/companies/${id}`),
    mockCompanies.delete,
  ),
  getCompliance: wrap(
    (id) => api.get(`/api/companies/${id}/compliance`),
    mockCompanies.getCompliance,
  ),
  getDashboardStats: wrap(
    () => api.get('/api/companies/stats/dashboard'),
    mockCompanies.getDashboardStats,
  ),
  addLink: wrap(
    (id, data) => api.post(`/api/companies/${id}/links`, data),
    mockCompanies.addLink,
  ),
  updateLink: wrap(
    (id, linkId, data) => api.put(`/api/companies/${id}/links/${linkId}`, data),
    mockCompanies.updateLink,
  ),
  removeLink: wrap(
    (id, linkId) => api.delete(`/api/companies/${id}/links/${linkId}`),
    mockCompanies.removeLink,
  ),
  getShareholderEntries: wrap(
    (id) => api.get(`/api/companies/${id}/shareholder-entries`),
    mockCompanies.getShareholderEntries,
  ),
  getDirectorEntries: wrap(
    (id) => api.get(`/api/companies/${id}/director-entries`),
    mockCompanies.getDirectorEntries,
  ),
  getReverseLinks: wrap(
    (personnelId) => api.get(`/api/companies/reverse-links/${personnelId}`),
    mockCompanies.getReverseLinks,
  ),
}

// ====== Personnel Service ======
export const personnelService = {
  getAll: wrap(
    (params) => api.get(`/api/personnel${buildParams(params)}`),
    mockPersonnel.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/personnel/${id}`),
    mockPersonnel.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/personnel', data),
    mockPersonnel.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/personnel/${id}`, data),
    mockPersonnel.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/personnel/${id}`),
    mockPersonnel.delete,
  ),
  merge: wrap(
    (targetId, sourceId) => api.post(`/api/personnel/merge`, { targetId, sourceId }),
    mockPersonnel.merge,
  ),
}

// ====== Meeting Service ======
export const meetingService = {
  getAll: wrap(
    (params) => api.get(`/api/meetings${buildParams(params)}`),
    mockMeetings.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/meetings/${id}`),
    mockMeetings.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/meetings', data),
    mockMeetings.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/meetings/${id}`, data),
    mockMeetings.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/meetings/${id}`),
    mockMeetings.delete,
  ),
  addAttendee: wrap(
    (id, data) => api.post(`/api/meetings/${id}/attendees`, data),
    mockMeetings.addAttendee,
  ),
  removeAttendee: wrap(
    (id, aid) => api.delete(`/api/meetings/${id}/attendees/${aid}`),
    mockMeetings.removeAttendee,
  ),
  getByCompany: wrap(
    (companyId) => api.get(`/api/meetings${buildParams({ companyId })}`),
    mockMeetings.getByCompany,
  ),
  getByPersonnel: wrap(
    (personnelId) => api.get(`/api/meetings${buildParams({ personnelId })}`),
    mockMeetings.getByPersonnel,
  ),
  getNotice: wrap(
    (id) => api.get(`/api/meetings/${id}/notice`),
    mockMeetings.getNotice,
  ),
  getMinutes: wrap(
    (id) => api.get(`/api/meetings/${id}/minutes`),
    mockMeetings.getMinutes,
  ),
  signMinutes: wrap(
    (meetingId, data) => api.post(`/api/meetings/${meetingId}/sign`, data),
    mockMeetings.signMinutes,
  ),
}

// ====== Document Service ======
export const documentService = {
  getAll: wrap(
    (params) => api.get(`/api/documents${buildParams(params)}`),
    mockDocuments.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/documents/${id}`),
    mockDocuments.getOne,
  ),
  getByCompany: wrap(
    (companyId) => api.get(`/api/documents${buildParams({ companyId })}`),
    mockDocuments.getByCompany,
  ),
  getByPersonnel: wrap(
    (personnelId) => api.get(`/api/documents${buildParams({ personnelId })}`),
    mockDocuments.getByPersonnel,
  ),
  upload: wrap(
    (formData) => api.post('/api/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    mockDocuments.upload,
  ),
  delete: wrap(
    (id) => api.delete(`/api/documents/${id}`),
    mockDocuments.delete,
  ),
  getExpiring: wrap(
    () => api.get('/api/documents/expiring'),
    mockDocuments.getExpiring,
  ),
}

// ====== Task Service ======
export const taskService = {
  getAll: wrap(
    (params) => api.get(`/api/tasks${buildParams(params)}`),
    mockTasks.getAll,
  ),
  create: wrap(
    (data) => api.post('/api/tasks', data),
    mockTasks.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/tasks/${id}`, data),
    mockTasks.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/tasks/${id}`),
    mockTasks.delete,
  ),
}

// ====== Compliance Rule Service ======
export const complianceRuleService = {
  getAll: wrap(
    (params) => api.get(`/api/compliance-rules${buildParams(params)}`),
    mockComplianceRules.getAll,
  ),
}

// ====== Compliance Reminder Service ======
export const complianceReminderService = {
  getAll: wrap(
    (params) => api.get(`/api/compliance-reminders${buildParams(params)}`),
    mockComplianceReminders.getAll,
  ),
}

// ====== Template Service ======
export const templateService = {
  getAll: wrap(
    (params) => api.get(`/api/templates${buildParams(params)}`),
    mockTemplates.getAll,
  ),
}

// ====== Sign Task Service ======
export const signTaskService = {
  getAll: wrap(
    (params) => api.get(`/api/sign-tasks${buildParams(params)}`),
    mockSignTasks.getAll,
  ),
}
