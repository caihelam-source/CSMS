<template>
  <view class="page">
    <view v-if="loading && list.length === 0" class="center"><text>加载中…</text></view>
    <view v-else-if="list.length === 0" class="center"><text class="empty">暂无模板</text></view>

    <view v-else>
      <view v-for="t in list" :key="t._id" class="card" @tap="open(t)">
        <view class="card-top">
          <text class="title">{{ t.name }}</text>
          <text v-if="t.isPreset" class="preset">内置</text>
        </view>
        <text class="cat">{{ templateCategoryLabel(t.category) }}</text>
        <text v-if="t.description" class="desc">{{ t.description }}</text>
      </view>
      <view class="foot"><text>共 {{ list.length }} 个</text></view>
    </view>

    <view v-if="active" class="mask" @tap="close">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">{{ active.name }}</view>
        <view class="sheet-row"><text class="k">分类</text><text class="v">{{ templateCategoryLabel(active.category) }}</text></view>
        <view class="sheet-row"><text class="k">类型</text><text class="v">{{ active.isPreset ? '内置模板' : '自定义模板' }}</text></view>
        <view class="sheet-row"><text class="k">版本</text><text class="v">{{ active.version || 1 }}</text></view>
        <view v-if="active.description" class="sheet-desc">{{ active.description }}</view>
        <button class="close" @tap="close">关闭</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { templateCategoryLabel } from '../../utils/format.js'

export default {
  data() { return { loading: true, list: [], active: null } },
  onShow() { this.load() },
  onPullDownRefresh() { this.load(true) },
  methods: {
    templateCategoryLabel,
    async load(pull) {
      this.loading = true
      try {
        const body = await request('/api/templates')
        this.list = body.templates || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    open(t) { this.active = t },
    close() { this.active = null },
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
.preset { font-size: 20rpx; color: #7c3aed; background: #f5f3ff; padding: 4rpx 12rpx; border-radius: 999rpx; }
.cat { display: inline-block; font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 12rpx; border-radius: 8rpx; margin-top: 10rpx; }
.desc { display: block; font-size: 24rpx; color: #64748b; margin-top: 10rpx; line-height: 1.5; }
.foot { text-align: center; color: #94a3b8; font-size: 24rpx; padding: 20rpx 0; }
.mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.45); display: flex; align-items: flex-end; z-index: 99; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 36rpx 32rpx 48rpx; box-sizing: border-box; }
.sheet-title { font-size: 36rpx; font-weight: 700; color: #0f172a; margin-bottom: 20rpx; }
.sheet-row { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.k { font-size: 26rpx; color: #64748b; }
.v { font-size: 26rpx; color: #0f172a; }
.sheet-desc { font-size: 26rpx; color: #334155; line-height: 1.6; margin: 20rpx 0; }
.close { width: 100%; height: 88rpx; line-height: 88rpx; background: #f1f5f9; color: #334155; font-size: 28rpx; border-radius: 16rpx; border: none; margin-top: 12rpx; }
.close::after { border: none; }
</style>
