<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="title">{{ m.title }}</text>
        <text class="status" :class="statusClass(m.status)">{{ meetingStatusLabel(m.status) }}</text>
      </view>

      <view class="edit-bar">
        <view class="edit-btn" @tap="edit">编辑</view>
      </view>

      <view class="facts">
        <view class="fact"><text class="k">类型</text><text class="v">{{ meetingTypeLabel(m.type) }}</text></view>
        <view class="fact"><text class="k">公司</text><text class="v">{{ companyName }}</text></view>
        <view class="fact"><text class="k">日期</text><text class="v">{{ fmtDate(m.scheduledAt) }}</text></view>
        <view class="fact"><text class="k">时间</text><text class="v">{{ timeOf(m.scheduledAt) }}</text></view>
        <view class="fact"><text class="k">地点</text><text class="v">{{ m.location || '—' }}</text></view>
        <view class="fact"><text class="k">创建人</text><text class="v">{{ creator }}</text></view>
      </view>

      <view v-if="m.agenda" class="desc">
        <text class="desc-label">议程</text>
        <text class="desc-text">{{ m.agenda }}</text>
      </view>

      <view v-if="attendees.length" class="desc">
        <text class="desc-label">出席人 ({{ attendees.length }})</text>
        <view class="att">
          <text v-for="a in attendees" :key="a._id" class="att-item">{{ a.name }}</text>
        </view>
      </view>

      <view v-if="documents.length" class="desc">
        <text class="desc-label">关联文档 ({{ documents.length }})</text>
        <view v-for="d in documents" :key="d._id" class="doc-row" @tap="goDoc(d._id)">
          <text class="doc-name">{{ d.name }}</text><text class="chev">›</text>
        </view>
      </view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, meetingTypeLabel, meetingStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', m: {}, loading: true,
      companyName: '—', creator: '—', attendees: [], documents: [],
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  onPullDownRefresh() { this.load(true) },
  methods: {
    fmtDate, meetingTypeLabel, meetingStatusLabel,
    async load(pull) {
      try {
        const body = await request('/api/meetings/' + this.id)
        this.m = body.meeting || body || {}
        this.companyName = (this.m.company && this.m.company.name) || '—'
        this.creator = (this.m.createdBy && this.m.createdBy.name) || '—'
        this.attendees = (this.m.attendees || []).map(a => a.ref).filter(Boolean)
        this.documents = this.m.documents || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    timeOf(d) {
      if (!d) return '—'
      const dt = new Date(d)
      if (isNaN(dt.getTime())) return '—'
      const hh = String(dt.getHours()).padStart(2, '0')
      const mm = String(dt.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    },
    statusClass(s) { return { completed: 's-success', cancelled: 's-muted', scheduled: 's-normal' }[s] || 's-normal' },
    edit() { uni.navigateTo({ url: '/pages/meeting-form/meeting-form?id=' + this.id }) },
    goDoc(id) { uni.navigateTo({ url: '/pages/document-detail/document-detail?id=' + id }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.hero { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.title { font-size: 32rpx; font-weight: 700; color: #0f172a; flex: 1; margin-right: 16rpx; }
.status { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; white-space: nowrap; }
.s-success { color: #059669; background: #ecfdf5; }
.s-muted { color: #64748b; background: #f1f5f9; }
.s-normal { color: #2563eb; background: #eff6ff; }
.edit-bar { display: flex; justify-content: flex-end; margin-bottom: 16rpx; }
.edit-btn { font-size: 26rpx; color: #2563eb; background: #eff6ff; padding: 10rpx 28rpx; border-radius: 999rpx; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.desc { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 16rpx; }
.desc-label { display: block; font-size: 22rpx; color: #94a3b8; margin-bottom: 10rpx; }
.desc-text { font-size: 26rpx; color: #334155; line-height: 1.6; white-space: pre-wrap; }
.att { display: flex; flex-wrap: wrap; }
.att-item { font-size: 24rpx; color: #334155; background: #f1f5f9; padding: 8rpx 18rpx; border-radius: 999rpx; margin: 0 10rpx 10rpx 0; }
.doc-row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.doc-row:last-child { border-bottom: none; }
.doc-name { font-size: 26rpx; color: #2563eb; }
.chev { color: #cbd5e1; font-size: 30rpx; }
</style>
