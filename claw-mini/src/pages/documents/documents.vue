<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" v-model="kw" placeholder="搜索文档名 / 编号" placeholder-class="ph" @confirm="load" @input="onInput" />
      <text v-if="kw" class="clear" @tap="clearKw">✕</text>
    </view>

    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">没有匹配的文档</text></view>

    <view v-else>
      <view v-for="d in list" :key="d._id" class="card" @tap="goDetail(d._id)">
        <view class="card-top">
          <text class="name">{{ d.name }}</text>
          <text class="type">{{ docTypeLabel(d.type) }}</text>
        </view>
        <view class="meta">
          <text class="meta-item" v-if="d.company && d.company.name">{{ d.company.name }}</text>
          <text class="meta-item">{{ fmtDate(d.createdAt) }}</text>
          <text v-if="d.signStatus && d.signStatus !== 'draft'" class="meta-item sign">{{ signStatusLabel(d.signStatus) }}</text>
        </view>
        <text class="arrow">查看 ›</text>
      </view>
      <view class="foot"><text>共 {{ list.length }} 份</text></view>
    </view>

    <view class="fab" @tap="goUpload">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, docTypeLabel, signStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return { loading: true, list: [], kw: '', timer: null }
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    fmtDate, docTypeLabel, signStatusLabel,
    async load(pull) {
      this.loading = true
      try {
        const q = this.kw ? `?search=${encodeURIComponent(this.kw)}` : ''
        const body = await request('/api/documents' + q)
        this.list = body.documents || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    onInput() {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.load(), 350)
    },
    clearKw() { this.kw = ''; this.load() },
    goDetail(id) { uni.navigateTo({ url: '/pages/document-detail/document-detail?id=' + id }) },
    goUpload() { uni.navigateTo({ url: '/pages/document-upload/document-upload' }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.search-bar { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 0 20rpx; margin-bottom: 20rpx; border: 1rpx solid #e2e8f0; }
.search-input { flex: 1; height: 80rpx; font-size: 28rpx; color: #0f172a; }
.ph { color: #94a3b8; }
.clear { color: #94a3b8; font-size: 28rpx; padding: 0 10rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.empty { font-size: 30rpx; color: #94a3b8; }
.card { position: relative; background: #fff; border-radius: 20rpx; padding: 26rpx 28rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.name { font-size: 30rpx; font-weight: 600; color: #0f172a; flex: 1; margin-right: 16rpx; }
.type { font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 14rpx; border-radius: 999rpx; white-space: nowrap; }
.meta { margin-top: 12rpx; display: flex; flex-wrap: wrap; align-items: center; }
.meta-item { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 4rpx 12rpx; border-radius: 8rpx; margin-right: 12rpx; }
.meta-item.sign { color: #7c3aed; background: #f5f3ff; }
.arrow { position: absolute; right: 28rpx; bottom: 22rpx; color: #2563eb; font-size: 26rpx; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.35); z-index: 50; }
</style>
