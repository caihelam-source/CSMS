<template>
  <view class="page">
    <view class="hero">
      <view class="avatar">{{ initial(p.name) }}</view>
      <view class="hero-info">
        <text class="name">{{ p.name }}</text>
        <text v-if="p.nameChinese" class="name-cn">{{ p.nameChinese }}</text>
      </view>
    </view>

    <view class="edit-bar">
      <view class="edit-btn" @tap="edit">编辑资料</view>
    </view>

    <view class="facts">
      <view class="fact" v-if="p.nric"><text class="k">证件号</text><text class="v">{{ p.nric }}</text></view>
      <view class="fact" v-if="p.email"><text class="k">邮箱</text><text class="v">{{ p.email }}</text></view>
      <view class="fact" v-if="p.phone"><text class="k">电话</text><text class="v">{{ p.phone }}</text></view>
      <view class="fact" v-if="p.nationality"><text class="k">国籍</text><text class="v">{{ p.nationality }}</text></view>
    </view>

    <view class="roles-box" v-if="(p.roles || []).length">
      <text v-for="r in p.roles" :key="r" class="role">{{ r }}</text>
    </view>

    <scroll-view class="tabs" scroll-x>
      <view v-for="t in tabs" :key="t.key" class="tab" :class="{ active: active === t.key }" @tap="active = t.key">
        {{ t.label }}<text v-if="counts[t.key]" class="cnt">{{ counts[t.key] }}</text>
      </view>
    </scroll-view>

    <view class="section">
      <view v-if="active === 'companies'" class="sub">
        <view v-for="c in agg.companies" :key="c._id" class="row" @tap="goCompany(c._id)">
          <text class="row-name">{{ c.name }}</text>
          <text class="row-sub">{{ (c.roles || []).join(' · ') || '关联公司' }}</text>
          <text class="chev">›</text>
        </view>
        <view v-if="!agg.companies || !agg.companies.length" class="empty">暂无关联公司</view>
      </view>

      <view v-else-if="active === 'tasks'" class="sub">
        <view v-for="t in agg.tasks" :key="t._id" class="row" @tap="goTask(t._id)">
          <text class="row-name">{{ t.title }}</text>
          <text class="row-sub">{{ fmtDate(t.dueDate) }}</text>
          <text class="tag" :class="tStatusClass(t.status)">{{ taskStatusLabel(t.status) }}</text>
        </view>
        <view v-if="!agg.tasks || !agg.tasks.length" class="empty">暂无任务</view>
      </view>

      <view v-else-if="active === 'meetings'" class="sub">
        <view v-for="m in agg.meetings" :key="m._id" class="row" @tap="goMeeting(m._id)">
          <text class="row-name">{{ m.title }}</text>
          <text class="row-sub">{{ fmtDate(m.date) }}</text>
          <text class="chev">›</text>
        </view>
        <view v-if="!agg.meetings || !agg.meetings.length" class="empty">暂无会议</view>
      </view>

      <view v-else-if="active === 'reminders'" class="sub">
        <view v-for="r in agg.reminders" :key="r._id" class="row" @tap="goReminder(r._id)">
          <text class="row-name">{{ r.title }}</text>
          <text class="row-sub">{{ fmtDate(r.dueDate) }}</text>
          <text class="tag" :class="rStatusClass(r.status)">{{ reminderStatusLabel(r.status) }}</text>
        </view>
        <view v-if="!agg.reminders || !agg.reminders.length" class="empty">暂无提醒</view>
      </view>

      <view v-else-if="active === 'documents'" class="sub">
        <view v-for="d in agg.documents" :key="d._id" class="row" @tap="goDoc(d._id)">
          <text class="row-name">{{ d.name }}</text>
          <text class="row-sub">{{ docTypeLabel(d.type) }}</text>
          <text class="chev">›</text>
        </view>
        <view v-if="!agg.documents || !agg.documents.length" class="empty">暂无文档</view>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, taskStatusLabel, reminderStatusLabel, docTypeLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', p: {}, agg: {}, active: 'companies',
      tabs: [
        { key: 'companies', label: '公司' },
        { key: 'tasks', label: '任务' },
        { key: 'meetings', label: '会议' },
        { key: 'reminders', label: '提醒' },
        { key: 'documents', label: '文档' },
      ],
      counts: {},
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  methods: {
    fmtDate, taskStatusLabel, reminderStatusLabel, docTypeLabel,
    initial(name) { return (name || '?').trim().charAt(0).toUpperCase() },
    tStatusClass(s) { return { completed: 't-success', overdue: 't-danger', in_progress: 't-warn' }[s] || 't-normal' },
    rStatusClass(s) { return { 已完成: 't-success', 已过期: 't-danger', 已忽略: 't-muted' }[s] || 't-warn' },
    async load() {
      try {
        const [base, agg] = await Promise.all([
          request('/api/personnel/' + this.id),
          request('/api/personnel/' + this.id + '/aggregate'),
        ])
        this.p = base.personnel || base || {}
        this.agg = agg || {}
        this.counts = {
          companies: (this.agg.companies || []).length,
          tasks: (this.agg.tasks || []).length,
          meetings: (this.agg.meetings || []).length,
          reminders: (this.agg.reminders || []).length,
          documents: (this.agg.documents || []).length,
        }
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      }
    },
    goCompany(id) { uni.navigateTo({ url: '/pages/company-detail/company-detail?id=' + id }) },
    edit() { uni.navigateTo({ url: '/pages/personnel-form/personnel-form?id=' + this.id }) },
    goTask(id) { uni.navigateTo({ url: '/pages/task-detail/task-detail?id=' + id }) },
    goMeeting(id) { uni.navigateTo({ url: '/pages/meeting-detail/meeting-detail?id=' + id }) },
    goReminder(id) { uni.navigateTo({ url: '/pages/reminder-detail/reminder-detail?id=' + id }) },
    goDoc(id) { uni.navigateTo({ url: '/pages/document-detail/document-detail?id=' + id }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.hero { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 40rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 22rpx; }
.name { font-size: 36rpx; font-weight: 700; color: #0f172a; display: block; }
.name-cn { font-size: 26rpx; color: #64748b; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.roles-box { background: #fff; border-radius: 14rpx; padding: 18rpx; margin-bottom: 16rpx; display: flex; flex-wrap: wrap; }
.role { font-size: 22rpx; color: #2563eb; background: #eff6ff; padding: 6rpx 16rpx; border-radius: 999rpx; margin: 0 10rpx 10rpx 0; }
.tabs { white-space: nowrap; margin-bottom: 12rpx; }
.tab { display: inline-block; font-size: 28rpx; color: #64748b; padding: 14rpx 24rpx; margin-right: 8rpx; border-bottom: 4rpx solid transparent; }
.tab.active { color: #2563eb; font-weight: 600; border-bottom-color: #2563eb; }
.cnt { font-size: 20rpx; color: #94a3b8; margin-left: 6rpx; }
.section { background: #fff; border-radius: 20rpx; padding: 8rpx 28rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.sub { min-height: 120rpx; }
.row { display: flex; align-items: center; padding: 22rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.row:last-child { border-bottom: none; }
.row-name { font-size: 30rpx; color: #0f172a; flex: 1; }
.row-sub { font-size: 22rpx; color: #94a3b8; margin-right: 16rpx; }
.chev { color: #cbd5e1; font-size: 32rpx; }
.tag { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.t-warn { color: #b45309; background: #fffbeb; }
.t-danger { color: #dc2626; background: #fef2f2; }
.t-success { color: #059669; background: #ecfdf5; }
.t-muted { color: #64748b; background: #f1f5f9; }
.t-normal { color: #2563eb; background: #eff6ff; }
.empty { text-align: center; color: #94a3b8; font-size: 28rpx; padding: 60rpx 0; }
.edit-bar { display: flex; justify-content: flex-end; padding: 0 4rpx 16rpx; }
.edit-btn { font-size: 26rpx; color: #2563EB; background: #eff6ff; padding: 10rpx 28rpx; border-radius: 999rpx; }
</style>
