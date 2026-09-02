import api from './api.js'
import { normalize } from '../utils/responseNormalize.js'
import { isMockMode } from '../utils/mockMode.js'
import {
  auth as mockAuth,
  users as mockUsers,
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
  audit as mockAudit,
  schedules as mockSchedules,
  calendar as mockCalendar,
} from './mock.js'

// 生产环境通过 VITE_USE_MOCK=false 注入真实 API 模式
// 开发/演示默认 Mock 模式（无需后端即可体验 UI）
// 另外支持运行时强制 mock：demo 账号登录时写入 localStorage，避免
// 直接调用 api 的组件（预览/下载/CTC）撞真实后端 401。
let fallbackMock = false
const useMock = () => isMockMode() || fallbackMock

// ====== wrap — unifies API and mock ======
// Mock 返回 { data: { data: X } }；真实后端返回 { success, entity } 或 { success, count, list }。
// 统一归一化为前端期望的 { data: { data: X } } 形状，消除 Mock/真实差异。
// normalize 逻辑见 ../utils/responseNormalize.js（已抽为可测纯函数）。

// 生产环境（VITE_USE_MOCK=false）必须走真实后端，任何失败都直接抛出，
// 禁止静默回退 mock。否则用户会突然看到假数据，导致预览/下载等功能失效。
const PRODUCTION_REAL_MODE = import.meta.env.VITE_USE_MOCK === 'false'

const wrap = (apiFn, mockFn) => async (...args) => {
  if (useMock()) return mockFn(...args)
  try {
    const res = await apiFn(...args)
    return normalize(res.data)
  } catch (err) {
    if (PRODUCTION_REAL_MODE) {
      // 生产环境：失败直接抛出，让用户看到真实错误，便于排查。
      console.error('[services] real API failed (production):', err?.message || err)
      throw err
    }
    // 开发/演示：静默回退 mock，保证 UI 可体验。
    console.error('[services] real API failed, falling back to mock:', err?.message || err)
    fallbackMock = true
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

// ====== Auth payload 展平（Wave 0 — 修复 live 权限失效）======
// 真实后端登录/me 返回 { success, token, user } / { success, user }，
// 而 mock 返回扁平的 { id, name, email, role, token }。
// 统一展平为前端期望的用户对象，确保 isAdmin/canEdit 在真实登录后正确生效。
const extractUser = (payload) => {
  if (payload && payload.user) {
    const u = payload.user
    return {
      ...u,
      id: u.id || (u._id && (u._id.toString ? u._id.toString() : u._id)),
      token: payload.token || undefined,
    }
  }
  return payload
}

// 直接打真实 API 的鉴权端点（不走 wrap，便于在失败时空格回退 mock）
const apiAuth = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/me', data),
}

// ====== Auth Service ======
export const authService = {
  login: async (email, password) => {
    if (useMock()) return mockAuth.login(email, password)
    const res = await apiAuth.login(email, password)
    return { data: { data: extractUser(res.data) } }
  },
  register: async (data) => {
    if (useMock()) return mockAuth.register(data)
    const res = await apiAuth.register(data)
    return { data: { data: extractUser(res.data) } }
  },
  getMe: async () => {
    if (useMock()) return mockAuth.getMe()
    const res = await apiAuth.getMe()
    return { data: { data: extractUser(res.data) } }
  },
  updateProfile: async (data) => {
    if (useMock()) return mockAuth.updateProfile(data)
    const res = await apiAuth.updateProfile(data)
    return { data: { data: extractUser(res.data) } }
  },
  updatePassword: wrap(
    (data) => api.put('/api/auth/password', data),
    mockAuth.updatePassword,
  ),
}

// ====== User Management Service (Admin) ======
export const userService = {
  getAll: wrap(
    () => api.get('/api/users'),
    mockUsers.getAll,
  ),
  create: wrap(
    (data) => api.post('/api/users', data),
    mockUsers.create,
  ),
  update: wrap(
    (id, data) => api.put(`/api/users/${id}`, data),
    mockUsers.update,
  ),
  remove: wrap(
    (id) => api.delete(`/api/users/${id}`),
    mockUsers.remove,
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
  // v6.x 公司去重 / 合并闭环
  duplicates: wrap(
    (params) => api.get(`/api/companies/duplicates${buildParams(params || {})}`),
    mockCompanies.duplicates,
  ),
  merge: wrap(
    (sourceId, payload) => api.post(`/api/companies/${sourceId}/merge`, payload),
    mockCompanies.merge,
  ),
  updateFormerNames: wrap(
    (id, op, payload) => api.put(`/api/companies/${id}/former-names`, { op, ...payload }),
    mockCompanies.updateFormerNames,
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
  // v6.x 签署闭环：替换文档物理文件（普通签署完成时就地替换源文档）
  replaceFile: wrap(
    (id, formData) => api.put(`/api/documents/${id}/file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    mockDocuments.replaceFile,
  ),
  delete: wrap(
    (id) => api.delete(`/api/documents/${id}`),
    mockDocuments.delete,
  ),
  // Phase B 导出：ZIP 包（真实后端从存储拉文件打包；mock 返回 null，前端降级为逐个打开）
  exportZip: wrap(
    (qs) => api.get(`/api/documents/export-zip?${qs}`, { responseType: 'blob' }),
    async () => null,
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

// ====== Results Timetable Service（港股业绩公告排期）======
export const scheduleService = {
  generate: wrap(
    (payload) => api.post('/api/results-timetable/generate', payload),
    mockSchedules.generate,
  ),
  list: wrap(
    (params) => api.get(`/api/results-timetable/list${buildParams(params)}`),
    mockSchedules.list,
  ),
  getOne: wrap(
    (id) => api.get(`/api/results-timetable/${id}`),
    mockSchedules.getOne,
  ),
  // ─── 规则库管理（Admin Panel「业绩排期规则库」）───
  // 读取：所有登录用户可读；保存 / 导入：后端 adminAuth 门禁（403）
  getRules: wrap(
    () => api.get('/api/results-timetable/rules'),
    mockSchedules.getRules,
  ),
  saveRules: wrap(
    (lib) => api.put('/api/results-timetable/rules', lib),
    mockSchedules.saveRules,
  ),
  importRules: wrap(
    (formData) => api.post('/api/results-timetable/rules/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    mockSchedules.importRules,
  ),
  // 下载 Excel 走 blob（不归一化）；mock 模式提示切真实后端
  excelDownload: async (id) => {
    if (useMock()) return mockSchedules.excelDownload(id);
    const res = await api.get(`/api/results-timetable/${id}/excel`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = '1321_业绩排期.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  },
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
  diagnose: wrap(
    () => api.get('/api/compliance-rules/diagnose'),
    mockComplianceRules.diagnose,
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
  // 按公司+规则重建开放提醒（BR 续期 / NAR1 补录后刷新）；mock 下无副作用
  recompute: wrap(
    (data) => api.post('/api/compliance-reminders/recompute', data),
    () => Promise.resolve({ data: { success: true, data: { created: 0, skipped: 0, cleared: 0 } } }),
  ),
  // admin 一键兜底：对所有 HK 公司 ensure HK_AR_42 + HK_BR_RENEW（nonHongKongCompany=true 加 HK_NN3_AR）
  ensureAllHk: wrap(
    () => api.post('/api/compliance-reminders/ensure-all-hk'),
    () => Promise.resolve({ data: { success: true, data: { processed: 0, totalCompanies: 0, created: 0, skipped: 0, blocked: 0, errors: [] } } }),
  ),
  // 单公司 ensure 启用规则对应的提醒（幂等，只生成不删；NAR1 导入闭环 / 状态条「生成提醒」按钮）
  ensure: wrap(
    (data) => api.post('/api/compliance-reminders/ensure', data),
    () => Promise.resolve({ data: { success: true, data: { ensured: true, created: 0, skipped: 0, blocked: 0, reasons: [] } } }),
  ),
  triggerCheck: wrap(
    () => api.post('/api/compliance-reminders/trigger-check'),
    mockComplianceReminders.triggerCheck,
  ),
  // v6.x 合规闭环第二跳：提醒 → 任务
  createTask: wrap(
    (id, payload) => api.post(`/api/compliance-reminders/${id}/create-task`, payload || {}),
    mockComplianceReminders.createTask,
  ),
  createTasksBatch: wrap(
    (payload) => api.post('/api/compliance-reminders/create-tasks/batch', payload || {}),
    mockComplianceReminders.createTasksBatch,
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
  // ⭐ R-P1-6：另存副本（仅 admin）
  duplicate: wrap(
    (id, data) => api.post(`/api/templates/${id}/duplicate`, data || {}),
    mockTemplates.duplicate,
  ),
  // ⭐ B3 修复：/:id/render（返回 HTML 字符串）已整体删除。
  //    Q1 废弃 {{变量}} 字符串替换 + Q2 渲染移至前端 SchemaDocRenderer，
  //    后端只解析公司 / 系统变量的预填「值」，不再产出任何 HTML。
  resolve: wrap(
    (id, data) => api.post(`/api/templates/${id}/resolve`, data || {}),
    mockTemplates.resolve,
  ),
  // ⭐ B2 修复：由不存在的 /init-presets 改为后端真实路由 /initialize
  initPresets: wrap(
    () => api.post('/api/templates/initialize'),
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
    (q, limit) => api.get('/api/search', { params: { q, ...(limit ? { limit } : {}) } }),
    mockSearch.globalSearch,
  ),
}

// ====== Audit Log Service (Wave 0 rev2) ======
// 真实后端：GET /api/audit（仅 admin / auditor）；mock：mockAudit.getAll
export const auditService = {
  getAll: wrap(
    (params) => api.get('/api/audit', { params }),
    mockAudit.getAll,
  ),
}

// ====== Calendar Service（Wave 日历模块）======
// 真实后端：GET /api/calendar/events（聚合 6 类来源，scope 行级过滤）；
//          POST /api/calendar/digest（本月摘要邮件）。
// mock：mockCalendar.getEvents 自合成贴近当前月的样例事件。
// 列表经 toArray(res.data.data, 'events') 防御式提取（见 utils/responseNormalize.js）。
export const calendarService = {
  getEvents: wrap(
    (from, to, types) => api.get(`/api/calendar/events${buildParams({ from, to, types: types && types.join(',') })}`),
    (from, to, types) => mockCalendar.getEvents(from, to, types),
  ),
  // 自建事件 CRUD（第 7 源）——真实走 POST/PUT/DELETE /api/calendar/events，mock 走内存数组
  createEvent: wrap(
    (payload) => api.post('/api/calendar/events', payload),
    (payload) => mockCalendar.createEvent(payload),
  ),
  updateEvent: wrap(
    (id, payload) => api.put(`/api/calendar/events/${id}`, payload),
    (id, payload) => mockCalendar.updateEvent(id, payload),
  ),
  deleteEvent: wrap(
    (id) => api.delete(`/api/calendar/events/${id}`),
    (id) => mockCalendar.deleteEvent(id),
  ),
  sendDigest: wrap(
    () => api.post('/api/calendar/digest'),
    async () => ({ skipped: true, count: 0 }),
  ),
}

// ====== NAR1 Import Service（周年申报表批量导入）======
// 该模块只在真实后端存在（依赖服务端 Python 解析引擎），无 mock 实现 —— 直连 api 取原始响应，
// 不走 wrap/normalize：响应是复合结构 { success, count, results }，normalize 会整包返回对象，
// 直接取 res.data 更清晰，也避免再踩 normalize 的实体键陷阱。
export const nar1ImportService = {
  /** 解析引擎可用性探测 */
  capability: async () => (await api.get('/api/nar1-import/capability')).data,
  /**
   * 批量解析 PDF（不落库）
   * @param {File[]} files
   * @param {(pct:number)=>void} [onUploadProgress]
   */
  parse: async (files, onUploadProgress) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f, f.name))
    const res = await api.post('/api/nar1-import/parse', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 批量识别较慢（每份约 3-8s），给足超时
      onUploadProgress: onUploadProgress
        ? (e) => onUploadProgress(e.total ? Math.round((e.loaded * 100) / e.total) : 0)
        : undefined,
    })
    return res.data
  },
  /**
   * 按模式落库
   * @param {Array<{id:string, fileName?:string, mode:'skip'|'create'|'overwrite', result:object, storage?:object}>} items
   */
  commit: async (items) => {
    const res = await api.post('/api/nar1-import/commit', { items }, { timeout: 300000 })
    return res.data
  },
}
