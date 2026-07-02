import api from './api'

export const companyService = {
  getAll: async (params = {}) => {
    const res = await api.get('/companies', { params })
    return res.data.companies || []
  },

  getOne: async (id) => {
    const res = await api.get(`/companies/${id}`)
    return res.data.company
  },

  create: async (data) => {
    const res = await api.post('/companies', data)
    return res.data.company
  },

  update: async (id, data) => {
    const res = await api.put(`/companies/${id}`, data)
    return res.data.company
  },

  delete: async (id) => {
    const res = await api.delete(`/companies/${id}`)
    return res.data
  },

  // Excel 导入
  importExcel: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post('/companies/import/excel', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // 下载 Excel 模板
  downloadTemplate: async () => {
    const res = await api.get('/companies/template/excel', { responseType: 'blob' })
    return res.data
  },

  // 获取公司的董事
  getDirectors: async (id) => {
    const res = await api.get(`/companies/${id}/directors`)
    return res.data.directors || []
  },

  // ===== 股东条目 (Shareholder Entries) =====
  getShareholderEntries: async (companyId) => {
    const res = await api.get(`/companies/${companyId}/shareholder-entries`)
    return res.data.shareholderEntries || []
  },

  createShareholderEntry: async (companyId, data) => {
    const res = await api.post(`/companies/${companyId}/shareholder-entries`, data)
    return res.data.shareholderEntry
  },

  updateShareholderEntry: async (companyId, entryId, data) => {
    const res = await api.put(`/companies/${companyId}/shareholder-entries/${entryId}`, data)
    return res.data.shareholderEntry
  },

  deleteShareholderEntry: async (companyId, entryId) => {
    const res = await api.delete(`/companies/${companyId}/shareholder-entries/${entryId}`)
    return res.data
  },

  // ===== 董事条目 (Director Entries) =====
  getDirectorEntries: async (companyId) => {
    const res = await api.get(`/companies/${companyId}/director-entries`)
    return res.data.directorEntries || []
  },

  createDirectorEntry: async (companyId, data) => {
    const res = await api.post(`/companies/${companyId}/director-entries`, data)
    return res.data.directorEntry
  },

  updateDirectorEntry: async (companyId, entryId, data) => {
    const res = await api.put(`/companies/${companyId}/director-entries/${entryId}`, data)
    return res.data.directorEntry
  },

  deleteDirectorEntry: async (companyId, entryId) => {
    const res = await api.delete(`/companies/${companyId}/director-entries/${entryId}`)
    return res.data
  },

  // ===== ROM/ROD PDF =====
  generateROM: async (companyId) => {
    const res = await api.get(`/companies/${companyId}/rom`, { responseType: 'blob' })
    return res.data
  },

  generateROD: async (companyId) => {
    const res = await api.get(`/companies/${companyId}/rod`, { responseType: 'blob' })
    return res.data
  },
}
