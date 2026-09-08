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
  async (err) => {
    const cfg = err.config || {}

    // 1) 超时：免费套餐冷启动常见，给温和提示
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      err.message = '请求超时。若使用免费套餐，后端可能正在冷启动（约 30-60 秒），请稍后重试。'
      return Promise.reject(err)
    }

    // 2) 网络错误 / CORS 被拒（err.response 为 undefined）：多为 Render 免费套餐休眠唤醒失败
    //    浏览器读不到被 CORS 拦截的 503 响应头，统一在此处理：自动重试一次，命中冷启动即活。
    if (!err.response && err.code === 'ERR_NETWORK') {
      if (!cfg.__retryCount) {
        cfg.__retryCount = 1
        const delay = cfg.__retryDelay || 6000
        await new Promise((r) => setTimeout(r, delay))
        try {
          return await api(cfg)
        } catch (e2) {
          err = e2 // 重试仍失败，继续向下统一提示
        }
      }
      // 统一文案（不再误判 VITE_API_BASE 配错——实测线上该变量已正确指向 claw-api-5zq7）
      err.isColdStart = true
      err.message =
        '后端暂时无法连接——很可能是 Render 免费套餐处于休眠冷启动（约 30-60 秒），请稍候重试；' +
        '若持续失败请确认 Atlas MONGODB_URI 有效、且后端已部署。'
      return Promise.reject(err)
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
