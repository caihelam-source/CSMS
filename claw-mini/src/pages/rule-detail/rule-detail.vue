<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="title">{{ r.ruleName }}</text>
        <text class="status" :class="r.status === '启用' ? 'on' : 'off'">{{ r.status }}</text>
      </view>

      <view class="edit-bar">
        <view class="edit-btn" @tap="edit">编辑</view>
      </view>

      <view class="facts">
        <view class="fact"><text class="k">规则编号</text><text class="v">{{ r.ruleId }}</text></view>
        <view class="fact"><text class="k">类别</text><text class="v">{{ r.category || '—' }}</text></view>
        <view class="fact"><text class="k">适用地区</text><text class="v">{{ jurLabel(r.jurisdiction) }}</text></view>
        <view class="fact"><text class="k">优先级</text><text class="v">{{ r.priority || '—' }}</text></view>
        <view class="fact" v-if="r.isListedOnly"><text class="k">仅上市</text><text class="v">是</text></view>
        <view class="fact" v-if="r.isPreset !== undefined"><text class="k">预设</text><text class="v">{{ r.isPreset ? '是' : '自定义' }}</text></view>
      </view>

      <view v-if="r.description" class="desc">
        <text class="desc-label">说明</text><text class="desc-text">{{ r.description }}</text>
      </view>
      <view v-if="r.legalReference" class="desc">
        <text class="desc-label">法规依据</text><text class="desc-text">{{ r.legalReference }}</text>
      </view>
      <view v-if="r.penaltyNote" class="desc">
        <text class="desc-label">罚款说明</text><text class="desc-text">{{ r.penaltyNote }}</text>
      </view>
      <view v-if="r.specialNote" class="desc">
        <text class="desc-label">特殊说明</text><text class="desc-text">{{ r.specialNote }}</text>
      </view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { jurLabel } from '../../utils/format.js'

export default {
  data() { return { id: '', r: {}, loading: true } },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  onPullDownRefresh() { this.load(true) },
  methods: {
    jurLabel,
    edit() { uni.navigateTo({ url: '/pages/rule-form/rule-form?id=' + this.id }) },
    async load(pull) {
      try {
        const body = await request('/api/compliance-rules/' + this.id)
        this.r = body.rule || body || {}
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.hero { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.title { font-size: 32rpx; font-weight: 700; color: #0f172a; flex: 1; margin-right: 16rpx; }
.status { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; white-space: nowrap; }
.status.on { color: #059669; background: #ecfdf5; }
.status.off { color: #94a3b8; background: #f1f5f9; }
.edit-bar { display: flex; justify-content: flex-end; margin-bottom: 16rpx; }
.edit-btn { font-size: 26rpx; color: #2563eb; background: #eff6ff; padding: 10rpx 28rpx; border-radius: 999rpx; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.desc { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 16rpx; }
.desc-label { display: block; font-size: 22rpx; color: #94a3b8; margin-bottom: 8rpx; }
.desc-text { font-size: 26rpx; color: #334155; line-height: 1.6; white-space: pre-wrap; }
</style>
