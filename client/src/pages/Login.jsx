import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Briefcase, Mail, Lock, AlertCircle, Zap, UserPlus, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { LoadingSpinner, FormField, inputClass } from '../components/UIHelpers'
import { validate, required, email as emailValidator } from '../utils/validators'

const LOGIN_RULES = {
  email: [required('请输入邮箱'), emailValidator('邮箱格式不正确')],
  password: [required('请输入密码')],
}

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@example.com', password: 'admin123', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { label: 'Secretary', email: 'demo@example.com', password: 'demo123', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
]

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate({ email, password }, LOGIN_RULES)
    if (!valid) { setErrors(vErrors); return }
    if (isRegister && password !== confirmPassword) {
      setErrors({ ...vErrors, confirmPassword: ['两次密码不一致'] })
      return
    }
    if (isRegister) {
      const { valid: regValid, errors: regErrs } = validate({ name: email.split('@')[0] }, { name: [required('姓名必填')] })
      if (!regValid) { setErrors(regErrs); return }
    }
    setErrors({})
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(email.split('@')[0], email, password, 'admin')
        toast.success('注册成功！请登录')
        setIsRegister(false)
      } else {
        await login(email, password)
        toast.success('Welcome back!')
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isRegister ? '注册失败' : '登录失败'))
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <Briefcase size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">CSMS</h1>
          <p className="text-gray-500 mt-1 text-sm">Company Secretary Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <FormField label="Full Name" required error={errors.name}>
                <div className="relative">
                  <Briefcase size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={email.split('@')[0]}
                    readOnly
                    className={`${inputClass} pl-10`}
                    placeholder="Your name"
                  />
                </div>
              </FormField>
            )}
            <FormField label="Email Address" required error={errors.email}>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
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
            <p className="text-xs text-gray-400 mt-2 text-center">
              Click a role above, then Sign In
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
