<template>
  <view class="page">
    <view class="tabs">
      <view v-for="t in tabs" :key="t.key" class="tab" :class="{ active: active === t.key }" @tap="switchTab(t.key)">
        {{ t.label }}<text v-if="counts[t.key]" class="cnt">{{ counts[t.key] }}</text>
      </view>
    </view>

    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">暂无任务</text></view>

    <view v-else>
      <view v-for="t in list" :key="t._id" class="card" @tap="goDetail(t._id)">
        <view class="card-top">
          <text class="title">{{ t.title }}</text>
          <text class="status" :class="statusClass(t.status)">{{ taskStatusLabel(t.status) }}</text>
        </view>
        <text class="company" v-if="t.company && t.company.name">{{ t.company.name }}</text>
        <view class="card-bottom">
          <text class="type">{{ taskTypeLabel(t.type) }}</text>
          <text class="due" :class="{ od: isOverdue(t.dueDate) && t.status !== 'completed' }">截止 {{ fmtDate(t.dueDate) }}</text>
        </view>
      </view>
      <view class="foot"><text>共 {{ list.length }} 项</text></view>
    </view>
    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, isOverdue, taskStatusLabel, taskTypeLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      loading: true, list: [], active: 'open',
      tabs: [
        { key: 'open', label: '待办' },
        { key: 'completed', label: '已完成' },
        { key: 'all', label: '全部' },
      ],
      counts: {},
    }
  },
  onShow() { this.loadAll() },
  onPullDownRefresh() { this.loadAll(true) },
  methods: {
    fmtDate, isOverdue, taskStatusLabel, taskTypeLabel,
    async loadAll(pull) {
      this.loading = true
      try {
        const [open, completed, all] = await Promise.all([
          request('/api/tasks?status=pending'),
          request('/api/tasks?status=completed'),
          request('/api/tasks'),
        ])
        this.counts = {
          open: (open.tasks || []).length,
          completed: (completed.tasks || []).length,
          all: (all.tasks || []).length,
        }
        const o = open.tasks || [], c = completed.tasks || [], a = all.tasks || []
        if (this.active === 'open') this.list = o
        else if (this.active === 'completed') this.list = c
        else this.list = a
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    switchTab(key) { this.active = key; this.loadAll() },
    statusClass(s) { return { completed: 's-success', overdue: 's-danger', in_progress: 's-warn' }[s] || 's-normal' },
    goDetail(id) { uni.navigateTo({ url: '/pages/task-detail/task-detail?id=' + id }) },
    goCreate() { uni.navigateTo({ url: '/pages/task-form/task-form' }) },
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
.card { background: #fff; border-radius: 20rpx; padding: 26rpx 28rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 30rpx; font-weight: 600; color: #0f172a; flex: 1; margin-right: 16rpx; }
.status { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; white-space: nowrap; }
.s-success { color: #059669; background: #ecfdf5; }
.s-danger { color: #dc2626; background: #fef2f2; }
.s-warn { color: #b45309; background: #fffbeb; }
.s-normal { color: #2563eb; background: #eff6ff; }
.company { display: block; font-size: 24rpx; color: #64748b; margin-top: 6rpx; }
.card-bottom { margin-top: 14rpx; display: flex; align-items: center; }
.type { font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 12rpx; border-radius: 8rpx; margin-right: 14rpx; }
.due { font-size: 22rpx; color: #64748b; }
.due.od { color: #dc2626; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab {
  position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx;
  border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; line-height: 96rpx;
  text-align: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.4); z-index: 50;
}
</style>
