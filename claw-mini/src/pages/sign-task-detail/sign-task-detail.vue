<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="title">{{ s.title }}</text>
        <text class="status" :class="statusClass(s.status)">{{ signTaskStatusLabel(s.status) }}</text>
      </view>

      <view class="edit-bar">
        <view class="edit-btn" @tap="edit">编辑</view>
      </view>

      <view class="facts">
        <view class="fact"><text class="k">关联文档</text><text class="v">{{ docName }}</text></view>
        <view class="fact"><text class="k">公司</text><text class="v">{{ companyName }}</text></view>
        <view class="fact"><text class="k">创建人</text><text class="v">{{ creator }}</text></view>
        <view class="fact" v-if="s.completedAt"><text class="k">完成时间</text><text class="v">{{ fmtDateTime(s.completedAt) }}</text></view>
      </view>

      <view class="desc">
        <text class="desc-label">签署人 ({{ signers.length }})</text>
        <view v-for="sg in signers" :key="sg._id" class="signer">
          <text class="signer-name">{{ (sg.signer && sg.signer.name) || '未指定' }}</text>
          <text class="signer-status" :class="sg.status === 'signed' ? 'done' : 'pending'">
            {{ sg.status === 'signed' ? '已签署' : '待签署' }}
          </text>
        </view>
        <view v-if="!signers.length" class="note-empty">暂无签署人</view>
      </view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDateTime, signTaskStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return { id: '', s: {}, loading: true, docName: '—', companyName: '—', creator: '—', signers: [] }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  onPullDownRefresh() { this.load(true) },
  methods: {
    fmtDateTime, signTaskStatusLabel,
    async load(pull) {
      try {
        const body = await request('/api/sign-tasks/' + this.id)
        this.s = body.task || body || {}
        this.docName = (this.s.document && this.s.document.title) || '—'
        this.companyName = (this.s.company && this.s.company.name) || '—'
        this.creator = (this.s.createdBy && this.s.createdBy.name) || '—'
        this.signers = this.s.signers || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    statusClass(s) { return { completed: 's-success', in_progress: 's-warn', cancelled: 's-muted' }[s] || 's-normal' },
    edit() { uni.navigateTo({ url: '/pages/sign-task-form/sign-task-form?id=' + this.id }) },
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
.s-warn { color: #b45309; background: #fffbeb; }
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
.signer { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.signer:last-child { border-bottom: none; }
.signer-name { font-size: 28rpx; color: #0f172a; }
.signer-status { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.signer-status.done { color: #059669; background: #ecfdf5; }
.signer-status.pending { color: #b45309; background: #fffbeb; }
.note-empty { font-size: 24rpx; color: #94a3b8; text-align: center; padding: 20rpx 0; }
</style>
