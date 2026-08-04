import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import toast from 'react-hot-toast'
import { User, Lock, Bell, SunMoon, Check } from 'lucide-react'
import { PageHeader, FormField, inputClass, TabNav, Toggle } from '../components/UIHelpers'
import { validate, required, email as emailValidator, minLength } from '../utils/validators'

const PROFILE_RULES = {
  name: [required('姓名为必填')],
  email: [required('邮箱为必填'), emailValidator('邮箱格式不正确')],
}

const PASSWORD_RULES = {
  currentPassword: [required('请输入当前密码')],
  newPassword: [required('请输入新密码'), minLength(6, '密码至少6位')],
  confirmPassword: [required('请确认新密码')],
}

const NOTIF_KEY = 'claw-notifications'
const loadNotif = () => {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {} } catch { return {} }
}

export default function Settings() {
  const { user, updateProfile, updatePassword } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('profile')
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [notif, setNotif] = useState(() => ({ email: true, task: true, ...loadNotif() }))

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    const { valid, errors } = validate(profileForm, PROFILE_RULES)
    if (!valid) { setProfileErrors(errors); return }
    setProfileErrors({})
    setLoading(true)
    try {
      await updateProfile(profileForm)
      toast.success('个人资料已更新')
    } catch (err) {
      toast.error(err.response?.data?.message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    const { valid, errors } = validate(passwordForm, PASSWORD_RULES)
    if (!valid) { setPasswordErrors(errors); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors({ confirmPassword: '两次输入的密码不一致' })
      return
    }
    setPasswordErrors({})
    setLoading(true)
    try {
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success('密码已更新')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || '密码更新失败')
    } finally {
      setLoading(false)
    }
  }

  const setNotifKey = (key, value) => {
    const next = { ...notif, [key]: value }
    setNotif(next)
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)) } catch { /* localStorage 不可用时静默 */ }
  }

  const tabs = [
    { id: 'profile', label: t('settingsProfile'), icon: User },
    { id: 'password', label: t('settingsPassword'), icon: Lock },
    { id: 'appearance', label: t('settingsAppearance'), icon: SunMoon },
    { id: 'notifications', label: t('settingsNotifications'), icon: Bell },
  ]

  const themeOptions = [
    { id: 'light', label: t('themeLight') },
    { id: 'dark', label: t('themeDark') },
    { id: 'system', label: t('themeSystem') },
  ]

  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings')} subtitle={t('settingsSubtitle')} icon={User} />

      {/* 账户信息卡 */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink truncate">{user?.name || user?.email}</p>
          <p className="text-sm text-ink-2 truncate">{user?.email}</p>
        </div>
        <span className="ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-600/10 dark:text-primary-400">
          {user?.role === 'admin' ? '管理员' : '用户'}
        </span>
      </div>

      {/* 设置分组 */}
      <div className="card p-0 overflow-hidden">
        <TabNav
          tabs={tabs.map(tab => ({ key: tab.id, label: tab.label, icon: tab.icon }))}
          active={activeTab}
          onChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="max-w-lg">
              <p className="text-sm text-ink-2 mb-4">更新你的基本账户信息，修改后点击保存即可生效。</p>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <FormField label={t('profileName')} required error={profileErrors.name}>
                  <input type="text" className={inputClass}
                    value={profileForm.name}
                    onChange={(e) => { setProfileForm({ ...profileForm, name: e.target.value }); setProfileErrors(pe => ({ ...pe, name: '' })) }} />
                </FormField>
                <FormField label={t('profileEmail')} required error={profileErrors.email}>
                  <input type="email" className={inputClass}
                    value={profileForm.email}
                    onChange={(e) => { setProfileForm({ ...profileForm, email: e.target.value }); setProfileErrors(pe => ({ ...pe, email: '' })) }} />
                </FormField>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? t('saving') : t('saveChanges')}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="max-w-lg">
              <p className="text-sm text-ink-2 mb-4">{t('pwdHint')}</p>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <FormField label={t('currentPwd')} required error={passwordErrors.currentPassword}>
                  <input type="password" className={inputClass}
                    value={passwordForm.currentPassword}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, currentPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, currentPassword: '' })) }} />
                </FormField>
                <FormField label={t('newPwd')} required error={passwordErrors.newPassword}>
                  <input type="password" className={inputClass}
                    value={passwordForm.newPassword}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, newPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, newPassword: '' })) }}
                    minLength={6} />
                </FormField>
                <FormField label={t('confirmPwd')} required error={passwordErrors.confirmPassword}>
                  <input type="password" className={inputClass}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, confirmPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, confirmPassword: '' })) }} />
                </FormField>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? t('updating') : t('updatePwd')}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-lg">
              <p className="text-sm text-ink-2 mb-4">{t('appearanceDesc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themeOptions.map((opt) => {
                  const active = theme === opt.id
                  return (
                    <button key={opt.id} type="button" onClick={() => setTheme(opt.id)} aria-pressed={active}
                      className={`relative rounded-xl border px-4 py-3 text-sm font-medium text-left transition-colors ${
                        active
                          ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-600/10 dark:text-primary-400'
                          : 'border-hairline bg-surface text-ink-2 hover:bg-canvas'
                      }`}>
                      <span className="flex items-center justify-between">
                        {opt.label}
                        {active && <Check size={16} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <div className="divide-y divide-hairline">
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{t('notifEmailTitle')}</p>
                    <p className="text-sm text-ink-2">{t('notifEmailDesc')}</p>
                  </div>
                  <Toggle checked={notif.email} onChange={(v) => setNotifKey('email', v)} label={t('notifEmailTitle')} />
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{t('notifTaskTitle')}</p>
                    <p className="text-sm text-ink-2">{t('notifTaskDesc')}</p>
                  </div>
                  <Toggle checked={notif.task} onChange={(v) => setNotifKey('task', v)} label={t('notifTaskTitle')} />
                </div>
              </div>
              <p className="text-xs text-ink-3 pt-2">{t('notifNote')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
