<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" v-model="kw" placeholder="搜索公司名 / 编号 / 股票代码" placeholder-class="ph" @confirm="load" @input="onInput" />
      <text v-if="kw" class="clear" @tap="clearKw">✕</text>
    </view>

    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>

    <view v-else-if="list.length === 0" class="center">
      <text class="empty">没有匹配的公司</text>
    </view>

    <view v-else>
      <view
        v-for="c in list"
        :key="c._id"
        class="card"
        @tap="goDetail(c._id)"
      >
        <view class="card-top">
          <text class="name">{{ c.name }}</text>
          <text class="jur">{{ jurLabel(c.jurisdiction) }}</text>
        </view>
        <text v-if="c.nameChinese" class="name-cn">{{ c.nameChinese }}</text>
        <view class="meta">
          <text class="meta-item" v-if="c.registrationNumber">编号 {{ c.registrationNumber }}</text>
          <text class="meta-item" v-if="c.stockCode">股票 {{ c.stockCode }}</text>
        </view>
        <view class="card-bottom">
          <text class="status" :class="statusClass(c.status)">{{ companyStatusLabel(c.status) }}</text>
          <text v-if="c.brExpiryDate" class="br" :class="{ overdue: isOverdue(c.brExpiryDate) }">
            BR 到期 {{ fmtDate(c.brExpiryDate) }}
          </text>
        </view>
      </view>
      <view class="foot"><text>共 {{ list.length }} 家</text></view>
    </view>
    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, isOverdue, jurLabel, companyStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return { loading: true, list: [], kw: '', timer: null }
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    fmtDate, isOverdue, jurLabel, companyStatusLabel,
    async load(pull) {
      this.loading = true
      try {
        const q = this.kw ? `?search=${encodeURIComponent(this.kw)}` : ''
        const body = await request('/api/companies' + q)
        this.list = body.companies || []
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
    statusClass(s) {
      return { active: 'st-active', dormant: 'st-dormant', dissolved: 'st-dissolved' }[s] || 'st-muted'
    },
    goDetail(id) {
      uni.navigateTo({ url: '/pages/company-detail/company-detail?id=' + id })
    },
    goCreate() {
      uni.navigateTo({ url: '/pages/company-form/company-form' })
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.search-bar {
  display: flex; align-items: center; background: #fff; border-radius: 16rpx;
  padding: 0 20rpx; margin-bottom: 20rpx; border: 1rpx solid #e2e8f0;
}
.search-input { flex: 1; height: 80rpx; font-size: 28rpx; color: #0f172a; }
.ph { color: #94a3b8; }
.clear { color: #94a3b8; font-size: 28rpx; padding: 0 10rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.empty { font-size: 30rpx; color: #94a3b8; }
.card {
  background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 18rpx;
  box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04);
}
.card-top { display: flex; justify-content: space-between; align-items: center; }
.name { font-size: 32rpx; font-weight: 600; color: #0f172a; }
.jur {
  font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 14rpx; border-radius: 999rpx;
}
.name-cn { display: block; font-size: 24rpx; color: #64748b; margin-top: 6rpx; }
.meta { margin-top: 14rpx; display: flex; flex-wrap: wrap; }
.meta-item { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 4rpx 12rpx; border-radius: 8rpx; margin-right: 12rpx; }
.card-bottom { margin-top: 16rpx; display: flex; align-items: center; }
.status { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; margin-right: 16rpx; }
.st-active { color: #059669; background: #ecfdf5; }
.st-dormant { color: #b45309; background: #fffbeb; }
.st-dissolved { color: #dc2626; background: #fef2f2; }
.st-muted { color: #64748b; background: #f1f5f9; }
.br { font-size: 22rpx; color: #64748b; }
.br.overdue { color: #dc2626; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab {
  position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx;
  border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; line-height: 96rpx;
  text-align: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.4); z-index: 50;
}
</style>
