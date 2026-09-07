import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import BrandLogo from '../components/BrandLogo'
import {
  Eye, EyeOff, ShieldCheck, Users, Workflow, Bell,
  ArrowRight, Loader2, AlertCircle,
} from 'lucide-react'

// 登录页 · 左右分屏 B2B（claw-login-templates ② 主推，最贴合 CSMS）
// 设计纪律：单主题锁（亮 / 暗各一套）、单 accent（品牌蓝）、单圆角体系、0 em-dash
// 三态：focus 高亮环 / error 红边框+内联提示 / loading spinner+禁用
const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('请输入账号与密码')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message || '登录失败，请检查账号与密码后重试')
    } finally {
      setLoading(false)
    }
  }

  const fieldErr = Boolean(error)

  return (
    <div className="login-split">
      {/* 左栏 · 品牌展示（navy 锚点 + 品牌蓝，权威感来源） */}
      <aside className="login-brand" aria-hidden="true">
        <div className="login-brand__deco login-brand__deco--a" />
        <div className="login-brand__deco login-brand__deco--b" />

        <div className="login-brand__logo">
          <BrandLogo variant="reversed" size="lg" />
        </div>

        <div className="login-brand__pitch">
          <div className="login-brand__eyebrow">Company Secretarial Suite</div>
          <h1>香港公司秘书与合规，一站式掌控</h1>
          <ul>
            <li>
              <span className="tick"><ShieldCheck size={14} /></span>
              <span>NAR1 / BR 周年申报自动排程，到期前主动提醒</span>
            </li>
            <li>
              <span className="tick"><Users size={14} /></span>
              <span>多实体台账中枢，董事 / 股东 / 文件关联一目了然</span>
            </li>
            <li>
              <span className="tick"><Workflow size={14} /></span>
              <span>合规规则引擎驱动提醒、任务、文档闭环</span>
            </li>
          </ul>
        </div>

        <div className="login-brand__foot">
          <Bell size={13} className="login-brand__foot-ico" />
          © 2026 Claw CSMS · 面向企业秘书与合规团队
        </div>
      </aside>

      {/* 右栏 · 表单 */}
      <main className="login-form-pane">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          {/* 移动端紧凑品牌头（≤860px 显示，替代隐藏的左栏） */}
          <div className="login-card__brand">
            <BrandLogo variant="full" size="md" />
            <p>井然有序，合規無憂</p>
          </div>

          <h2 className="login-card__title">欢迎回来</h2>
          <p className="login-card__sub">登录以管理你的公司秘书与合规工作台</p>

          {error && (
            <div className="login-alert" role="alert">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="login-email">账号 / 邮箱</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`input-field login-input ${fieldErr ? 'has-error' : ''}`}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="login-pw">密码</label>
            <div className="pw-wrap">
              <input
                id="login-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input-field login-input pr-12 ${fieldErr ? 'has-error' : ''}`}
              />
              <button
                type="button"
                className="pw-toggle tap-target"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '隐藏密码' : '显示密码'}
                aria-pressed={showPw}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="login-row">
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>记住我</span>
            </label>
            <Link to="/forgot" className="login-link">忘记密码？</Link>
          </div>

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                登录中…
              </>
            ) : (
              <>
                登录
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="login-divider"><span>或使用企业身份</span></div>
          <button
            type="button"
            className="btn-secondary login-sso"
            onClick={() => navigate('/sso')}
          >
            企业 SSO 登录
          </button>

          <p className="login-foot">
            还没有账号？<Link to="/register" className="login-link">申请开通</Link>
          </p>
        </form>
      </main>
    </div>
  )
}

export default Login
