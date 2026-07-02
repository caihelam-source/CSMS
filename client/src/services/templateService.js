import api from './api'

export const templateService = {
  getAll: async (params = {}) => {
    const res = await api.get('/templates', { params })
    return res.data.templates || []
  },

  getOne: async (id) => {
    const res = await api.get(`/templates/${id}`)
    return res.data.template
  },

  create: async (data) => {
    const res = await api.post('/templates', data)
    return res.data.template
  },

  update: async (id, data) => {
    const res = await api.put(`/templates/${id}`, data)
    return res.data.template
  },

  delete: async (id) => {
    const res = await api.delete(`/templates/${id}`)
    return res.data
  },

  // 渲染模板（预览）
  render: async (id, variables) => {
    const res = await api.post(`/templates/${id}/render`, { variables })
    return res.data
  },
}
