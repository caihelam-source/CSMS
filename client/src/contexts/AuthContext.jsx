import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/index.js'
import { setForceMock } from '../utils/mockMode.js'

const AuthContext = createContext(null)

// Demo auto-login user
const DEMO_USER = {
  id: 'u1',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'secretary',
  token: 'demo-token-xxx',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 显式 demo 模式：仅在 VITE_USE_MOCK==='true' 时自动以 demo 账号登录。
  // 生产环境（VITE_USE_MOCK==='false'）绝不自动 demo，必须走真实登录页。
  const DEMO_MODE = import.meta.env.VITE_USE_MOCK === 'true'

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        // 若本地已是 demo 账号，强制进入完整 mock 模式，避免直接 api 调用撞 401
        if (parsed.token && parsed.token.startsWith('demo-')) {
          setForceMock(true)
        }
        setLoading(false)
        return
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }

    // 显式 demo：直接登录 demo 账号（无需后端）
    if (DEMO_MODE) {
      localStorage.setItem('token', DEMO_USER.token)
      localStorage.setItem('user', JSON.stringify(DEMO_USER))
      setUser(DEMO_USER)
      setLoading(false)
      return
    }

    // 生产模式：不自动登录，显示登录页
    setLoading(false)
  }, [])

  // Known demo accounts (work without backend)
  const DEMO_ACCOUNTS = [
    { email: 'admin@example.com', password: 'admin123', name: 'Admin User', role: 'admin' },
    { email: 'demo@example.com', password: 'demo123', name: 'Demo Secretary', role: 'secretary' },
    { email: 'manager@example.com', password: 'manager123', name: 'Manager User', role: 'manager' },
    { email: 'viewer@example.com', password: 'viewer123', name: 'Viewer User', role: 'viewer' },
  ]

  const login = async (email, password) => {
    // Try real backend first
    try {
      const res = await authService.login(email, password)
      const userData = res.data?.data || res.data || res
      localStorage.setItem('token', userData.token || 'real-token')
      localStorage.setItem('user', JSON.stringify(userData))
      setForceMock(false)
      setUser(userData)
      return userData
    } catch {
      // Backend unavailable — check demo credentials
      const demo = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password)
      if (!demo) throw new Error('Invalid credentials. Use a demo account or start the backend.')
      const userData = {
        id: `demo-${demo.email}`,
        name: demo.name,
        email: demo.email,
        role: demo.role,
        token: 'demo-token-xxx',
      }
      localStorage.setItem('token', userData.token)
      localStorage.setItem('user', JSON.stringify(userData))
      setForceMock(true)
      setUser(userData)
      return userData
    }
  }

  const register = async (name, email, password, role) => {
    // Try real backend first
    try {
      const res = await authService.register({ name, email, password, role })
      const userData = res.data?.data || res.data || res
      localStorage.setItem('token', userData.token || 'real-token')
      localStorage.setItem('user', JSON.stringify(userData))
      setForceMock(false)
      setUser(userData)
      return userData
    } catch {
      // Backend unavailable — create local user
      const userData = {
        id: `demo-${Date.now()}`,
        name,
        email,
        role: role || 'secretary',
        token: 'demo-token-xxx',
      }
      localStorage.setItem('token', userData.token)
      localStorage.setItem('user', JSON.stringify(userData))
      setForceMock(true)
      setUser(userData)
      return userData
    }
  }

  const updateProfile = async (data) => {
    try {
      const res = await authService.updateProfile(data)
      const userData = res.data?.data || res.data || res
      const updated = { ...user, ...userData }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      return updated
    } catch {
      // Demo mode — update locally
      const updated = { ...user, ...data }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      return updated
    }
  }

  const updatePassword = async (data) => {
    try {
      await authService.updatePassword(data)
    } catch {
      // Demo mode — accept silently
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setForceMock(false)
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'
  const canEdit = isAdmin || user?.role === 'secretary'
  const canDelete = isAdmin
  const isDemo = !!user?.token?.startsWith('demo-')
  const isDemoMode = DEMO_MODE

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, updatePassword, isAdmin, canEdit, canDelete, isDemo, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
