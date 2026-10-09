<template>
  <view class="page">
    <view class="hero">
      <text class="hi">📊 CSMS 概览</text>
      <text class="sub">{{ today }}</text>
    </view>

    <view v-if="loading" class="center"><text>加载中…</text></view>

    <block v-else>
      <view class="alert" v-if="stats.expiredReminders">
        <text class="alert-icon">⚠️</text>
        <text class="alert-text">{{ stats.expiredReminders }} 项合规提醒已逾期，请尽快处理</text>
      </view>

      <view class="grid">
        <view class="card blue" @tap="go('/pages/companies/companies')">
          <text class="num">{{ s.totalCompanies }}</text><text class="lbl">公司</text>
        </view>
        <view class="card green" @tap="go('/pages/personnel/personnel')">
          <text class="num">{{ s.totalPersonnel }}</text><text class="lbl">人员</text>
        </view>
        <view class="card purple" @tap="go('/pages/documents/documents')">
          <text class="num">{{ s.totalDocuments }}</text><text class="lbl">文档</text>
        </view>
        <view class="card amber" @tap="go('/pages/reminders/reminders')">
          <text class="num">{{ s.totalReminders }}</text><text class="lbl">合规提醒</text>
        </view>
        <view class="card red" @tap="go('/pages/reminders/reminders?tab=overdue')">
          <text class="num">{{ stats.expiredReminders }}</text><text class="lbl">已逾期</text>
        </view>
        <view class="card teal" @tap="go('/pages/tasks/tasks')">
          <text class="num">{{ s.pendingTasks }}</text><text class="lbl">待办任务</text>
        </view>
        <view class="card indigo" @tap="go('/pages/meetings/meetings')">
          <text class="num">{{ s.totalMeetings }}</text><text class="lbl">会议</text>
        </view>
        <view class="card pink" @tap="go('/pages/sign-tasks/sign-tasks')">
          <text class="num">{{ s.totalSignTasks }}</text><text class="lbl">签署任务</text>
        </view>
      </view>

      <view class="section-title">快捷入口</view>
      <view class="quick">
        <view class="q" @tap="go('/pages/calendar/calendar')"><text class="qi">🗓️</text><text class="ql">日历</text></view>
        <view class="q" @tap="go('/pages/rules/rules')"><text class="qi">⚖️</text><text class="ql">合规规则</text></view>
        <view class="q" @tap="go('/pages/templates/templates')"><text class="qi">📄</text><text class="ql">文书模板</text></view>
        <view class="q" @tap="go('/pages/gaps/gaps')"><text class="qi">🔧</text><text class="ql">数据缺口</text></view>
      </view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

export default {
  data() {
    return {
      loading: true,
      s: {}, stats: {},
      today: new Date().toLocaleDateString('zh-CN'),
    }
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    async load(pull) {
      this.loading = true
      try {
        const [dash, rem] = await Promise.all([
          request('/api/companies/stats/dashboard'),
          request('/api/compliance-reminders/stats/summary'),
        ])
        this.s = (dash.data || dash) || {}
        this.stats = (rem.stats || {}) || {}
        this.stats.expiredReminders = this.s.expiredReminders || 0
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    go(url) { uni.navigateTo({ url }) },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; }
.hero { background: linear-gradient(150deg, #0f2a5e 0%, #1d4ed8 100%); border-radius: 24rpx; padding: 36rpx; margin-bottom: 20rpx; }
.hi { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.sub { display: block; font-size: 24rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.alert { display: flex; align-items: center; background: #fef2f2; border-radius: 16rpx; padding: 20rpx 24rpx; margin-bottom: 20rpx; }
.alert-icon { font-size: 32rpx; margin-right: 14rpx; }
.alert-text { font-size: 26rpx; color: #dc2626; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16rpx; }
.card { border-radius: 20rpx; padding: 24rpx 10rpx; display: flex; flex-direction: column; align-items: center; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.num { font-size: 44rpx; font-weight: 800; line-height: 1.1; }
.lbl { font-size: 22rpx; margin-top: 6rpx; }
.card.blue { background: #eff6ff; color: #2563eb; }
.card.green { background: #ecfdf5; color: #059669; }
.card.purple { background: #f5f3ff; color: #7c3aed; }
.card.amber { background: #fffbeb; color: #b45309; }
.card.red { background: #fef2f2; color: #dc2626; }
.card.teal { background: #f0fdfa; color: #0d9488; }
.card.indigo { background: #e0e7ff; color: #4338ca; }
.card.pink { background: #fdf2f8; color: #db2777; }
.section-title { font-size: 28rpx; font-weight: 700; color: #0f172a; margin: 30rpx 8rpx 16rpx; }
.quick { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16rpx; }
.q { background: #fff; border-radius: 20rpx; padding: 26rpx 8rpx; display: flex; flex-direction: column; align-items: center; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.qi { font-size: 40rpx; }
.ql { font-size: 22rpx; color: #334155; margin-top: 8rpx; }
</style>
