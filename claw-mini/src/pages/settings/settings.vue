<template>
  <view class="page">
    <view class="card">
      <text class="card-title">个人资料</text>

      <view class="avatar">{{ initial(user.name) }}</view>
      <text class="uname">{{ user.name || '—' }}</text>
      <text class="urole">{{ roleLabel(user.role) }}</text>

      <view class="field">
        <text class="label">姓名</text>
        <input v-if="editing" class="input" v-model="form.name" placeholder="姓名" />
        <text v-else class="value">{{ user.name || '—' }}</text>
      </view>
      <view class="field">
        <text class="label">邮箱</text>
        <text class="value muted">{{ user.email || '—' }}</text>
      </view>
      <view class="field">
        <text class="label">电话</text>
        <input v-if="editing" class="input" v-model="form.phone" placeholder="电话（可选）" />
        <text v-else class="value">{{ user.phone || '—' }}</text>
      </view>
      <view class="field">
        <text class="label">所属公司</text>
        <text class="value muted">{{ (user.company && user.company.name) || '—' }}</text>
      </view>

      <button v-if="!editing" class="btn primary" @tap="startEdit">编辑资料</button>
      <view v-else class="btn-row">
        <button class="btn ghost" @tap="cancelEdit">取消</button>
        <button class="btn primary" :loading="saving" @tap="saveProfile">保存</button>
      </view>
    </view>

    <view class="card">
      <text class="card-title">修改密码</text>
      <view class="field">
        <text class="label">当前密码</text>
        <input class="input" v-model="pw.current" password placeholder="当前密码" />
      </view>
      <view class="field">
        <text class="label">新密码</text>
        <input class="input" v-model="pw.next" password placeholder="至少 6 位" />
      </view>
      <view class="field">
        <text class="label">确认新密码</text>
        <input class="input" v-model="pw.confirm" password placeholder="再次输入" />
      </view>
      <button class="btn primary" :loading="pwSaving" @tap="changePw">更新密码</button>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { getUser, setUser } from '../../utils/auth.js'

const ROLE = { admin: '管理员', secretary: '秘书', manager: '经理', viewer: '浏览者', auditor: '审计员' }

export default {
  data() {
    return {
      user: {},
      editing: false,
      saving: false,
      form: { name: '', phone: '' },
      pw: { current: '', next: '', confirm: '' },
      pwSaving: false,
    }
  },
  onShow() { this.load() },
  methods: {
    roleLabel(r) { return ROLE[r] || r || '—' },
    initial(name) { return (name || '?').trim().charAt(0).toUpperCase() },
    async load() {
      try {
        const b = await request('/api/auth/me')
        this.user = (b && b.user) || b || {}
        const local = getUser() || {}
        if (this.user.name) setUser({ ...local, name: this.user.name, role: this.user.role })
      } catch (e) {}
    },
    startEdit() {
      this.form.name = this.user.name || ''
      this.form.phone = this.user.phone || ''
      this.editing = true
    },
    cancelEdit() { this.editing = false },
    async saveProfile() {
      if (!this.form.name) { uni.showToast({ title: '姓名不能为空', icon: 'none' }); return }
      this.saving = true
      try {
        const b = await request('/api/auth/me', { method: 'PUT', data: { name: this.form.name, phone: this.form.phone } })
        this.user = (b && b.user) || this.user
        const local = getUser() || {}
        setUser({ ...local, name: this.user.name })
        this.editing = false
        uni.showToast({ title: '已保存', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
    },
    async changePw() {
      if (!this.pw.current || !this.pw.next) { uni.showToast({ title: '请填写当前与新密码', icon: 'none' }); return }
      if (this.pw.next.length < 6) { uni.showToast({ title: '新密码至少 6 位', icon: 'none' }); return }
      if (this.pw.next !== this.pw.confirm) { uni.showToast({ title: '两次新密码不一致', icon: 'none' }); return }
      this.pwSaving = true
      try {
        const b = await request('/api/auth/change-password', { method: 'POST', data: { currentPassword: this.pw.current, newPassword: this.pw.next } })
        uni.showToast({ title: (b && b.message) || '密码已更新', icon: 'success' })
        this.pw = { current: '', next: '', confirm: '' }
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '修改失败', icon: 'none' })
      } finally {
        this.pwSaving = false
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; background: #f5f7fa; min-height: 100vh; box-sizing: border-box; }
.card { background: #fff; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); display: flex; flex-direction: column; align-items: center; }
.card-title { align-self: flex-start; font-size: 30rpx; font-weight: 700; color: #0f172a; margin-bottom: 24rpx; }
.avatar { width: 110rpx; height: 110rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 44rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.uname { font-size: 32rpx; font-weight: 700; color: #0f172a; margin-top: 16rpx; }
.urole { font-size: 22rpx; color: #2563eb; background: #eff6ff; border-radius: 20rpx; padding: 4rpx 18rpx; margin-top: 10rpx; }
.field { width: 100%; margin-top: 22rpx; }
.label { display: block; font-size: 24rpx; color: #64748b; margin-bottom: 10rpx; }
.value { display: block; font-size: 28rpx; color: #0f172a; min-height: 40rpx; }
.value.muted { color: #64748b; }
.input { width: 100%; box-sizing: border-box; height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.btn { width: 100% !important; box-sizing: border-box; height: 88rpx; line-height: 88rpx; border-radius: 16rpx; font-size: 28rpx; border: none; text-align: center; margin-top: 28rpx; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #475569; border: 1rpx solid #cbd5e1; }
.btn::after { border: none; }
.btn-row { display: flex; gap: 20rpx; width: 100%; margin-top: 28rpx; }
.btn-row .btn { flex: 1; margin-top: 0; }
</style>
