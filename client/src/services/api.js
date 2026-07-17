import axios from 'axios'

// 生产环境：VITE_API_BASE 指向真实后端（如 https://claw-api.onrender.com）
// 开发/演示：留空，使用同源 /api 代理
const API_BASE = import.meta.env.VITE_API_BASE || ''

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Don't force redirect in demo mode — mock data won't have real tokens
      const token = localStorage.getItem('token')
      if (token && token.startsWith('demo-')) {
        return Promise.reject(err)
      }
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // 应用使用 HashRouter，整页跳 /login 在无 SPA fallback 的静态托管下会 404→白屏。
      // 只切 hash 让 HashRouter 接管，避免整页刷新与潜在白屏。
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
