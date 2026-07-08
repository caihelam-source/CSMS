import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Briefcase, Mail, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { LoadingSpinner, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { validate, required, email as emailValidator, minLength } from '../utils/validators'

const REGISTER_RULES = {
  name: [required('请输入姓名')],
  email: [required('请输入邮箱'), emailValidator('邮箱格式不正确')],
  password: [required('请输入密码'), minLength(6, '密码至少6位')],
}

const ROLES = [
  { value: 'secretary', label: 'Company Secretary' },
  { value: 'admin', label: 'Administrator' },
  { value: 'viewer', label: 'Viewer' },
]

const Register = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('secretary')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate({ name, email, password }, REGISTER_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    setError('')
    setLoading(true)
    try {
      await register(name, email, password, role)
      toast.success('Account created successfully!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Full Name" required error={errors.name}>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: '' })) }}
                  className={`${inputClass} pl-10`}
                  placeholder="John Doe"
                />
              </div>
            </FormField>

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
                  className={`${inputClass} pl-10`}
                  placeholder="At least 6 characters"
                />
              </div>
            </FormField>

            <div>
              <label className={labelClass}>Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className={inputClass}
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="xs" variant="inline" className="border-white/30 border-r-white" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
