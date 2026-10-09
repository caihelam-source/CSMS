<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" v-model="kw" placeholder="搜索人员姓名 / 证件号 / 邮箱" placeholder-class="ph" @confirm="load" @input="onInput" />
      <text v-if="kw" class="clear" @tap="clearKw">✕</text>
    </view>

    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">没有匹配的人员</text></view>

    <view v-else>
      <view v-for="p in list" :key="p._id" class="card" @tap="goDetail(p._id)">
        <view class="avatar">{{ initial(p.name) }}</view>
        <view class="info">
          <text class="name">{{ p.name }}</text>
          <text v-if="p.nameChinese" class="name-cn">{{ p.nameChinese }}</text>
          <view class="roles">
            <text v-for="r in (p.roles || []).slice(0, 3)" :key="r" class="role">{{ r }}</text>
            <text v-if="!(p.roles || []).length" class="role muted">未分类</text>
          </view>
        </view>
        <text class="chev">›</text>
      </view>
      <view class="foot"><text>共 {{ list.length }} 人</text></view>
    </view>
    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

export default {
  data() {
    return { loading: true, list: [], kw: '', timer: null }
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    async load(pull) {
      this.loading = true
      try {
        const q = this.kw ? `?search=${encodeURIComponent(this.kw)}` : ''
        const body = await request('/api/personnel' + q)
        this.list = body.personnel || []
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
    initial(name) { return (name || '?').trim().charAt(0).toUpperCase() },
    goDetail(id) { uni.navigateTo({ url: '/pages/personnel-detail/personnel-detail?id=' + id }) },
    goCreate() { uni.navigateTo({ url: '/pages/personnel-form/personnel-form' }) },
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
.card { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 32rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; }
.info { flex: 1; }
.name { font-size: 32rpx; font-weight: 600; color: #0f172a; display: block; }
.name-cn { font-size: 24rpx; color: #64748b; }
.roles { margin-top: 8rpx; display: flex; flex-wrap: wrap; }
.role { font-size: 20rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 12rpx; border-radius: 999rpx; margin-right: 10rpx; }
.role.muted { color: #94a3b8; background: #f1f5f9; }
.chev { color: #cbd5e1; font-size: 36rpx; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab {
  position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx;
  border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; line-height: 96rpx;
  text-align: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.4); z-index: 50;
}
</style>
