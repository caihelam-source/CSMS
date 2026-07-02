import api from './api'

export const taskService = {
  getAll: async (params = {}) => {
    const res = await api.get('/tasks', { params })
    return res.data.tasks || []
  },

  getOne: async (id) => {
    const res = await api.get(`/tasks/${id}`)
    return res.data.task
  },

  create: async (data) => {
    const res = await api.post('/tasks', data)
    return res.data.task
  },

  update: async (id, data) => {
    const res = await api.put(`/tasks/${id}`, data)
    return res.data.task
  },

  delete: async (id) => {
    const res = await api.delete(`/tasks/${id}`)
    return res.data
  },

  // 快速完成
  markComplete: async (id) => {
    const res = await api.patch(`/tasks/${id}/complete`)
    return res.data.task
  },

  // 添加备注
  addNote: async (id, note) => {
    const res = await api.post(`/tasks/${id}/notes`, { note })
    return res.data.task
  },
}
