<template>
  <view class="page">
    <view class="top">
      <text class="title">用户管理</text>
      <button class="gen" @tap="genReminders">重新生成合规提醒</button>
    </view>

    <view v-if="denied" class="denied">
      <text class="denied-ico">🔒</text>
      <text class="denied-text">该页面仅限管理员访问</text>
    </view>

    <view v-else-if="loading" class="state">加载中…</view>

    <view v-else>
      <view v-for="u in users" :key="u._id" class="card">
        <view class="head">
          <view class="avatar">{{ initial(u.name) }}</view>
          <view class="info">
            <text class="name">{{ u.name }}</text>
            <text class="email">{{ u.email }}</text>
          </view>
          <text class="badge" :class="'r-' + u.role">{{ roleLabel(u.role) }}</text>
        </view>

        <view class="row">
          <text class="label">角色</text>
          <picker :range="roleOptions" range-key="label" @change="(e) => onRole(u, e)">
            <view class="picker">{{ roleLabel(u.role) }} ›</view>
          </picker>
        </view>

        <view class="row">
          <text class="label">账号状态</text>
          <switch :checked="u.isActive" color="#2563EB" @change="(e) => onActive(u, e)" />
        </view>

        <view class="actions">
          <button class="act danger" v-if="u._id !== meId" @tap="del(u)">删除</button>
          <text v-else class="self">当前账号</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { getUser } from '../../utils/auth.js'

const ROLE = { admin: '管理员', secretary: '秘书', manager: '经理', viewer: '浏览者', auditor: '审计员' }
const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'secretary', label: '秘书' },
  { value: 'manager', label: '经理' },
  { value: 'viewer', label: '浏览者' },
  { value: 'auditor', label: '审计员' },
]

export default {
  data() {
    return {
      users: [],
      loading: true,
      denied: false,
      meId: (getUser() && getUser().id) || '',
      roleOptions: ROLE_OPTIONS,
    }
  },
  onShow() { this.load() },
  methods: {
    roleLabel(r) { return ROLE[r] || r || '—' },
    initial(name) { return (name || '?').trim().charAt(0).toUpperCase() },
    async load() {
      this.loading = true
      this.denied = false
      try {
        const b = await request('/api/users')
        this.users = (b && b.data) || []
      } catch (e) {
        if (e && /401|403/.test(String(e.message))) this.denied = true
        else this.denied = true
        this.users = []
      } finally {
        this.loading = false
      }
    },
    async onRole(u, e) {
      const role = ROLE_OPTIONS[e.detail.value].value
      if (role === u.role) return
      try {
        await request('/api/users/' + u._id, { method: 'PUT', data: { role } })
        u.role = role
        uni.showToast({ title: '角色已更新', icon: 'success' })
      } catch (err) {
        uni.showToast({ title: (err && err.message) || '更新失败', icon: 'none' })
      }
    },
    async onActive(u, e) {
      const isActive = e.detail.value
      try {
        await request('/api/users/' + u._id, { method: 'PUT', data: { isActive } })
        u.isActive = isActive
      } catch (err) {
        uni.showToast({ title: (err && err.message) || '更新失败', icon: 'none' })
      }
    },
    del(u) {
      uni.showModal({
        title: '删除用户', content: '确认删除「' + u.name + '」？此操作不可撤销。', success: async (res) => {
          if (!res.confirm) return
          try {
            await request('/api/users/' + u._id, { method: 'DELETE' })
            this.users = this.users.filter((x) => x._id !== u._id)
            uni.showToast({ title: '已删除', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
          }
        },
      })
    },
    async genReminders() {
      uni.showModal({
        title: '重新生成', content: '将按年循环重新生成固定日期合规提醒（含去重），是否继续？', success: async (res) => {
          if (!res.confirm) return
          try {
            const b = await request('/api/admin/generate-reminders', { method: 'POST', data: {} })
            uni.showToast({ title: (b && b.message) || '已生成', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          }
        },
      })
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; background: #f5f7fa; min-height: 100vh; box-sizing: border-box; }
.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.title { font-size: 32rpx; font-weight: 700; color: #0f172a; }
.gen { background: #2563eb; color: #fff; font-size: 24rpx; border-radius: 14rpx; padding: 0 24rpx; height: 64rpx; line-height: 64rpx; }
.gen::after { border: none; }
.denied { margin-top: 120rpx; display: flex; flex-direction: column; align-items: center; }
.denied-ico { font-size: 80rpx; }
.denied-text { font-size: 28rpx; color: #94a3b8; margin-top: 20rpx; }
.state { margin-top: 80rpx; text-align: center; font-size: 26rpx; color: #94a3b8; }
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.head { display: flex; align-items: center; margin-bottom: 20rpx; }
.avatar { width: 76rpx; height: 76rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 32rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; }
.info { flex: 1; display: flex; flex-direction: column; }
.name { font-size: 30rpx; font-weight: 700; color: #0f172a; }
.email { font-size: 22rpx; color: #94a3b8; margin-top: 4rpx; }
.badge { font-size: 22rpx; border-radius: 20rpx; padding: 4rpx 16rpx; background: #f1f5f9; color: #475569; }
.badge.r-admin { background: #fef2f2; color: #dc2626; }
.badge.r-secretary { background: #eff6ff; color: #2563eb; }
.badge.r-manager { background: #ecfdf5; color: #059669; }
.badge.r-auditor { background: #fff7ed; color: #ea580c; }
.row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; border-top: 1rpx solid #f1f5f9; }
.label { font-size: 26rpx; color: #475569; }
.picker { font-size: 26rpx; color: #2563eb; }
.actions { display: flex; justify-content: flex-end; margin-top: 10rpx; }
.act { background: #fef2f2; color: #dc2626; font-size: 24rpx; border-radius: 12rpx; padding: 0 28rpx; height: 60rpx; line-height: 60rpx; }
.act::after { border: none; }
.self { font-size: 22rpx; color: #94a3b8; }
</style>
