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
  { label: 'Admin', email: 'admin@example.com', password: 'admin123', color: 'bg-info/10 text-primary-700 hover:bg-info/20' },
  { label: 'Secretary', email: 'demo@example.com', password: 'demo123', color: 'bg-success/10 text-success hover:bg-success/20' },
]

// 生产环境（VITE_USE_MOCK !== 'true'）不再展示 demo 快捷登录与注册入口
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
      toast.success('Welcome back!')
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandLogo variant="full" size="lg" className="mx-auto mb-3" />
          <p className="text-ink-2 mt-1 text-sm">井然有序，合規無憂</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-sm border border-hairline p-8">
          <h2 className="text-xl font-semibold text-ink mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-5 p-3.5 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2.5 text-danger">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Email Address" required error={errors.email}>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(er => ({ ...er, email: '' })) }}
                  autoComplete="email"
                  className={`${inputClass} pl-10`}
                  placeholder="you@example.com"
                />
              </div>
            </FormField>

            <FormField label="Password" required error={errors.password}>
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
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-ink-3 mt-5">
            本系统账号由管理员统一开通，如尚未拥有账号请联系您的管理员。
          </p>

          {/* Demo accounts — 仅 demo 模式展示 */}
          {DEMO_MODE && (
            <div className="mt-6 pt-5 border-t border-hairline">
              <p className="text-xs text-ink-3 mb-3 flex items-center gap-1.5">
                <Zap size={13} />
                Quick demo — click to fill credentials:
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
                Click a role above, then Sign In
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
