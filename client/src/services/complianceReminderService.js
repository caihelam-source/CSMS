import api from './api'

export const complianceReminderService = {
  getAll: async (params = {}) => {
    const res = await api.get('/compliance-reminders', { params })
    return res.data.reminders || []
  },

  getOne: async (id) => {
    const res = await api.get(`/compliance-reminders/${id}`)
    return res.data.reminder
  },

  create: async (data) => {
    const res = await api.post('/compliance-reminders', data)
    return res.data.reminder
  },

  update: async (id, data) => {
    const res = await api.put(`/compliance-reminders/${id}`, data)
    return res.data.reminder
  },

  delete: async (id) => {
    const res = await api.delete(`/compliance-reminders/${id}`)
    return res.data
  },

  // 标记完成
  markComplete: async (id) => {
    const res = await api.patch(`/compliance-reminders/${id}/complete`)
    return res.data.reminder
  },

  // 统计摘要
  getStats: async () => {
    const res = await api.get('/compliance-reminders/stats/summary')
    return res.data.stats
  },
}
