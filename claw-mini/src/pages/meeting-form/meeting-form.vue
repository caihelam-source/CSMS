<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">会议主题*</text>
        <input class="input" v-model="form.title" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">所属公司*</text>
        <picker :range="companyNames" @change="onCompany">
          <view class="picker">{{ companyName || '选择公司' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">类型</text>
        <picker :range="typeOptions" range-key="label" @change="onType">
          <view class="picker">{{ typeLabel(form.type) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" @change="onStatus">
          <view class="picker">{{ statusLabel(form.status) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">日期</text>
        <picker mode="date" :value="form.scheduledAt" @change="e => form.scheduledAt = e.detail.value">
          <view class="picker">{{ form.scheduledAt || '选择日期' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">地点</text>
        <input class="input" v-model="form.location" placeholder="可选" />
      </view>
      <view class="field row">
        <text class="label">线上会议</text>
        <switch :checked="form.isVirtual" @change="e => form.isVirtual = e.detail.value" color="#2563EB" />
      </view>
      <view class="field">
        <text class="label">描述</text>
        <textarea class="textarea" v-model="form.description" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">备注</text>
        <textarea class="textarea" v-model="form.notes" placeholder="可选" />
      </view>

      <button class="submit" :loading="saving" @tap="submit">{{ submitText }}</button>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const TYPE = [
  { value: 'board', label: '董事会' },
  { value: 'agm', label: '股东大会' },
  { value: 'egm', label: '特别股东大会' },
  { value: 'committee', label: '委员会' },
  { value: 'other', label: '其他' },
]
const STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'scheduled', label: '已排期' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

export default {
  data() {
    return {
      editId: '', saving: false,
      companies: [], companyNames: [], companyId: '', companyName: '',
      typeOptions: TYPE, statusOptions: STATUS,
      form: { title: '', type: 'board', status: 'scheduled', scheduledAt: '', location: '', isVirtual: false, description: '', notes: '' },
    }
  },
  computed: { submitText() { return this.editId ? '保存修改' : '创建会议' } },
  onLoad(opt) {
    if (opt && opt.date) this.form.scheduledAt = opt.date
    this.loadCompanies()
    if (opt && opt.id) { this.editId = opt.id; this.loadMeeting() }
  },
  methods: {
    typeLabel(v) { const o = TYPE.find(t => t.value === v); return o ? o.label : '未知' },
    statusLabel(v) { const o = STATUS.find(t => t.value === v); return o ? o.label : '未知' },
    onType(e) { this.form.type = TYPE[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = b.companies || []; this.companyNames = this.companies.map(c => c.name) } catch (e) {}
    },
    async loadMeeting() {
      try {
        const b = await request('/api/meetings/' + this.editId)
        const m = b.meeting || b
        this.form = {
          title: m.title || '', type: m.type || 'board', status: m.status || 'scheduled',
          scheduledAt: m.scheduledAt ? String(m.scheduledAt).slice(0, 10) : '',
          location: m.location || '', isVirtual: !!m.isVirtual,
          description: m.description || '', notes: m.notes || '',
        }
        const cid = m.company && (m.company._id || m.company)
        if (cid) { const c = this.companies.find(x => x._id === cid); this.companyId = cid; this.companyName = c ? c.name : (m.company.name || '') }
      } catch (e) { uni.showToast({ title: e.message || '加载失败', icon: 'none' }) }
    },
    async submit() {
      if (!this.form.title || !this.form.title.trim()) { uni.showToast({ title: '请填写会议主题', icon: 'none' }); return }
      if (!this.companyId) { uni.showToast({ title: '请选择所属公司', icon: 'none' }); return }
      this.saving = true
      const f = this.form
      const payload = {
        title: f.title.trim(), type: f.type, status: f.status,
        scheduledAt: f.scheduledAt ? new Date(f.scheduledAt + 'T09:00:00').toISOString() : undefined,
        location: f.location || undefined, isVirtual: f.isVirtual,
        description: f.description || undefined, notes: f.notes || undefined,
        company: this.companyId,
      }
      try {
        if (this.editId) await request('/api/meetings/' + this.editId, { method: 'PUT', data: payload })
        else await request('/api/meetings', { method: 'POST', data: payload })
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
.field.row { display: flex; align-items: center; justify-content: space-between; }
.label { display: block; font-size: 26rpx; color: #475569; margin-bottom: 12rpx; }
.field.row .label { margin-bottom: 0; }
.input, .picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.textarea { width: 100%; height: 160rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[loading] { opacity: 0.7; }
</style>
