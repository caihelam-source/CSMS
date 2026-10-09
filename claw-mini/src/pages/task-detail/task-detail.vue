<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="title">{{ t.title }}</text>
        <text class="status" :class="statusClass(t.status)">{{ taskStatusLabel(t.status) }}</text>
      </view>

      <view class="edit-bar">
        <view class="edit-btn" @tap="edit">编辑</view>
      </view>

      <view class="facts">
        <view class="fact"><text class="k">类型</text><text class="v">{{ taskTypeLabel(t.type) }}</text></view>
        <view class="fact"><text class="k">优先级</text><text class="v">{{ priorityLabel(t.priority) }}</text></view>
        <view class="fact"><text class="k">公司</text><text class="v">{{ companyName }}</text></view>
        <view class="fact"><text class="k">负责人</text><text class="v">{{ responsible }}</text></view>
        <view class="fact"><text class="k">截止</text><text class="v" :class="{ od: isOverdue(t.dueDate) && t.status !== 'completed' }">{{ fmtDate(t.dueDate) }}</text></view>
        <view class="fact" v-if="t.completedDate"><text class="k">完成时间</text><text class="v">{{ fmtDateTime(t.completedDate) }}</text></view>
      </view>

      <view v-if="t.description" class="desc">
        <text class="desc-label">描述</text>
        <text class="desc-text">{{ t.description }}</text>
      </view>

      <view class="notes">
        <view class="notes-h">备注 ({{ (t.notes || []).length }})</view>
        <view v-for="(n, i) in (t.notes || [])" :key="i" class="note">
          <text class="note-author">{{ (n.createdBy && n.createdBy.name) || '—' }}</text>
          <text class="note-text">{{ n.content }}</text>
        </view>
        <view v-if="!(t.notes || []).length" class="note-empty">暂无备注</view>
      </view>

      <button v-if="t.status !== 'completed'" class="complete" :disabled="doing" @tap="complete">{{ doing ? '提交中…' : '标记为已完成' }}</button>

      <view class="add-note">
        <input class="note-input" v-model="noteText" placeholder="添加备注…" placeholder-class="ph" @confirm="addNote" />
        <text class="add-btn" @tap="addNote">发送</text>
      </view>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate, fmtDateTime, isOverdue, priorityLabel, taskStatusLabel, taskTypeLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', t: {}, loading: true, doing: false, noteText: '',
      companyName: '—', responsible: '—',
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  onPullDownRefresh() { this.load(true) },
  methods: {
    edit() { uni.navigateTo({ url: '/pages/task-form/task-form?id=' + this.id }) },
    fmtDate, fmtDateTime, isOverdue, priorityLabel, taskStatusLabel, taskTypeLabel,
    async load(pull) {
      try {
        const body = await request('/api/tasks/' + this.id)
        this.t = body.task || body || {}
        this.companyName = (this.t.company && this.t.company.name) || '—'
        this.responsible = (this.t.assignedTo && this.t.assignedTo.length)
          ? this.t.assignedTo.map(u => u.name).join('、')
          : (this.t.responsiblePerson || '未指派')
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        if (pull) uni.stopPullDownRefresh()
      }
    },
    statusClass(s) { return { completed: 's-success', overdue: 's-danger', in_progress: 's-warn' }[s] || 's-normal' },
    async complete() {
      this.doing = true
      try {
        await request('/api/tasks/' + this.id, { method: 'PUT', data: { status: 'completed' } })
        uni.showToast({ title: '已标记完成', icon: 'success' })
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '操作失败', icon: 'none' })
      } finally {
        this.doing = false
      }
    },
    async addNote() {
      const text = this.noteText.trim()
      if (!text) return
      try {
        await request('/api/tasks/' + this.id + '/notes', { method: 'POST', data: { content: text } })
        this.noteText = ''
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '添加失败', icon: 'none' })
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
.s-success { color: #059669; background: #ecfdf5; }
.s-danger { color: #dc2626; background: #fef2f2; }
.s-warn { color: #b45309; background: #fffbeb; }
.s-normal { color: #2563eb; background: #eff6ff; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.v.od { color: #dc2626; }
.desc { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 16rpx; }
.desc-label { display: block; font-size: 22rpx; color: #94a3b8; margin-bottom: 8rpx; }
.desc-text { font-size: 26rpx; color: #334155; line-height: 1.6; }
.notes { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 16rpx; }
.notes-h { font-size: 26rpx; font-weight: 600; color: #0f172a; margin-bottom: 12rpx; }
.note { padding: 14rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.note-author { display: block; font-size: 22rpx; color: #2563eb; }
.note-text { display: block; font-size: 26rpx; color: #334155; margin-top: 4rpx; }
.note-empty { font-size: 24rpx; color: #94a3b8; text-align: center; padding: 20rpx 0; }
.complete { width: 100%; height: 92rpx; line-height: 92rpx; background: #059669; color: #fff; font-size: 30rpx; border-radius: 16rpx; border: none; margin-bottom: 16rpx; }
.complete::after { border: none; }
.complete[disabled] { opacity: 0.6; }
.add-note { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 0 20rpx; border: 1rpx solid #e2e8f0; }
.note-input { flex: 1; height: 84rpx; font-size: 28rpx; color: #0f172a; }
.ph { color: #94a3b8; }
.add-btn { color: #2563eb; font-size: 28rpx; padding: 0 10rpx; }
.edit-bar { display: flex; justify-content: flex-end; padding: 0 4rpx 16rpx; }
.edit-btn { font-size: 26rpx; color: #2563EB; background: #eff6ff; padding: 10rpx 28rpx; border-radius: 999rpx; }
</style>
