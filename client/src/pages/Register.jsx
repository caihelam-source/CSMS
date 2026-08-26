import { useNavigate, Link } from 'react-router-dom'
import { Briefcase, ShieldCheck, ArrowLeft, UserCog } from 'lucide-react'

// 注册模式：仅管理员后台开通（安全设计，公开自注册已关闭）。
// 此页不再调用被禁用的 /api/auth/register，改为清晰说明 + 返回登录，避免 403 误导。
const Register = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <Briefcase size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">CSMS</h1>
          <p className="text-ink-2 mt-1 text-sm">公司秘书管理系统</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-sm border border-hairline p-8">
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
              返回登录
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
    </div>
  )
}

export default Register
