<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">规则编号*</text>
        <input class="input" v-model="form.ruleId" placeholder="如 HK_AR_42（唯一）" />
      </view>
      <view class="field">
        <text class="label">规则名称*</text>
        <input class="input" v-model="form.ruleName" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">类别</text>
        <input class="input" v-model="form.category" placeholder="如 公司注册处 / 税务局" />
      </view>
      <view class="field">
        <text class="label">适用地区*</text>
        <picker :range="jurOptions" range-key="label" @change="onJur">
          <view class="picker">{{ jurLabel(form.jurisdiction) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">公司主体范围</text>
        <picker :range="scopeOptions" range-key="label" @change="onScope">
          <view class="picker">{{ scopeLabel(form.companyScope) }}</view>
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
      <view class="field row">
        <text class="label">仅上市公司</text>
        <switch :checked="form.isListedOnly" @change="e => form.isListedOnly = e.detail.value" color="#2563EB" />
      </view>
      <view class="field">
        <text class="label">基准日类型</text>
        <picker :range="baseOptions" range-key="label" @change="onBase">
          <view class="picker">{{ baseLabel(form.baseDateType) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">基准日偏移（天/月）</text>
        <input class="input" v-model="form.baseDateOffset" placeholder="0" type="number" />
      </view>
      <view class="field">
        <text class="label">到期偏移（天）</text>
        <input class="input" v-model="form.dueDateOffset" placeholder="0" type="number" />
      </view>
      <view class="field">
        <text class="label">提醒天数（逗号分隔）</text>
        <input class="input" v-model="form.reminderDaysText" placeholder="如 30, 14, 7" />
      </view>
      <view class="field">
        <text class="label">说明</text>
        <textarea class="textarea" v-model="form.description" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">法规依据</text>
        <input class="input" v-model="form.legalReference" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">罚款说明</text>
        <textarea class="textarea" v-model="form.penaltyNote" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">特殊说明</text>
        <textarea class="textarea" v-model="form.specialNote" placeholder="可选" />
      </view>

      <button class="submit" :loading="saving" @tap="submit">{{ submitText }}</button>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { jurLabel } from '../../utils/format.js'

const JUR = [
  { value: 'HK', label: '香港' },
  { value: 'BVI', label: 'BVI' },
  { value: 'Cayman', label: '开曼' },
  { value: 'SG', label: '新加坡' },
  { value: 'OTHER', label: '其他' },
  { value: 'ALL', label: '全部' },
]
const SCOPE = [
  { value: 'ANY', label: '不限' },
  { value: 'HK_LOCAL', label: '香港本地（NAR1）' },
  { value: 'HK_NON_HK', label: '在港注册非香港公司（NN3）' },
]
const PRIO = [
  { value: '高', label: '高' },
  { value: '中', label: '中' },
  { value: '低', label: '低' },
  { value: '紧急', label: '紧急' },
]
const STATUS = [
  { value: '启用', label: '启用' },
  { value: '停用', label: '停用' },
]
const BASE = [
  { value: 'incorporationDate', label: '成立日' },
  { value: 'financialYearEnd', label: '财年结束' },
  { value: 'fixed', label: '固定日' },
  { value: 'trigger', label: '触发日' },
]

export default {
  data() {
    return {
      editId: '', saving: false,
      jurOptions: JUR, scopeOptions: SCOPE, prioOptions: PRIO, statusOptions: STATUS, baseOptions: BASE,
      form: {
        ruleId: '', ruleName: '', category: '', jurisdiction: 'HK', companyScope: 'ANY',
        priority: '高', status: '启用', isListedOnly: false,
        baseDateType: 'incorporationDate', baseDateOffset: 0, dueDateOffset: 0,
        reminderDaysText: '', description: '', legalReference: '', penaltyNote: '', specialNote: '',
      },
    }
  },
  computed: { submitText() { return this.editId ? '保存修改' : '创建规则' } },
  onLoad(opt) {
    if (opt && opt.id) { this.editId = opt.id; this.loadRule() }
  },
  methods: {
    jurLabel,
    scopeLabel(v) { const o = SCOPE.find(t => t.value === v); return o ? o.label : '未知' },
    prioLabel(v) { const o = PRIO.find(t => t.value === v); return o ? o.label : '未知' },
    statusLabel(v) { const o = STATUS.find(t => t.value === v); return o ? o.label : '未知' },
    baseLabel(v) { const o = BASE.find(t => t.value === v); return o ? o.label : '未知' },
    onJur(e) { this.form.jurisdiction = JUR[e.detail.value].value },
    onScope(e) { this.form.companyScope = SCOPE[e.detail.value].value },
    onPrio(e) { this.form.priority = PRIO[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    onBase(e) { this.form.baseDateType = BASE[e.detail.value].value },
    async loadRule() {
      try {
        const b = await request('/api/compliance-rules/' + this.editId)
        const r = b.rule || b
        this.form = {
          ruleId: r.ruleId || '', ruleName: r.ruleName || '', category: r.category || '',
          jurisdiction: r.jurisdiction || 'HK', companyScope: r.companyScope || 'ANY',
          priority: r.priority || '高', status: r.status || '启用', isListedOnly: !!r.isListedOnly,
          baseDateType: r.baseDateType || 'incorporationDate',
          baseDateOffset: r.baseDateOffset || 0, dueDateOffset: r.dueDateOffset || 0,
          reminderDaysText: (r.reminderDays || []).join(', '),
          description: r.description || '', legalReference: r.legalReference || '',
          penaltyNote: r.penaltyNote || '', specialNote: r.specialNote || '',
        }
      } catch (e) { uni.showToast({ title: e.message || '加载失败', icon: 'none' }) }
    },
    async submit() {
      if (!this.form.ruleId || !this.form.ruleId.trim()) { uni.showToast({ title: '请填写规则编号', icon: 'none' }); return }
      if (!this.form.ruleName || !this.form.ruleName.trim()) { uni.showToast({ title: '请填写规则名称', icon: 'none' }); return }
      this.saving = true
      const f = this.form
      const reminderDays = f.reminderDaysText
        ? f.reminderDaysText.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
        : []
      const payload = {
        ruleId: f.ruleId.trim(), ruleName: f.ruleName.trim(), category: f.category || undefined,
        jurisdiction: f.jurisdiction, companyScope: f.companyScope, priority: f.priority,
        status: f.status, isListedOnly: f.isListedOnly,
        baseDateType: f.baseDateType,
        baseDateOffset: Number(f.baseDateOffset) || 0, dueDateOffset: Number(f.dueDateOffset) || 0,
        reminderDays, description: f.description || undefined,
        legalReference: f.legalReference || undefined, penaltyNote: f.penaltyNote || undefined,
        specialNote: f.specialNote || undefined,
      }
      try {
        if (this.editId) await request('/api/compliance-rules/' + this.editId, { method: 'PUT', data: payload })
        else await request('/api/compliance-rules', { method: 'POST', data: payload })
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
