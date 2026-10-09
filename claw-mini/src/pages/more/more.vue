<template>
  <view class="page">
    <view class="user">
      <view class="avatar">{{ initial(user.name) }}</view>
      <view class="uinfo">
        <text class="uname">{{ user.name || '用户' }}</text>
        <text class="uemail">{{ user.email || '' }}</text>
      </view>
    </view>

    <view class="grid">
      <view v-for="m in modules" :key="m.url" class="cell" @tap="go(m.url)">
        <view class="ic" :style="{ background: m.bg }"><text class="emoji">{{ m.icon }}</text></view>
        <text class="label">{{ m.label }}</text>
      </view>
    </view>

    <view class="logout" @tap="logout">退出登录</view>
  </view>
</template>

<script>
import { getUser, clearToken } from '../../utils/auth.js'

export default {
  data() {
    return {
      user: {},
      modules: [
        { label: '仪表盘', icon: '📊', bg: '#eff6ff', url: '/pages/dashboard/dashboard' },
        { label: '任务', icon: '✅', bg: '#ecfdf5', url: '/pages/tasks/tasks' },
        { label: '会议', icon: '📅', bg: '#fffbeb', url: '/pages/meetings/meetings' },
        { label: '合规规则', icon: '⚖️', bg: '#f5f3ff', url: '/pages/rules/rules' },
        { label: '签署任务', icon: '🖋️', bg: '#fef2f2', url: '/pages/sign-tasks/sign-tasks' },
        { label: '文书模板', icon: '📄', bg: '#f0fdfa', url: '/pages/templates/templates' },
        { label: '日历', icon: '🗓️', bg: '#fff7ed', url: '/pages/calendar/calendar' },
        { label: '数据缺口补全', icon: '🔧', bg: '#f1f5f9', url: '/pages/gaps/gaps' },
      ],
    }
  },
  onShow() { this.user = getUser() || {} },
  methods: {
    initial(name) { return (name || '?').trim().charAt(0).toUpperCase() },
    go(url) { uni.navigateTo({ url }) },
    logout() {
      uni.showModal({
        title: '退出登录', content: '确认退出当前账号？', success: (res) => {
          if (res.confirm) {
            clearToken()
            uni.reLaunch({ url: '/pages/login/login' })
          }
        },
      })
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; }
.user { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 36rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 22rpx; }
.uname { font-size: 32rpx; font-weight: 700; color: #0f172a; display: block; }
.uemail { font-size: 24rpx; color: #64748b; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18rpx; }
.cell { background: #fff; border-radius: 20rpx; padding: 28rpx 12rpx; display: flex; flex-direction: column; align-items: center; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.ic { width: 88rpx; height: 88rpx; border-radius: 22rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 14rpx; }
.emoji { font-size: 44rpx; }
.label { font-size: 24rpx; color: #334155; }
.logout { margin-top: 30rpx; text-align: center; color: #dc2626; font-size: 28rpx; background: #fff; border-radius: 16rpx; padding: 26rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
</style>
