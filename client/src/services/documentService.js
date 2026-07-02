import api from './api'

export const documentService = {
  getAll: async (params = {}) => {
    const res = await api.get('/documents', { params })
    return res.data.documents || []
  },

  getOne: async (id) => {
    const res = await api.get(`/documents/${id}`)
    return res.data.document
  },

  create: async (data) => {
    const res = await api.post('/documents', data)
    return res.data.document
  },

  update: async (id, data) => {
    const res = await api.put(`/documents/${id}`, data)
    return res.data.document
  },

  delete: async (id) => {
    const res = await api.delete(`/documents/${id}`)
    return res.data
  },

  // 文件上传
  upload: async (formData) => {
    const res = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.document
  },

  // 文件下载
  download: async (id) => {
    const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
    return res.data
  },
}
