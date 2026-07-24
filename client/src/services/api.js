import axios from 'axios'

// 生产环境：VITE_API_BASE 指向真实后端（如 https://claw-api.onrender.com）
// 开发/演示：留空，使用同源 /api 代理
const API_BASE = import.meta.env.VITE_API_BASE || ''

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 免费套餐冷启动可能 30-60s，给足超时避免误判失败
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 网络错误 / 超时：给出可操作提示，而非笼统「登录失败」
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      err.message = '请求超时。若使用免费套餐，后端可能正在冷启动（约 30-60 秒），请稍后重试。'
    } else if (!err.response && err.code === 'ERR_NETWORK') {
      err.message = '无法连接服务器，请确认后端 claw-api 已启动且 VITE_API_BASE 配置正确。'
    }

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
