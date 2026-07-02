import api from './api'

export const meetingService = {
  getAll: async (params = {}) => {
    const res = await api.get('/meetings', { params })
    return res.data.meetings || []
  },

  getOne: async (id) => {
    const res = await api.get(`/meetings/${id}`)
    return res.data.meeting
  },

  create: async (data) => {
    const res = await api.post('/meetings', data)
    return res.data.meeting
  },

  update: async (id, data) => {
    const res = await api.put(`/meetings/${id}`, data)
    return res.data.meeting
  },

  delete: async (id) => {
    const res = await api.delete(`/meetings/${id}`)
    return res.data
  },

  // 快速状态切换
  updateStatus: async (id, status) => {
    const res = await api.patch(`/meetings/${id}/status`, { status })
    return res.data.meeting
  },
}
