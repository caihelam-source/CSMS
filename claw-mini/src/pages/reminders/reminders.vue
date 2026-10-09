<template>
  <view class="page">
    <view class="tabs">
      <view v-for="t in tabs" :key="t.key" class="tab" :class="{ active: active === t.key }" @tap="switchTab(t.key)">
        {{ t.label }}<text v-if="counts[t.key]" class="cnt">{{ counts[t.key] }}</text>
      </view>
    </view>

    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">暂无提醒</text></view>

    <view v-else>
      <view v-for="r in list" :key="r._id" class="card" @tap="goDetail(r._id)">
        <view class="left" :class="barClass(r)"></view>
        <view class="body">
          <view class="card-top">
            <text class="title">{{ r.title }}</text>
            <text class="prio" :class="prioClass(r.priority)">{{ priorityLabel(r.priority) }}</text>
          </view>
          <text class="company" v-if="r.company && r.company.name">{{ r.company.name }}</text>
          <view class="card-bottom">
            <text class="due" :class="{ od: isOverdue(r.dueDate) && r.status !== '已完成' }">
              截止 {{ fmtDate(r.dueDate) }}
            </text>
            <text class="status" :class="statusClass(r.status)">{{ reminderStatusLabel(r.status) }}</text>
          </view>
        </view>
      </view>
      <view class="foot"><text>共 {{ list.length }} 项</text></view>
    </view>
    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, isOverdue, priorityLabel, reminderStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      loading: true, list: [], active: 'open',
      tabs: [
        { key: 'open', label: '待办' },
        { key: 'overdue', label: '已逾期' },
        { key: 'all', label: '全部' },
      ],
      counts: {},
    }
  },
  onShow() { this.loadAll() },
  onPullDownRefresh() { this.loadAll(true) },
  methods: {
    fmtDate, isOverdue, priorityLabel, reminderStatusLabel,
    async loadAll(pull) {
      this.loading = true
      try {
        const [open, overdue, all] = await Promise.all([
          request('/api/compliance-reminders?status=待办'),
          request('/api/compliance-reminders?overdue=true'),
          request('/api/compliance-reminders'),
        ])
        this.counts = {
          open: (open.reminders || []).length,
          overdue: (overdue.reminders || []).length,
          all: (all.reminders || []).length,
        }
        this.applyActive(open, overdue, all)
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    applyActive(open, overdue, all) {
      if (this.active === 'open') this.list = open.reminders || []
      else if (this.active === 'overdue') this.list = overdue.reminders || []
      else this.list = all.reminders || []
    },
    switchTab(key) {
      this.active = key
      this.loadAll()
    },
    barClass(r) {
      if (r.status === '已完成') return 'bar-success'
      if (isOverdue(r.dueDate)) return 'bar-danger'
      if (r.priority === '紧急' || r.priority === '高') return 'bar-warn'
      return 'bar-normal'
    },
    prioClass(p) { return { 紧急: 'p-danger', 高: 'p-warn', 中: 'p-normal', 低: 'p-muted' }[p] || 'p-normal' },
    statusClass(s) { return { 已完成: 's-success', 已过期: 's-danger', 已忽略: 's-muted' }[s] || 's-warn' },
    goDetail(id) { uni.navigateTo({ url: '/pages/reminder-detail/reminder-detail?id=' + id }) },
    goCreate() { uni.navigateTo({ url: '/pages/reminder-form/reminder-form' }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.tabs { display: flex; margin-bottom: 18rpx; }
.tab { flex: 1; text-align: center; font-size: 28rpx; color: #64748b; padding: 16rpx 0; border-bottom: 4rpx solid transparent; }
.tab.active { color: #2563eb; font-weight: 600; border-bottom-color: #2563eb; }
.cnt { font-size: 20rpx; color: #94a3b8; margin-left: 6rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.empty { font-size: 30rpx; color: #94a3b8; }
.card { display: flex; background: #fff; border-radius: 20rpx; margin-bottom: 16rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.left { width: 10rpx; }
.bar-success { background: #059669; }
.bar-danger { background: #dc2626; }
.bar-warn { background: #f59e0b; }
.bar-normal { background: #94a3b8; }
.body { flex: 1; padding: 24rpx 28rpx; }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 30rpx; font-weight: 600; color: #0f172a; flex: 1; margin-right: 16rpx; }
.prio { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; white-space: nowrap; }
.p-danger { color: #dc2626; background: #fef2f2; }
.p-warn { color: #b45309; background: #fffbeb; }
.p-normal { color: #2563eb; background: #eff6ff; }
.p-muted { color: #64748b; background: #f1f5f9; }
.company { display: block; font-size: 24rpx; color: #64748b; margin-top: 6rpx; }
.card-bottom { margin-top: 14rpx; display: flex; align-items: center; }
.due { font-size: 22rpx; color: #64748b; margin-right: 16rpx; }
.due.od { color: #dc2626; }
.status { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.s-success { color: #059669; background: #ecfdf5; }
.s-danger { color: #dc2626; background: #fef2f2; }
.s-warn { color: #b45309; background: #fffbeb; }
.s-muted { color: #64748b; background: #f1f5f9; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab {
  position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx;
  border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; line-height: 96rpx;
  text-align: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.4); z-index: 50;
}
</style>
