import api from './api'

export const signTaskService = {
  getAll: async (params = {}) => {
    const res = await api.get('/sign-tasks', { params })
    return res.data.signTasks || []
  },

  getOne: async (id) => {
    const res = await api.get(`/sign-tasks/${id}`)
    return res.data.signTask
  },

  create: async (data) => {
    const res = await api.post('/sign-tasks', data)
    return res.data.signTask
  },

  update: async (id, data) => {
    const res = await api.put(`/sign-tasks/${id}`, data)
    return res.data.signTask
  },

  delete: async (id) => {
    const res = await api.delete(`/sign-tasks/${id}`)
    return res.data
  },

  // 签署人操作
  addSigner: async (id, data) => {
    const res = await api.post(`/sign-tasks/${id}/signers`, data)
    return res.data.signTask
  },

  removeSigner: async (id, signerId) => {
    const res = await api.delete(`/sign-tasks/${id}/signers/${signerId}`)
    return res.data.signTask
  },

  // 完成签署
  completeSigning: async (id, signerId) => {
    const res = await api.patch(`/sign-tasks/${id}/signers/${signerId}/sign`)
    return res.data.signTask
  },
}
