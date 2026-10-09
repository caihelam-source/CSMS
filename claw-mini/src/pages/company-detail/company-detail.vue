<template>
  <view class="page">
    <!-- 概览头 -->
    <view class="hero">
      <text class="name">{{ c.name }}</text>
      <text v-if="c.nameChinese" class="name-cn">{{ c.nameChinese }}</text>
      <view class="badges">
        <text class="badge jur">{{ jurLabel(c.jurisdiction) }}</text>
        <text class="badge" :class="statusClass(c.status)">{{ companyStatusLabel(c.status) }}</text>
        <text v-if="c.isListed" class="badge listed">上市</text>
      </view>
      <view class="grid">
        <view class="cell"><text class="k">注册编号</text><text class="v">{{ c.registrationNumber || '—' }}</text></view>
        <view class="cell"><text class="k">成立日期</text><text class="v">{{ fmtDate(c.incorporationDate) }}</text></view>
        <view class="cell"><text class="k">BR 到期</text><text class="v" :class="{ od: isOverdue(c.brExpiryDate) }">{{ fmtDate(c.brExpiryDate) }}</text></view>
        <view class="cell"><text class="k">年结日</text><text class="v">{{ fye(c) }}</text></view>
      </view>
    </view>

    <view class="edit-bar">
      <view class="edit-btn" @tap="edit">编辑资料</view>
    </view>

    <!-- 分段切换 -->
    <scroll-view class="tabs" scroll-x>
      <view
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: active === t.key }"
        @tap="switchTab(t.key)"
      >{{ t.label }}<text v-if="counts[t.key]" class="cnt">{{ counts[t.key] }}</text></view>
    </scroll-view>

    <!-- 关联实体 -->
    <view v-if="active === 'links'" class="section">
      <view v-if="people.length" class="sub-h">人员 ({{ people.length }})</view>
      <view v-for="p in people" :key="p.id" class="row" @tap="goPerson(p.id)">
        <text class="row-name">{{ p.name }}</text>
        <text class="row-sub">{{ (p.roles || []).join(' · ') || '关联人员' }}</text>
        <text class="chev">›</text>
      </view>

      <view v-if="related.length" class="sub-h">关联公司 ({{ related.length }})</view>
      <view v-for="r in related" :key="r.id" class="row" @tap="goCompany(r.id)">
        <text class="row-name">{{ r.name }}</text>
        <text class="row-sub">{{ (r.roles || []).join(' · ') || '关联公司' }}</text>
        <text class="chev">›</text>
      </view>

      <view v-if="!people.length && !related.length" class="empty">暂无关联实体</view>
    </view>

    <!-- 文档 -->
    <view v-else-if="active === 'documents'" class="section">
      <view v-for="d in documents" :key="d._id" class="row" @tap="goDoc(d._id)">
        <text class="row-name">{{ d.name }}</text>
        <text class="row-sub">{{ docTypeLabel(d.type) }} · {{ fmtDate(d.createdAt) }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!documents.length" class="empty">暂无文档</view>
    </view>

    <!-- 合规提醒 -->
    <view v-else-if="active === 'reminders'" class="section">
      <view v-for="r in reminders" :key="r._id" class="row" @tap="goReminder(r._id)">
        <text class="row-name">{{ r.title }}</text>
        <text class="row-sub">{{ fmtDate(r.dueDate) }} · {{ priorityLabel(r.priority) }}</text>
        <text class="tag" :class="rStatusClass(r.status)">{{ reminderStatusLabel(r.status) }}</text>
      </view>
      <view v-if="!reminders.length" class="empty">暂无提醒</view>
    </view>

    <!-- 任务 -->
    <view v-else-if="active === 'tasks'" class="section">
      <view v-for="t in tasks" :key="t._id" class="row" @tap="goTask(t._id)">
        <text class="row-name">{{ t.title }}</text>
        <text class="row-sub">{{ taskTypeLabel(t.type) }} · {{ fmtDate(t.dueDate) }}</text>
        <text class="tag" :class="tStatusClass(t.status)">{{ taskStatusLabel(t.status) }}</text>
      </view>
      <view v-if="!tasks.length" class="empty">暂无任务</view>
    </view>

    <!-- 会议 -->
    <view v-else-if="active === 'meetings'" class="section">
      <view v-for="m in meetings" :key="m._id" class="row" @tap="goMeeting(m._id)">
        <text class="row-name">{{ m.title }}</text>
        <text class="row-sub">{{ meetingTypeLabel(m.type) }} · {{ fmtDate(m.date) }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!meetings.length" class="empty">暂无会议</view>
    </view>

    <!-- 股权 / 股本 -->
    <view v-else-if="active === 'equity'" class="section">
      <view class="sub-h">股本 (Share Capital)</view>
      <view class="grid">
        <view class="cell"><text class="k">已发行</text><text class="v">{{ sc('issued') }}</text></view>
        <view class="cell"><text class="k">实缴</text><text class="v">{{ sc('paidUp') }}</text></view>
        <view class="cell"><text class="k">币种</text><text class="v">{{ (c.shareCapital && c.shareCapital.currency) || 'HKD' }}</text></view>
      </view>
      <view class="sub-h">股东 ({{ shareholders.length }})</view>
      <view v-for="s in shareholders" :key="s.link._id" class="row" @tap="goPerson(s.link._id)">
        <text class="row-name">{{ s.link.name }}</text>
        <text class="row-sub">{{ (s.shareType ? s.shareType + ' · ' : '') }}{{ s.shares != null ? s.shares + ' 股' : '持股' }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!shareholders.length" class="empty">暂无股东登记</view>
    </view>

    <!-- 登记册 -->
    <view v-else-if="active === 'registers'" class="section">
      <view class="sub-h">董事登记册 (ROD)</view>
      <view v-for="d in directors" :key="d.link._id" class="row" @tap="goPerson(d.link._id)">
        <text class="row-name">{{ d.link.name }}</text>
        <text class="row-sub">{{ fmtDate(d.appointmentDate) }}{{ d.cessationDate ? ' · 退任 ' + fmtDate(d.cessationDate) : '' }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!directors.length" class="empty">暂无董事登记</view>

      <view class="sub-h">秘书登记册</view>
      <view v-for="s in secretaries" :key="s.link._id" class="row" @tap="goPerson(s.link._id)">
        <text class="row-name">{{ s.link.name }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!secretaries.length" class="empty">暂无秘书登记</view>

      <view class="sub-h">成员登记册 (ROM)</view>
      <view v-for="m in shareholders" :key="m.link._id" class="row" @tap="goPerson(m.link._id)">
        <text class="row-name">{{ m.link.name }}</text>
        <text class="row-sub">{{ (m.shareType ? m.shareType + ' · ' : '') }}{{ m.shares != null ? m.shares + ' 股' : '持股' }}</text>
        <text class="chev">›</text>
      </view>
      <view v-if="!shareholders.length" class="empty">暂无成员登记</view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import {
  fmtDate, isOverdue, jurLabel, companyStatusLabel, docTypeLabel, priorityLabel,
  reminderStatusLabel, taskStatusLabel, taskTypeLabel, meetingTypeLabel,
} from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', c: {}, active: 'links',
      tabs: [
        { key: 'links', label: '关联' },
        { key: 'documents', label: '文档' },
        { key: 'reminders', label: '提醒' },
        { key: 'tasks', label: '任务' },
        { key: 'meetings', label: '会议' },
        { key: 'equity', label: '股权' },
        { key: 'registers', label: '登记册' },
      ],
      counts: {},
      people: [], related: [], documents: [], reminders: [], tasks: [], meetings: [],
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.loadCompany()
  },
  computed: {
    shareholders() {
      return (this.c.links || []).filter(l => l.roles && l.roles.includes('shareholder'))
    },
    directors() {
      return (this.c.links || []).filter(l => l.roles && (l.roles.includes('director') || l.roles.includes('alternate_director')))
    },
    secretaries() {
      return (this.c.links || []).filter(l => l.roles && l.roles.includes('secretary'))
    },
  },
  methods: {
    fmtDate, isOverdue, jurLabel, companyStatusLabel, docTypeLabel, priorityLabel,
    reminderStatusLabel, taskStatusLabel, taskTypeLabel, meetingTypeLabel,
    statusClass(s) {
      return { active: 'st-active', dormant: 'st-dormant', dissolved: 'st-dissolved' }[s] || 'st-muted'
    },
    rStatusClass(s) { return { 已完成: 't-success', 已过期: 't-danger', 已忽略: 't-muted' }[s] || 't-warn' },
    tStatusClass(s) { return { completed: 't-success', overdue: 't-danger', in_progress: 't-warn' }[s] || 't-normal' },
    fye(c) {
      if (!c.financialYearEnd) return '—'
      const m = c.financialYearEnd.month, d = c.financialYearEnd.day
      if (!m) return '—'
      return `${m}月${d || ''}日`
    },
    sc(f) {
      const v = this.c.shareCapital && this.c.shareCapital[f]
      return (v === 0 || v) ? v : '—'
    },
    async loadCompany() {
      try {
        const body = await request('/api/companies/' + this.id)
        this.c = body.company || body || {}
        this.parseLinks()
        this.loadCounts()
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      }
    },
    parseLinks() {
      const links = (this.c.links || []).filter(l => l && l.link)
      this.people = links.filter(l => l.linkModel === 'Personnel').map(l => ({
        id: l.link._id, name: l.link.name, roles: l.roles || [],
      }))
      this.related = links.filter(l => l.linkModel === 'Company').map(l => ({
        id: l.link._id, name: l.link.name, roles: l.roles || [],
      }))
      this.counts.equity = this.shareholders.length
      this.counts.registers = this.directors.length + this.secretaries.length + this.shareholders.length
    },
    async loadCounts() {
      try {
        const [d, r, t, m] = await Promise.all([
          request('/api/documents?companyId=' + this.id),
          request('/api/compliance-reminders?companyId=' + this.id),
          request('/api/tasks?companyId=' + this.id),
          request('/api/meetings?companyId=' + this.id),
        ])
        this.counts.documents = (d.documents || []).length
        this.counts.reminders = (r.reminders || []).length
        this.counts.tasks = (t.tasks || []).length
        this.counts.meetings = (m.meetings || []).length
      } catch (e) { /* 静默 */ }
    },
    async switchTab(key) {
      this.active = key
      if (key === 'documents' && !this.documents.length && this.counts.documents) this.loadDocuments()
      if (key === 'reminders' && !this.reminders.length && this.counts.reminders) this.loadReminders()
      if (key === 'tasks' && !this.tasks.length && this.counts.tasks) this.loadTasks()
      if (key === 'meetings' && !this.meetings.length && this.counts.meetings) this.loadMeetings()
    },
    async loadDocuments() {
      const b = await request('/api/documents?companyId=' + this.id); this.documents = b.documents || []
    },
    async loadReminders() {
      const b = await request('/api/compliance-reminders?companyId=' + this.id); this.reminders = b.reminders || []
    },
    async loadTasks() {
      const b = await request('/api/tasks?companyId=' + this.id); this.tasks = b.tasks || []
    },
    async loadMeetings() {
      const b = await request('/api/meetings?companyId=' + this.id); this.meetings = b.meetings || []
    },
    goPerson(id) { uni.navigateTo({ url: '/pages/personnel-detail/personnel-detail?id=' + id }) },
    goCompany(id) { uni.navigateTo({ url: '/pages/company-detail/company-detail?id=' + id }) },
    edit() { uni.navigateTo({ url: '/pages/company-form/company-form?id=' + this.id }) },
    goDoc(id) { uni.navigateTo({ url: '/pages/document-detail/document-detail?id=' + id }) },
    goReminder(id) { uni.navigateTo({ url: '/pages/reminder-detail/reminder-detail?id=' + id }) },
    goTask(id) { uni.navigateTo({ url: '/pages/task-detail/task-detail?id=' + id }) },
    goMeeting(id) { uni.navigateTo({ url: '/pages/meeting-detail/meeting-detail?id=' + id }) },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.hero { background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 18rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.name { font-size: 38rpx; font-weight: 700; color: #0f172a; display: block; }
.name-cn { font-size: 26rpx; color: #64748b; margin-top: 6rpx; display: block; }
.badges { margin-top: 16rpx; display: flex; flex-wrap: wrap; }
.badge { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; margin-right: 12rpx; background: #f1f5f9; color: #64748b; }
.badge.jur { color: #2563eb; background: #eff6ff; }
.badge.listed { color: #7c3aed; background: #f5f3ff; }
.st-active { color: #059669; background: #ecfdf5; }
.st-dormant { color: #b45309; background: #fffbeb; }
.st-dissolved { color: #dc2626; background: #fef2f2; }
.st-muted { color: #64748b; background: #f1f5f9; }
.grid { margin-top: 22rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.cell { background: #f8fafc; border-radius: 12rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 28rpx; color: #0f172a; margin-top: 4rpx; }
.v.od { color: #dc2626; }
.tabs { white-space: nowrap; margin-bottom: 12rpx; }
.tab { display: inline-block; font-size: 28rpx; color: #64748b; padding: 14rpx 24rpx; margin-right: 8rpx; border-bottom: 4rpx solid transparent; }
.tab.active { color: #2563eb; font-weight: 600; border-bottom-color: #2563eb; }
.cnt { font-size: 20rpx; color: #94a3b8; margin-left: 6rpx; }
.section { background: #fff; border-radius: 20rpx; padding: 8rpx 28rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.sub-h { font-size: 24rpx; color: #94a3b8; padding: 18rpx 0 8rpx; }
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
