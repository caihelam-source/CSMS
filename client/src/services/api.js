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
    //    浏览器读不到被 CORS 拦截的 503 响应头。Render 冷启动典型 30-60 秒，
    //    自动重试覆盖整个唤醒窗口：默认 6 次 × 8 秒 ≈ 48 秒，期间成功即吞掉错误。
    //    全部重试耗尽才标记 isColdStart 抛给 UI 兜底卡。
    if (!err.response && err.code === 'ERR_NETWORK') {
      const maxRetries = cfg.__maxRetries ?? 6
      const retryDelay = cfg.__retryDelay ?? 8000
      cfg.__retryCount = (cfg.__retryCount || 0) + 1
      if (cfg.__retryCount <= maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay))
        try {
          return await api(cfg)
        } catch (e2) {
          // 递归调用会再次进 interceptor；__retryCount 通过 cfg 持久化继续累加。
          // 若 e2 仍为 ERR_NETWORK 会继续重试；其他错误会走 401/5xx 分支。
          return Promise.reject(e2)
        }
      }
      // 全部重试耗尽：标记冷启动并给出友好提示
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
