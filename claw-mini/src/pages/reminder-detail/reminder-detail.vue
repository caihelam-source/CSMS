<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="title">{{ r.title }}</text>
        <view class="prio-row">
          <text class="prio" :class="prioClass(r.priority)">{{ priorityLabel(r.priority) }}</text>
          <text class="status" :class="statusClass(r.status)">{{ reminderStatusLabel(r.status) }}</text>
        </view>
      </view>

      <view class="edit-bar">
        <view class="edit-btn" @tap="edit">编辑</view>
      </view>

      <view class="facts">
        <view class="fact" v-if="r.company"><text class="k">公司</text><text class="v">{{ companyName }}</text></view>
        <view class="fact"><text class="k">规则</text><text class="v">{{ ruleName }}</text></view>
        <view class="fact"><text class="k">截止日期</text><text class="v" :class="{ od: isOverdue(r.dueDate) && r.status !== '已完成' }">{{ fmtDate(r.dueDate) }}</text></view>
        <view class="fact" v-if="r.category"><text class="k">类别</text><text class="v">{{ r.category }}</text></view>
        <view class="fact" v-if="r.completedAt"><text class="k">完成时间</text><text class="v">{{ fmtDateTime(r.completedAt) }}</text></view>
      </view>

      <view v-if="r.description" class="desc">
        <text class="desc-label">说明</text>
        <text class="desc-text">{{ r.description }}</text>
      </view>

      <view v-if="r.notes" class="desc">
        <text class="desc-label">备注</text>
        <text class="desc-text">{{ r.notes }}</text>
      </view>

      <button v-if="r.status !== '已完成'" class="complete" :disabled="doing" @tap="complete">{{ doing ? '提交中…' : '标记为已完成' }}</button>
      <view v-else class="done-banner"><text>✓ 已完成</text></view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, fmtDateTime, isOverdue, priorityLabel, reminderStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', r: {}, loading: true, doing: false,
      companyName: '—', ruleName: '—',
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  onPullDownRefresh() { this.load(true) },
  methods: {
    edit() { uni.navigateTo({ url: '/pages/reminder-form/reminder-form?id=' + this.id }) },
    fmtDate, fmtDateTime, isOverdue, priorityLabel, reminderStatusLabel,
    async load(pull) {
      try {
        const body = await request('/api/compliance-reminders/' + this.id)
        this.r = body.reminder || body || {}
        this.companyName = (this.r.company && this.r.company.name) || '—'
        this.ruleName = (this.r.rule && this.r.rule.ruleName) || this.r.ruleId || '—'
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    prioClass(p) { return { 紧急: 'p-danger', 高: 'p-warn', 中: 'p-normal', 低: 'p-muted' }[p] || 'p-normal' },
    statusClass(s) { return { 已完成: 's-success', 已过期: 's-danger', 已忽略: 's-muted' }[s] || 's-warn' },
    async complete() {
      this.doing = true
      try {
        await request('/api/compliance-reminders/' + this.id + '/complete', { method: 'POST', data: {} })
        uni.showToast({ title: '已标记完成', icon: 'success' })
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '操作失败', icon: 'none' })
      } finally {
        this.doing = false
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.hero { background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.title { font-size: 34rpx; font-weight: 700; color: #0f172a; display: block; }
.prio-row { margin-top: 16rpx; display: flex; }
.prio { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; margin-right: 12rpx; }
.p-danger { color: #dc2626; background: #fef2f2; }
.p-warn { color: #b45309; background: #fffbeb; }
.p-normal { color: #2563eb; background: #eff6ff; }
.p-muted { color: #64748b; background: #f1f5f9; }
.status { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.s-success { color: #059669; background: #ecfdf5; }
.s-danger { color: #dc2626; background: #fef2f2; }
.s-warn { color: #b45309; background: #fffbeb; }
.s-muted { color: #64748b; background: #f1f5f9; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.v.od { color: #dc2626; }
.desc { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 16rpx; }
.desc-label { display: block; font-size: 22rpx; color: #94a3b8; margin-bottom: 8rpx; }
.desc-text { font-size: 26rpx; color: #334155; line-height: 1.6; }
.complete { width: 100%; height: 92rpx; line-height: 92rpx; background: #059669; color: #fff; font-size: 30rpx; border-radius: 16rpx; border: none; margin-top: 12rpx; }
.complete::after { border: none; }
.complete[disabled] { opacity: 0.6; }
.done-banner { text-align: center; color: #059669; font-size: 30rpx; font-weight: 600; background: #ecfdf5; border-radius: 16rpx; padding: 28rpx; margin-top: 12rpx; }
.edit-bar { display: flex; justify-content: flex-end; padding: 0 4rpx 16rpx; }
.edit-btn { font-size: 26rpx; color: #2563EB; background: #eff6ff; padding: 10rpx 28rpx; border-radius: 999rpx; }
</style>
