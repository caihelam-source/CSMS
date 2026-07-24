// 运行时 mock 模式开关
// 用途：生产部署(VITE_USE_MOCK=false)时，用户用 demo 账号登录后，
// 强制整个应用走完整 mock，避免 service 层先撞真实后端 401、再静默回退，
// 而直接调 api 的组件（预览/下载/CTC 取字节）暴露 401 导致功能中断。

const BUILD_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const FORCE_MOCK_KEY = 'forceMock'

export function isMockMode() {
  if (typeof window === 'undefined') return BUILD_MOCK
  try {
    return localStorage.getItem(FORCE_MOCK_KEY) === 'true' || BUILD_MOCK
  } catch {
    return BUILD_MOCK
  }
}

export function setForceMock(value) {
  if (typeof window === 'undefined') return
  try {
    if (value) localStorage.setItem(FORCE_MOCK_KEY, 'true')
    else localStorage.removeItem(FORCE_MOCK_KEY)
  } catch {
    // ignore
  }
}
