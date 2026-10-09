<template>
  <view class="page">
    <view class="month-bar">
      <text class="nav" @tap="prevMonth">‹</text>
      <text class="month">{{ year }}年{{ month }}月</text>
      <text class="nav" @tap="nextMonth">›</text>
    </view>

    <view v-if="loading" class="center"><text>加载中…</text></view>
    <view v-else-if="!dates.length" class="center"><text class="empty">本月暂无日程</text></view>

    <view v-else>
      <view v-for="g in groups" :key="g.date" class="group">
        <view class="date-head" @tap="onDateTap(g)">
          <text class="d">{{ g.day }}</text>
          <text class="m">{{ g.month }}月 {{ g.weekday }}</text>
          <text class="add">＋</text>
        </view>
        <view v-for="e in g.items" :key="e.id" class="event" :class="e.overdue ? 'ev-danger' : (e.status === 'completed' ? 'ev-done' : 'ev-open')">
          <view class="dot"></view>
          <view class="ev-body">
            <text class="ev-title">{{ e.title }}</text>
            <text class="ev-meta">{{ e.module }}<text v-if="e.companyName"> · {{ e.companyName }}</text></text>
          </view>
          <text class="ev-status">{{ e.overdue ? '逾期' : (e.status === 'completed' ? '已完成' : '待办') }}</text>
        </view>
      </view>
    </view>

    <view class="fab" @tap="onQuickAdd">＋</view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export default {
  data() {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, loading: true, dates: [], events: [] }
  },
  computed: {
    groups() {
      const map = {}
      for (const e of this.events) {
        const dt = new Date(e.date)
        const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`
        if (!map[key]) map[key] = { date: key, year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), weekday: '周' + WEEK[dt.getDay()], items: [] }
        map[key].items.push(e)
      }
      return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date))
    },
  },
  onShow() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try {
        const from = `${this.year}-${String(this.month).padStart(2, '0')}-01`
        const last = new Date(this.year, this.month, 0)
        const to = `${this.year}-${String(this.month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
        const body = await request(`/api/calendar/events?from=${from}&to=${to}`)
        this.events = body.events || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    onDateTap(g) {
      const date = `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`
      uni.showActionSheet({
        itemList: ['在这天新建会议', '在这天新建提醒'],
        success: (res) => {
          if (res.tapIndex === 0) uni.navigateTo({ url: '/pages/meeting-form/meeting-form?date=' + date })
          else if (res.tapIndex === 1) uni.navigateTo({ url: '/pages/reminder-form/reminder-form?date=' + date })
        },
      })
    },
    onQuickAdd() {
      const d = new Date()
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      uni.showActionSheet({
        itemList: ['新建会议', '新建提醒'],
        success: (res) => {
          if (res.tapIndex === 0) uni.navigateTo({ url: '/pages/meeting-form/meeting-form?date=' + date })
          else if (res.tapIndex === 1) uni.navigateTo({ url: '/pages/reminder-form/reminder-form?date=' + date })
        },
      })
    },
    prevMonth() {
      if (this.month === 1) { this.month = 12; this.year-- } else this.month--
      this.load()
    },
    nextMonth() {
      if (this.month === 12) { this.month = 1; this.year++ } else this.month++
      this.load()
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.month-bar { display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 18rpx; }
.nav { font-size: 44rpx; color: #2563eb; width: 80rpx; text-align: center; }
.month { font-size: 32rpx; font-weight: 700; color: #0f172a; margin: 0 24rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.empty { font-size: 30rpx; color: #94a3b8; }
.group { background: #fff; border-radius: 20rpx; padding: 8rpx 28rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.date-head { display: flex; align-items: baseline; padding: 18rpx 0 8rpx; border-bottom: 1rpx solid #f1f5f9; }
.date-head .add { margin-left: auto; color: #2563eb; font-size: 34rpx; padding-left: 20rpx; }
.d { font-size: 40rpx; font-weight: 700; color: #0f172a; margin-right: 14rpx; }
.m { font-size: 24rpx; color: #94a3b8; }
.event { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f8fafc; }
.event:last-child { border-bottom: none; }
.dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #94a3b8; margin-right: 18rpx; }
.ev-danger .dot { background: #dc2626; }
.ev-done .dot { background: #059669; }
.ev-open .dot { background: #2563eb; }
.ev-body { flex: 1; }
.ev-title { font-size: 28rpx; color: #0f172a; display: block; }
.ev-meta { font-size: 22rpx; color: #94a3b8; }
.ev-status { font-size: 22rpx; color: #64748b; }
.ev-danger .ev-status { color: #dc2626; }
.ev-done .ev-status { color: #059669; }
.ev-open .ev-status { color: #2563eb; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #2563EB; color: #fff; font-size: 56rpx; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(37,99,235,0.35); z-index: 50; }
</style>
