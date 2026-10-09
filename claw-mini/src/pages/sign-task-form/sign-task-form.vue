<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">任务标题*</text>
        <input class="input" v-model="form.title" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">关联文档*</text>
        <picker :range="docNames" @change="onDoc">
          <view class="picker">{{ docName || '选择文档' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">所属公司*</text>
        <picker :range="companyNames" @change="onCompany">
          <view class="picker">{{ companyName || '选择公司' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">签署顺序</text>
        <picker :range="orderOptions" range-key="label" @change="onOrder">
          <view class="picker">{{ orderLabel(form.signOrder) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" @change="onStatus">
          <view class="picker">{{ statusLabel(form.status) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">截止日期</text>
        <picker mode="date" :value="form.deadline" @change="e => form.deadline = e.detail.value">
          <view class="picker">{{ form.deadline || '选择日期' }}</view>
        </picker>
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

const ORDER = [
  { value: 'sequential', label: '顺序签署' },
  { value: 'parallel', label: '并行签署' },
]
const STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'in_progress', label: '签署中' },
  { value: 'completed', label: '已完成' },
  { value: 'expired', label: '已过期' },
  { value: 'cancelled', label: '已取消' },
]

export default {
  data() {
    return {
      editId: '', saving: false,
      documents: [], docNames: [], docId: '', docName: '',
      companies: [], companyNames: [], companyId: '', companyName: '',
      orderOptions: ORDER, statusOptions: STATUS,
      form: { title: '', signOrder: 'sequential', status: 'draft', deadline: '', description: '' },
    }
  },
  computed: { submitText() { return this.editId ? '保存修改' : '创建签署任务' } },
  onLoad(opt) {
    this.loadDocuments()
    this.loadCompanies()
    if (opt && opt.id) { this.editId = opt.id; this.loadTask() }
  },
  methods: {
    orderLabel(v) { const o = ORDER.find(t => t.value === v); return o ? o.label : '未知' },
    statusLabel(v) { const o = STATUS.find(t => t.value === v); return o ? o.label : '未知' },
    onOrder(e) { this.form.signOrder = ORDER[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    onDoc(e) { const i = e.detail.value; this.docId = this.documents[i]._id; this.docName = this.documents[i].title },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    async loadDocuments() {
      try { const b = await request('/api/documents'); this.documents = b.documents || []; this.docNames = this.documents.map(d => d.title) } catch (e) {}
    },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = b.companies || []; this.companyNames = this.companies.map(c => c.name) } catch (e) {}
    },
    async loadTask() {
      try {
        const b = await request('/api/sign-tasks/' + this.editId)
        const t = b.task || b
        this.form = {
          title: t.title || '', signOrder: t.signOrder || 'sequential', status: t.status || 'draft',
          deadline: t.deadline ? String(t.deadline).slice(0, 10) : '',
          description: t.description || '',
        }
        const did = t.document && (t.document._id || t.document)
        if (did) { const d = this.documents.find(x => x._id === did); this.docId = did; this.docName = d ? d.title : (t.document.title || '') }
        const cid = t.company && (t.company._id || t.company)
        if (cid) { const c = this.companies.find(x => x._id === cid); this.companyId = cid; this.companyName = c ? c.name : (t.company.name || '') }
      } catch (e) { uni.showToast({ title: e.message || '加载失败', icon: 'none' }) }
    },
    async submit() {
      if (!this.form.title || !this.form.title.trim()) { uni.showToast({ title: '请填写任务标题', icon: 'none' }); return }
      if (!this.docId) { uni.showToast({ title: '请选择关联文档', icon: 'none' }); return }
      if (!this.companyId) { uni.showToast({ title: '请选择所属公司', icon: 'none' }); return }
      this.saving = true
      const f = this.form
      const payload = {
        title: f.title.trim(), signOrder: f.signOrder, status: f.status,
        deadline: f.deadline ? new Date(f.deadline + 'T18:00:00').toISOString() : undefined,
        description: f.description || undefined,
        document: this.docId, company: this.companyId,
      }
      try {
        if (this.editId) await request('/api/sign-tasks/' + this.editId, { method: 'PUT', data: payload })
        else await request('/api/sign-tasks', { method: 'POST', data: payload })
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
