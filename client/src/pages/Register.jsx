import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, UserCog } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

const Register = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#EFF4FF] to-[#F1F5F9] px-4">
      {/* 极淡印章水印（与登录页同系列） */}
      <div className="pointer-events-none absolute -right-10 -top-8 text-[#0F2A5E] opacity-[0.06]">
        <svg width="340" height="340" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" />
          <path d="M32 16 A16 16 0 1 0 32 48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M24 33 l6 6 l11 -13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* 说明卡（与登录页同系列：居中白卡 + 顶部 Logo） */}
      <div className="relative z-10 w-full max-w-[380px] bg-surface rounded-2xl shadow-3 border border-hairline p-7">
        <div className="flex items-center gap-3 justify-center mb-1">
          <BrandLogo variant="icon" size="lg" />
          <div className="text-left">
            <div className="text-2xl font-extrabold tracking-tight text-ink leading-none">CSMS</div>
            <div className="text-[11px] text-ink-3 mt-1">香港公司秘书管理系统 · Company Secretary Management System</div>
          </div>
        </div>

        <p className="text-center text-[13px] font-semibold text-ink-2 mb-6 mt-3">井然有序，合規無憂</p>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-info/10 text-primary-700 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">账号由管理员开通</h2>
            <p className="text-sm text-ink-2 mt-0.5">注册为邀请制，不开放公开自助注册</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-ink-2">
          <div className="flex gap-3 items-start">
            <UserCog size={18} className="text-primary-600 mt-0.5 shrink-0" />
            <p>
              如需使用 CSMS，请让系统管理员在
              <span className="font-medium text-ink">「系统管理 → 用户管理」</span>
              中为您创建账号，并分配相应角色与可访问的公司数据范围。
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <ArrowLeft size={18} className="text-primary-600 mt-0.5 shrink-0" />
            <p>如您已拥有账号，请直接返回登录页使用邮箱与密码登录。</p>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg hover:bg-primary-700 focus:ring-4 focus:ring-primary-100 transition-all font-medium text-sm"
          >
            返回登录 Back to Login
          </button>
          <Link
            to="/login"
            className="text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            已有账号？点此登录
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
