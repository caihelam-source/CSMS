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
  search as mockSearch,
} from './mock.js'

// 生产环境通过 VITE_USE_MOCK=false 注入真实 API 模式
// 开发/演示默认 Mock 模式（无需后端即可体验 UI）
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
let useMock = USE_MOCK

// ====== wrap — unifies API and mock ======
// Mock 返回 { data: { data: X } }；真实后端返回 { success, entity } 或 { success, count, list }。
// 统一归一化为前端期望的 { data: { data: X } } 形状，消除 Mock/真实差异。
const normalize = (body) => {
  // 统一归一化为前端期望的 { data: { data: X } } 形状，消除 Mock/真实差异。
  // 1) 后端已双层嵌套 { data: { data: X } } —— 直接透传
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object' && 'data' in body.data) {
    return { data: body.data }
  }
  // 2) 后端单层嵌套 { success, data: X } —— 包成 { data: { data: X } }
  if (body && typeof body === 'object' && body.data !== undefined) {
    return { data: { data: body.data } }
  }
  // 3) 扁平响应 { success, personnel } / { success, companies } 等 —— 提取主负载
  const entityKeys = [
    'personnel', 'company', 'document', 'meeting', 'task', 'reminder', 'template', 'signTask',
    'companies', 'documents', 'meetings', 'tasks', 'reminders', 'personnelList', 'links', 'link',
  ]
  for (const k of entityKeys) {
    if (body && body[k] !== undefined) return { data: { data: body[k] } }
  }
  // 4) 兜底：整包作为 payload
  return { data: { data: body } }
}

const wrap = (apiFn, mockFn) => async (...args) => {
  if (useMock) return mockFn(...args)
  try {
    const res = await apiFn(...args)
    return normalize(res.data)
  } catch (err) {
    // 任何错误（网络 / HTTP 错误）静默回退 mock，保证演示不中断；
    // 但打日志，避免生产环境后端报错被完全吞掉、无从排查。
    console.error('[services] real API failed, falling back to mock:', err?.message || err)
    useMock = true
    return mockFn(...args)
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
  getByPersonnel: wrap(
    (id) => api.get(`/api/personnel/${id}/aggregate`),
    mockPersonnel.getByPersonnel,
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
  updateStatus: wrap(
    (id, data) => api.patch(`/api/meetings/${id}/status`, data),
    mockMeetings.updateStatus,
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
  create: wrap(
    (data) => api.post('/api/documents', data),
    mockDocuments.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/documents/${id}`, data),
    mockDocuments.update,
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
  getOne: wrap(
    (id) => api.get(`/api/tasks/${id}`),
    mockTasks.getOne,
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
  addNote: wrap(
    (id, data) => api.post(`/api/tasks/${id}/notes`, data),
    mockTasks.addNote,
  ),
  getExpiring: wrap(
    () => api.get('/api/tasks/expiring'),
    mockTasks.getExpiring,
  ),
  getByCompany: wrap(
    (companyId) => api.get(`/api/tasks${buildParams({ companyId })}`),
    mockTasks.getByCompany,
  ),
  getByPersonnel: wrap(
    (personnelId) => api.get(`/api/tasks${buildParams({ personnelId })}`),
    mockTasks.getByPersonnel,
  ),
}

// ====== Compliance Rule Service ======
export const complianceRuleService = {
  getAll: wrap(
    (params) => api.get(`/api/compliance-rules${buildParams(params)}`),
    mockComplianceRules.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/compliance-rules/${id}`),
    mockComplianceRules.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/compliance-rules', data),
    mockComplianceRules.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/compliance-rules/${id}`, data),
    mockComplianceRules.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/compliance-rules/${id}`),
    mockComplianceRules.delete,
  ),
  initPresets: wrap(
    () => api.post('/api/compliance-rules/initialize'),
    mockComplianceRules.initPresets,
  ),
  generateReminders: wrap(
    (ruleId, { companyIds } = {}) => api.post(`/api/compliance-rules/${ruleId}/generate`, { companyIds }),
    mockComplianceRules.generateReminders,
  ),
  applyRule: wrap(
    (id, companyIds) => api.post(`/api/compliance-rules/${id}/apply`, { companyIds }),
    mockComplianceRules.applyRule,
  ),
}

// ====== Compliance Reminder Service ======
export const complianceReminderService = {
  getAll: wrap(
    (params) => api.get(`/api/compliance-reminders${buildParams(params)}`),
    mockComplianceReminders.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/compliance-reminders/${id}`),
    mockComplianceReminders.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/compliance-reminders', data),
    mockComplianceReminders.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/compliance-reminders/${id}`, data),
    mockComplianceReminders.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/compliance-reminders/${id}`),
    mockComplianceReminders.delete,
  ),
  markCompleted: wrap(
    (id) => api.post(`/api/compliance-reminders/${id}/complete`),
    mockComplianceReminders.markCompleted,
  ),
  markOverdue: wrap(
    (id) => api.put(`/api/compliance-reminders/${id}/overdue`),
    mockComplianceReminders.markOverdue,
  ),
  getScheduled: wrap(
    (params) => api.get(`/api/compliance-reminders/scheduled${buildParams(params)}`),
    mockComplianceReminders.getScheduled,
  ),
  getExpired: wrap(
    (params) => api.get(`/api/compliance-reminders/expired${buildParams(params)}`),
    mockComplianceReminders.getExpired,
  ),
  getStatistics: wrap(
    () => api.get('/api/compliance-reminders/statistics'),
    mockComplianceReminders.getStatistics,
  ),
  triggerCheck: wrap(
    () => api.post('/api/compliance-reminders/trigger-check'),
    mockComplianceReminders.triggerCheck,
  ),
}

// ====== Template Service ======
export const templateService = {
  getAll: wrap(
    (params) => api.get(`/api/templates${buildParams(params)}`),
    mockTemplates.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/templates/${id}`),
    mockTemplates.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/templates', data),
    mockTemplates.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/templates/${id}`, data),
    mockTemplates.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/templates/${id}`),
    mockTemplates.delete,
  ),
  render: wrap(
    (id, variables) => api.post(`/api/templates/${id}/render`, { variables }),
    mockTemplates.render,
  ),
  initPresets: wrap(
    () => api.post('/api/templates/init-presets'),
    mockTemplates.initPresets,
  ),
}

// ====== Sign Task Service ======
export const signTaskService = {
  getAll: wrap(
    (params) => api.get(`/api/sign-tasks${buildParams(params)}`),
    mockSignTasks.getAll,
  ),
  getOne: wrap(
    (id) => api.get(`/api/sign-tasks/${id}`),
    mockSignTasks.getOne,
  ),
  create: wrap(
    (data) => api.post('/api/sign-tasks', data),
    mockSignTasks.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/sign-tasks/${id}`, data),
    mockSignTasks.update,
  ),
  delete: wrap(
    (id) => api.delete(`/api/sign-tasks/${id}`),
    mockSignTasks.delete,
  ),
  getSigners: wrap(
    (id) => api.get(`/api/sign-tasks/${id}/signers`),
    mockSignTasks.getSigners,
  ),
  sign: wrap(
    (id, signerId) => api.post(`/api/sign-tasks/${id}/${signerId}/sign`),
    mockSignTasks.sign,
  ),
  getStatistics: wrap(
    () => api.get('/api/sign-tasks/statistics'),
    mockSignTasks.getStatistics,
  ),
  getByMeeting: wrap(
    (meetingId) => api.get(`/api/sign-tasks${buildParams({ meetingId })}`),
    mockSignTasks.getByMeeting,
  ),
}

// ====== Global Search Service ======
// 跨实体结构化关联全局搜索：包装 /api/search（真实）与 mock.globalSearch（演示）。
// 真实后端返回 { data: { data: { results, counts, query } } }，与 mock 形状一致，normalize 直接透传。
export const searchService = {
  globalSearch: wrap(
    (q) => api.get('/api/search', { params: { q } }),
    mockSearch.globalSearch,
  ),
}
