import api from './api'

export const personnelService = {
  getAll: async (params = {}) => {
    const res = await api.get('/api/personnel', { params })
    return res.data
  },

  getOne: async (id) => {
    const res = await api.get(`/api/personnel/${id}`)
    return res.data.personnel
  },

  create: async (data) => {
    try {
      const res = await api.post('/api/personnel', data)
      return res.data
    } catch (err) {
      if (err.response?.status === 409) {
        // Duplicate detected
        return { duplicateFound: true, duplicate: err.response.data.duplicate, error: err.response.data.message }
      }
      throw err
    }
  },

  update: async (id, data) => {
    const res = await api.put(`/api/personnel/${id}`, data)
    return res.data.personnel
  },

  delete: async (id) => {
    const res = await api.delete(`/api/personnel/${id}`)
    return res.data
  },

  // 任职记录
  addAppointment: async (id, data) => {
    const res = await api.post(`/api/personnel/${id}/appointments`, data)
    return res.data.personnel
  },

  updateAppointment: async (id, apptId, data) => {
    const res = await api.put(`/api/personnel/${id}/appointments/${apptId}`, data)
    return res.data.personnel
  },

  removeAppointment: async (id, apptId) => {
    const res = await api.delete(`/api/personnel/${id}/appointments/${apptId}`)
    return res.data.personnel
  },

  // 合并
  merge: async (targetId, sourceId) => {
    const res = await api.post('/api/personnel/merge', { targetId, sourceId })
    return res.data
  },

  // 检查重复
  checkDuplicate: async (name, nric, email) => {
    const res = await api.post('/api/personnel/check-duplicate', { name, nric, email })
    return res.data
  },

  // 获取所有重复组
  getDuplicates: async () => {
    const res = await api.get('/api/personnel/duplicates')
    return res.data
  },

  // 获取任职记录
  getAppointments: async (id) => {
    const res = await api.get(`/api/personnel/${id}/appointments`)
    return res.data
  },
}
