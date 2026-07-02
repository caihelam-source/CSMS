import api from './api'

export const authService = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    return res.data
  },

  register: async (data) => {
    const res = await api.post('/auth/register', data)
    return res.data
  },

  getMe: async () => {
    const res = await api.get('/auth/me')
    return res.data.user
  },

  updateProfile: async (data) => {
    const res = await api.put('/auth/me', data)
    return res.data.user
  },

  changePassword: async (data) => {
    const res = await api.put('/auth/change-password', data)
    return res.data
  },
}
