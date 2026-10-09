<template>
  <view class="page">
    <view class="search-bar">
      <text class="si">🔍</text>
      <input class="sinput" v-model="q" placeholder="搜索公司 / 人员 / 文件 / 会议 / 任务 / 提醒" placeholder-class="ph" @input="onInput" confirm-type="search" />
      <text v-if="q" class="clear" @tap="clear">✕</text>
    </view>

    <view v-if="!q" class="hint">
      <text class="hint-title">全局搜索</text>
      <text class="hint-sub">输入关键词，跨全部模块检索。支持中文子串匹配。</text>
    </view>

    <view v-else-if="loading" class="state">搜索中…</view>

    <view v-else-if="results.length === 0" class="state">未找到与「{{ q }}」相关的结果</view>

    <scroll-view v-else scroll-y class="list">
      <view v-for="g in groups" :key="g.type" class="group">
        <view class="group-head">
          <text class="group-ico">{{ g.icon }}</text>
          <text class="group-name">{{ g.label }}</text>
          <text class="group-count">{{ g.items.length }}</text>
        </view>
        <view v-for="it in g.items" :key="it.id" class="row" @tap="open(it)">
          <view class="row-main">
            <text class="row-title">{{ it.title }}</text>
            <text v-if="it.subtitle" class="row-sub">{{ it.subtitle }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const TYPE_META = {
  company: { label: '公司', icon: '🏢' },
  personnel: { label: '人员', icon: '👤' },
  document: { label: '文件', icon: '📄' },
  meeting: { label: '会议', icon: '📅' },
  task: { label: '任务', icon: '✅' },
  reminder: { label: '合规提醒', icon: '⏰' },
}
const DETAIL_URL = {
  company: '/pages/company-detail/company-detail?id=',
  personnel: '/pages/personnel-detail/personnel-detail?id=',
  meeting: '/pages/meeting-detail/meeting-detail?id=',
  task: '/pages/task-detail/task-detail?id=',
  reminder: '/pages/reminder-detail/reminder-detail?id=',
  document: '/pages/documents/documents',
}

export default {
  data() {
    return {
      q: '',
      results: [],
      loading: false,
      timer: null,
    }
  },
  computed: {
    groups() {
      const map = {}
      this.results.forEach((r) => {
        const t = r.type || 'other'
        if (!map[t]) map[t] = []
        map[t].push(r)
      })
      return Object.keys(map).map((t) => ({
        type: t,
        label: (TYPE_META[t] && TYPE_META[t].label) || t,
        icon: (TYPE_META[t] && TYPE_META[t].icon) || '•',
        items: map[t],
      }))
    },
  },
  methods: {
    onInput() {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.run(), 350)
    },
    clear() {
      this.q = ''
      this.results = []
    },
    async run() {
      const q = this.q.trim()
      if (!q) { this.results = []; return }
      this.loading = true
      try {
        const r = await request('/api/search?q=' + encodeURIComponent(q) + '&limit=20')
        const inner = (r && r.data && r.data.data) ? r.data.data : (r && r.data) ? r.data : r
        this.results = inner.results || []
      } catch (e) {
        this.results = []
      } finally {
        this.loading = false
      }
    },
    open(it) {
      const url = DETAIL_URL[it.type]
      if (!url) return
      if (it.type === 'document') {
        uni.switchTab({ url, fail: () => uni.navigateTo({ url }) })
      } else {
        uni.navigateTo({ url: url + it.id })
      }
    },
  },
}
</script>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; background: #f5f7fa; padding: 24rpx; }
.search-bar { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 0 24rpx; height: 88rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.si { font-size: 30rpx; margin-right: 12rpx; }
.sinput { flex: 1; height: 88rpx; font-size: 28rpx; color: #0f172a; }
.ph { color: #94a3b8; }
.clear { font-size: 28rpx; color: #94a3b8; padding: 0 8rpx; }
.hint { margin-top: 80rpx; display: flex; flex-direction: column; align-items: center; }
.hint-title { font-size: 32rpx; font-weight: 700; color: #0f172a; }
.hint-sub { font-size: 24rpx; color: #94a3b8; margin-top: 12rpx; text-align: center; padding: 0 60rpx; line-height: 1.6; }
.state { margin-top: 80rpx; text-align: center; font-size: 26rpx; color: #94a3b8; }
.list { margin-top: 20rpx; }
.group { background: #fff; border-radius: 18rpx; margin-bottom: 20rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.group-head { display: flex; align-items: center; padding: 22rpx 24rpx; border-bottom: 1rpx solid #f1f5f9; }
.group-ico { font-size: 30rpx; margin-right: 12rpx; }
.group-name { font-size: 26rpx; font-weight: 700; color: #0f172a; }
.group-count { margin-left: auto; font-size: 22rpx; color: #94a3b8; background: #f1f5f9; border-radius: 20rpx; padding: 2rpx 16rpx; }
.row { display: flex; align-items: center; padding: 24rpx; border-bottom: 1rpx solid #f8fafc; }
.row:last-child { border-bottom: none; }
.row-main { flex: 1; display: flex; flex-direction: column; }
.row-title { font-size: 28rpx; color: #0f172a; }
.row-sub { font-size: 22rpx; color: #94a3b8; margin-top: 6rpx; }
.row-arrow { font-size: 36rpx; color: #cbd5e1; margin-left: 12rpx; }
</style>
