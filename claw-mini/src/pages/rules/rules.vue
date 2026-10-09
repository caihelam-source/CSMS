<template>
  <view class="page">
    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">暂无规则</text></view>

    <view v-else>
      <view v-for="r in list" :key="r._id" class="card" @tap="goDetail(r._id)">
        <view class="card-top">
          <text class="title">{{ r.ruleName }}</text>
          <text class="status" :class="r.status === '启用' ? 'on' : 'off'">{{ r.status }}</text>
        </view>
        <text class="rid">{{ r.ruleId }}</text>
        <view class="card-bottom">
          <text class="cat">{{ r.category || '—' }}</text>
          <text class="jur">{{ jurLabel(r.jurisdiction) }}</text>
          <text class="prio" v-if="r.priority">{{ r.priority }}</text>
        </view>
      </view>
      <view class="foot"><text>共 {{ list.length }} 条</text></view>
    </view>

    <view class="fab" @tap="goCreate">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { jurLabel } from '../../utils/format.js'

export default {
  data() { return { loading: true, list: [] } },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    jurLabel,
    async load(pull) {
      this.loading = true
      try {
        const body = await request('/api/compliance-rules')
        this.list = body.rules || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    goDetail(id) { uni.navigateTo({ url: '/pages/rule-detail/rule-detail?id=' + id }) },
    goCreate() { uni.navigateTo({ url: '/pages/rule-form/rule-form' }) },
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
.status { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.status.on { color: #059669; background: #ecfdf5; }
.status.off { color: #94a3b8; background: #f1f5f9; }
.rid { display: block; font-size: 22rpx; color: #94a3b8; margin-top: 6rpx; }
.card-bottom { margin-top: 14rpx; display: flex; align-items: center; }
.cat { font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 12rpx; border-radius: 8rpx; margin-right: 12rpx; }
.jur { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 4rpx 12rpx; border-radius: 8rpx; margin-right: 12rpx; }
.prio { font-size: 22rpx; color: #b45309; background: #fffbeb; padding: 4rpx 12rpx; border-radius: 8rpx; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.35); z-index: 50; }
</style>
