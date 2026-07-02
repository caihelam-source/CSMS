import api from './api'

export const complianceRuleService = {
  getAll: async (params = {}) => {
    const res = await api.get('/compliance-rules', { params })
    return res.data.rules || []
  },

  getOne: async (id) => {
    const res = await api.get(`/compliance-rules/${id}`)
    return res.data.rule
  },

  create: async (data) => {
    const res = await api.post('/compliance-rules', data)
    return res.data.rule
  },

  update: async (id, data) => {
    const res = await api.put(`/compliance-rules/${id}`, data)
    return res.data.rule
  },

  delete: async (id) => {
    const res = await api.delete(`/compliance-rules/${id}`)
    return res.data
  },

  // 初始化预设规则
  initPresets: async () => {
    const res = await api.post('/compliance-rules/init-presets')
    return res.data
  },

  // 为某公司生成提醒
  generateReminders: async (ruleId, data) => {
    const res = await api.post(`/compliance-rules/${ruleId}/generate-reminders`, data)
    return res.data
  },
}
