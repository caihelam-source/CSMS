<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">任务标题*</text>
        <input class="input" v-model="form.title" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">类型</text>
        <picker :range="typeOptions" range-key="label" @change="onType">
          <view class="picker">{{ typeLabel(form.type) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">所属公司*</text>
        <picker :range="companyNames" @change="onCompany">
          <view class="picker">{{ companyName || '选择公司' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">优先级</text>
        <picker :range="prioOptions" range-key="label" @change="onPrio">
          <view class="picker">{{ prioLabel(form.priority) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" @change="onStatus">
          <view class="picker">{{ statusLabel(form.status) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">截止日期*</text>
        <picker mode="date" :value="form.dueDate" @change="e => form.dueDate = e.detail.value">
          <view class="picker">{{ form.dueDate || '选择日期' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">负责人</text>
        <input class="input" v-model="form.responsiblePerson" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">描述</text>
        <textarea class="textarea" v-model="form.description" placeholder="可选" />
      </view>

      <button class="submit" :loading="saving" @tap="submit">{{ submitText }}</button>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const TYPE = [
  { value: 'filing', label: '申报' },
  { value: 'compliance', label: '合规' },
  { value: 'meeting_preparation', label: '会议准备' },
  { value: 'document_review', label: '文档审阅' },
  { value: 'signing', label: '签署' },
  { value: 'other', label: '其他' },
  { value: 'results_timetable', label: '业绩排期' },
]
const PRIO = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]
const STATUS = [
  { value: 'pending', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'overdue', label: '逾期' },
]

export default {
  data() {
    return {
      editId: '', saving: false,
      companies: [], companyNames: [], companyId: '', companyName: '',
      typeOptions: TYPE, prioOptions: PRIO, statusOptions: STATUS,
      form: { title: '', type: 'filing', priority: 'medium', status: 'pending', dueDate: '', responsiblePerson: '', description: '' },
    }
  },
  computed: { submitText() { return this.editId ? '保存修改' : '创建任务' } },
  onLoad(opt) {
    this.loadCompanies()
    if (opt && opt.id) { this.editId = opt.id; this.loadTask() }
  },
  methods: {
    typeLabel(v) { const o = TYPE.find(t => t.value === v); return o ? o.label : '未知' },
    prioLabel(v) { const o = PRIO.find(t => t.value === v); return o ? o.label : '未知' },
    statusLabel(v) { const o = STATUS.find(t => t.value === v); return o ? o.label : '未知' },
    onType(e) { this.form.type = TYPE[e.detail.value].value },
    onPrio(e) { this.form.priority = PRIO[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = b.companies || []; this.companyNames = this.companies.map(c => c.name) } catch (e) {}
    },
    async loadTask() {
      try {
        const b = await request('/api/tasks/' + this.editId)
        const t = b.task || b
        this.form = {
          title: t.title || '', type: t.type || 'filing', priority: t.priority || 'medium',
          status: t.status || 'pending', dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : '',
          responsiblePerson: t.responsiblePerson || '', description: t.description || '',
        }
        const cid = t.company && (t.company._id || t.company)
        if (cid) { const c = this.companies.find(x => x._id === cid); this.companyId = cid; this.companyName = c ? c.name : (t.company.name || '') }
      } catch (e) { uni.showToast({ title: e.message || '加载失败', icon: 'none' }) }
    },
    async submit() {
      if (!this.form.title || !this.form.title.trim()) { uni.showToast({ title: '请填写任务标题', icon: 'none' }); return }
      if (!this.companyId) { uni.showToast({ title: '请选择所属公司', icon: 'none' }); return }
      this.saving = true
      const f = this.form
      const payload = {
        title: f.title.trim(), type: f.type, priority: f.priority, status: f.status,
        dueDate: f.dueDate || undefined, responsiblePerson: f.responsiblePerson || undefined,
        description: f.description || undefined, company: this.companyId,
      }
      try {
        if (this.editId) await request('/api/tasks/' + this.editId, { method: 'PUT', data: payload })
        else await request('/api/tasks', { method: 'POST', data: payload })
        uni.showToast({ title: this.editId ? '已更新' : '已创建', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally { this.saving = false }
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; }
.form { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.field { margin-bottom: 28rpx; }
.label { display: block; font-size: 26rpx; color: #475569; margin-bottom: 12rpx; }
.input, .picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.textarea { width: 100%; height: 160rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[loading] { opacity: 0.7; }
</style>
