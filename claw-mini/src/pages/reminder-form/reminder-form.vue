<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">标题*</text>
        <input class="input" v-model="form.title" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">所属公司*</text>
        <picker :range="companyNames" @change="onCompany">
          <view class="picker">{{ companyName || '选择公司' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">关联规则*</text>
        <picker :range="ruleNames" @change="onRule">
          <view class="picker">{{ ruleName || '选择规则' }}</view>
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
        <text class="label">提醒日期</text>
        <picker mode="date" :value="form.reminderDate" @change="e => form.reminderDate = e.detail.value">
          <view class="picker">{{ form.reminderDate || '选择日期' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">年度</text>
        <input class="input" v-model="form.year" placeholder="可选，如 2026" />
      </view>
      <view class="field">
        <text class="label">说明</text>
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

const PRIO = [
  { value: '高', label: '高' },
  { value: '中', label: '中' },
  { value: '低', label: '低' },
  { value: '紧急', label: '紧急' },
]
const STATUS = [
  { value: '待办', label: '待办' },
  { value: '处理中', label: '处理中' },
  { value: '已完成', label: '已完成' },
  { value: '已过期', label: '已过期' },
  { value: '已忽略', label: '已忽略' },
]

export default {
  data() {
    return {
      editId: '', saving: false,
      companies: [], companyNames: [], companyId: '', companyName: '',
      rules: [], ruleNames: [], ruleId: '', ruleName: '',
      prioOptions: PRIO, statusOptions: STATUS,
      form: { title: '', priority: '高', status: '待办', dueDate: '', reminderDate: '', year: '', description: '', notes: '' },
    }
  },
  computed: { submitText() { return this.editId ? '保存修改' : '创建提醒' } },
  onLoad(opt) {
    if (opt && opt.date) this.form.dueDate = opt.date
    this.loadCompanies(); this.loadRules()
    if (opt && opt.id) { this.editId = opt.id; this.loadReminder() }
  },
  methods: {
    prioLabel(v) { const o = PRIO.find(t => t.value === v); return o ? o.label : '高' },
    statusLabel(v) { const o = STATUS.find(t => t.value === v); return o ? o.label : '待办' },
    onPrio(e) { this.form.priority = PRIO[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    onRule(e) { const i = e.detail.value; this.ruleId = this.rules[i]._id; this.ruleName = this.rules[i].ruleName || this.rules[i].name || '规则' },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = b.companies || []; this.companyNames = this.companies.map(c => c.name) } catch (e) {}
    },
    async loadRules() {
      try { const b = await request('/api/compliance-rules'); this.rules = b.rules || []; this.ruleNames = this.rules.map(r => r.ruleName || r.name || '规则') } catch (e) {}
    },
    async loadReminder() {
      try {
        const b = await request('/api/compliance-reminders/' + this.editId)
        const r = b.reminder || b
        this.form = {
          title: r.title || '', priority: r.priority || '高', status: r.status || '待办',
          dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : '',
          reminderDate: r.reminderDate ? String(r.reminderDate).slice(0, 10) : '',
          year: r.year ? String(r.year) : '', description: r.description || '', notes: r.notes || '',
        }
        const cid = r.company && (r.company._id || r.company)
        if (cid) { const c = this.companies.find(x => x._id === cid); this.companyId = cid; this.companyName = c ? c.name : (r.company.name || '') }
        const rid = r.rule && (r.rule._id || r.rule)
        if (rid) { const rl = this.rules.find(x => x._id === rid); this.ruleId = rid; this.ruleName = rl ? (rl.ruleName || rl.name) : (r.rule.ruleName || '') }
      } catch (e) { uni.showToast({ title: e.message || '加载失败', icon: 'none' }) }
    },
    async submit() {
      if (!this.form.title || !this.form.title.trim()) { uni.showToast({ title: '请填写标题', icon: 'none' }); return }
      if (!this.companyId) { uni.showToast({ title: '请选择公司', icon: 'none' }); return }
      if (!this.ruleId) { uni.showToast({ title: '请选择规则', icon: 'none' }); return }
      this.saving = true
      const f = this.form
      const payload = {
        title: f.title.trim(), company: this.companyId, rule: this.ruleId,
        priority: f.priority, status: f.status,
        dueDate: f.dueDate || undefined, reminderDate: f.reminderDate || undefined,
        year: f.year ? Number(f.year) : undefined,
        description: f.description || undefined, notes: f.notes || undefined,
      }
      try {
        if (this.editId) await request('/api/compliance-reminders/' + this.editId, { method: 'PUT', data: payload })
        else await request('/api/compliance-reminders', { method: 'POST', data: payload })
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
.textarea { width: 100%; height: 150rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[loading] { opacity: 0.7; }
</style>
