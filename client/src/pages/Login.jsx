import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, AlertCircle, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { LoadingSpinner, FormField, inputClass } from '../components/UIHelpers'
import BrandLogo from '../components/BrandLogo'
import { validate, required, email as emailValidator } from '../utils/validators'

const LOGIN_RULES = {
  email: [required('请输入邮箱'), emailValidator('邮箱格式不正确')],
  password: [required('请输入密码')],
}

const DEMO_ACCOUNTS = [
  { label: '管理员', email: 'admin@example.com', password: 'admin123', color: 'bg-info/10 text-primary-700 hover:bg-info/20' },
  { label: '秘书', email: 'demo@example.com', password: 'demo123', color: 'bg-success/10 text-success hover:bg-success/20' },
]

const DEMO_MODE = import.meta.env.VITE_USE_MOCK === 'true'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate({ email, password }, LOGIN_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      toast.success('欢迎回来')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#EFF4FF] to-[#F1F5F9] px-4">
      {/* 极淡印章水印（对齐设计稿 A · 登录页） */}
      <div className="pointer-events-none absolute -right-10 -top-8 text-[#0F2A5E] opacity-[0.06]">
        <svg width="340" height="340" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" />
          <path d="M32 16 A16 16 0 1 0 32 48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M24 33 l6 6 l11 -13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* 登录卡（对齐设计稿：居中白卡 + 顶部 Logo + slogan） */}
      <div className="relative z-10 w-full max-w-[380px] bg-surface rounded-2xl shadow-lg border border-hairline p-7">
        <div className="flex items-center gap-3 justify-center mb-1">
          <BrandLogo variant="icon" size="lg" />
          <div className="text-left">
            <div className="text-2xl font-extrabold tracking-tight text-ink leading-none">CSMS</div>
            <div className="text-[11px] text-ink-3 mt-1">香港公司秘书管理系统 · Company Secretary Management System</div>
          </div>
        </div>

        <p className="text-center text-[13px] font-semibold text-ink-2 mb-6 mt-3">井然有序，合規無憂</p>

        {error && (
          <div className="mb-5 p-3.5 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2.5 text-danger">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="邮箱 Email" required error={errors.email}>
            <div className="relative">
              <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(er => ({ ...er, email: '' })) }}
                autoComplete="email"
                className={`${inputClass} pl-10`}
                placeholder="you@firm.com.hk"
              />
            </div>
          </FormField>

          <FormField label="密码 Password" required error={errors.password}>
            <div className="relative">
              <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(er => ({ ...er, password: '' })) }}
                autoComplete="current-password"
                className={`${inputClass} pl-10`}
                placeholder="••••••••"
              />
            </div>
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="xs" variant="inline" className="border-white/30 border-r-white" />
                登录中…
              </span>
            ) : '登录 Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-3 mt-5">
          本系统账号由管理员统一开通，如尚未拥有账号请联系您的管理员。
        </p>

        {DEMO_MODE && (
          <div className="mt-6 pt-5 border-t border-hairline">
            <p className="text-xs text-ink-3 mb-3 flex items-center gap-1.5">
              <Zap size={13} />
              快速演示 — 点击填入测试账号：
            </p>
            <div className="flex gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.label}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${acc.color}`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-3 mt-2 text-center">
              选择角色后点击登录
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
