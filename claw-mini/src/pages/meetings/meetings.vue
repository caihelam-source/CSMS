<template>
  <view class="page">
    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">暂无会议</text></view>

    <view v-else>
      <view v-for="m in list" :key="m._id" class="card" @tap="goDetail(m._id)">
        <view class="card-top">
          <text class="title">{{ m.title }}</text>
          <text class="type">{{ meetingTypeLabel(m.type) }}</text>
        </view>
        <text class="company" v-if="m.company && m.company.name">{{ m.company.name }}</text>
        <view class="card-bottom">
          <text class="date">{{ fmtDate(m.scheduledAt) }}</text>
          <text class="status" :class="statusClass(m.status)">{{ meetingStatusLabel(m.status) }}</text>
        </view>
      </view>
      <view class="foot"><text>共 {{ list.length }} 场</text></view>
    </view>

    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, meetingTypeLabel, meetingStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return { loading: true, list: [] }
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    fmtDate, meetingTypeLabel, meetingStatusLabel,
    async load(pull) {
      this.loading = true
      try {
        const body = await request('/api/meetings')
        this.list = body.meetings || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    statusClass(s) { return { completed: 's-success', cancelled: 's-muted', scheduled: 's-normal' }[s] || 's-normal' },
    goDetail(id) { uni.navigateTo({ url: '/pages/meeting-detail/meeting-detail?id=' + id }) },
    goCreate() { uni.navigateTo({ url: '/pages/meeting-form/meeting-form' }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.empty { font-size: 30rpx; color: #94a3b8; }
.card { background: #fff; border-radius: 20rpx; padding: 26rpx 28rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 30rpx; font-weight: 600; color: #0f172a; flex: 1; margin-right: 16rpx; }
.type { font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 14rpx; border-radius: 999rpx; white-space: nowrap; }
.company { display: block; font-size: 24rpx; color: #64748b; margin-top: 6rpx; }
.card-bottom { margin-top: 14rpx; display: flex; align-items: center; justify-content: space-between; }
.date { font-size: 24rpx; color: #64748b; }
.status { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.s-success { color: #059669; background: #ecfdf5; }
.s-muted { color: #64748b; background: #f1f5f9; }
.s-normal { color: #2563eb; background: #eff6ff; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.35); z-index: 50; }
</style>
