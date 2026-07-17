import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import toast from 'react-hot-toast'
import { User, Lock, Bell } from 'lucide-react'
import { PageHeader, FormField, inputClass, TabNav } from '../components/UIHelpers'
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

export default function Settings() {
  const { user, updateProfile, updatePassword } = useAuth()
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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account settings" icon={User} />

      <div className="card p-0 overflow-hidden">
        <TabNav
          tabs={tabs.map(t => ({ key: t.id, label: t.label, icon: t.icon }))}
          active={activeTab}
          onChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-lg">
              <FormField label="Name" required error={profileErrors.name}>
                <input
                  type="text"
                  className={inputClass}
                  value={profileForm.name}
                  onChange={(e) => { setProfileForm({ ...profileForm, name: e.target.value }); setProfileErrors(pe => ({ ...pe, name: '' })) }}
                />
              </FormField>
              <FormField label="Email" required error={profileErrors.email}>
                <input
                  type="email"
                  className={inputClass}
                  value={profileForm.email}
                  onChange={(e) => { setProfileForm({ ...profileForm, email: e.target.value }); setProfileErrors(pe => ({ ...pe, email: '' })) }}
                />
              </FormField>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-lg">
              <FormField label="Current Password" required error={passwordErrors.currentPassword}>
                <input
                  type="password"
                  className={inputClass}
                  value={passwordForm.currentPassword}
                  onChange={(e) => { setPasswordForm({ ...passwordForm, currentPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, currentPassword: '' })) }}
                />
              </FormField>
              <FormField label="New Password" required error={passwordErrors.newPassword}>
                <input
                  type="password"
                  className={inputClass}
                  value={passwordForm.newPassword}
                  onChange={(e) => { setPasswordForm({ ...passwordForm, newPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, newPassword: '' })) }}
                  minLength={6}
                />
              </FormField>
              <FormField label="Confirm New Password" required error={passwordErrors.confirmPassword}>
                <input
                  type="password"
                  className={inputClass}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => { setPasswordForm({ ...passwordForm, confirmPassword: e.target.value }); setPasswordErrors(pe => ({ ...pe, confirmPassword: '' })) }}
                />
              </FormField>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-ink-2">Receive email alerts for compliance reminders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Task Reminders</p>
                  <p className="text-sm text-ink-2">Get notified of upcoming task deadlines</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
