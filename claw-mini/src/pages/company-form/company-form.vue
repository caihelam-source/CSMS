<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">公司名称（英文）*</text>
        <input class="input" v-model="form.name" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">公司中文名</text>
        <input class="input" v-model="form.nameChinese" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">注册编号</text>
        <input class="input" v-model="form.registrationNumber" placeholder="如 HK 1234567" />
      </view>
      <view class="field">
        <text class="label">注册地</text>
        <picker :range="jurOptions" range-key="label" @change="onJur">
          <view class="picker">{{ jurLabel(form.jurisdiction) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">公司类型</text>
        <picker :range="typeOptions" range-key="label" @change="onType">
          <view class="picker">{{ typeLabel(form.type) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" @change="onStatus">
          <view class="picker">{{ companyStatusLabel(form.status) }}</view>
        </picker>
      </view>
      <view class="field row">
        <text class="label">上市公司</text>
        <switch :checked="form.isListed" color="#2563EB" @change="e => form.isListed = e.detail.value" />
      </view>
      <view class="field">
        <text class="label">股票代码</text>
        <input class="input" v-model="form.stockCode" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">成立日期</text>
        <picker mode="date" :value="form.incDate" @change="e => form.incDate = e.detail.value">
          <view class="picker">{{ form.incDate || '选择日期' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">BR 到期日</text>
        <picker mode="date" :value="form.brDate" @change="e => form.brDate = e.detail.value">
          <view class="picker">{{ form.brDate || '选择日期' }}</view>
        </picker>
      </view>
      <view class="field row">
        <text class="label">在港注册非香港公司 (NN3)</text>
        <switch :checked="form.nonHongKongCompany" color="#2563EB" @change="e => form.nonHongKongCompany = e.detail.value" />
      </view>
      <view class="field">
        <text class="label">邮箱</text>
        <input class="input" v-model="form.email" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">电话</text>
        <input class="input" v-model="form.phone" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">业务性质</text>
        <input class="input" v-model="form.businessNature" placeholder="可选" />
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
import { jurLabel, companyStatusLabel } from '../../utils/format.js'

const JUR = [
  { value: 'HK', label: '香港' },
  { value: 'BVI', label: 'BVI' },
  { value: 'Cayman', label: '开曼' },
  { value: 'SG', label: '新加坡' },
  { value: 'OTHER', label: '其他' },
]
const TYPE = [
  { value: 'private_limited', label: '私人有限公司' },
  { value: 'public_limited', label: '公众有限公司' },
  { value: 'llp', label: '有限责任合伙' },
  { value: 'sole_proprietorship', label: '独资' },
  { value: 'partnership', label: '合伙' },
  { value: 'other', label: '其他' },
]
const STATUS = [
  { value: 'active', label: '存续' },
  { value: 'dormant', label: '休眠' },
  { value: 'struck_off', label: '已除名' },
  { value: 'winding_up', label: '清盘中' },
  { value: 'dissolved', label: '已解散' },
  { value: 'merged', label: '已合并' },
]

export default {
  data() {
    return {
      editId: '',
      saving: false,
      jurOptions: JUR,
      typeOptions: TYPE,
      statusOptions: STATUS,
      form: {
        name: '', nameChinese: '', registrationNumber: '',
        jurisdiction: 'HK', type: 'private_limited', status: 'active',
        isListed: false, stockCode: '', incDate: '', brDate: '',
        nonHongKongCompany: false, email: '', phone: '', businessNature: '', notes: '',
      },
    }
  },
  computed: {
    submitText() { return this.editId ? '保存修改' : '创建公司' },
  },
  onLoad(opt) {
    if (opt && opt.id) {
      this.editId = opt.id
      this.loadCompany()
    }
  },
  methods: {
    jurLabel, companyStatusLabel,
    typeLabel(v) { const o = TYPE.find(t => t.value === v); return o ? o.label : '未知' },
    onJur(e) { this.form.jurisdiction = JUR[e.detail.value].value },
    onType(e) { this.form.type = TYPE[e.detail.value].value },
    onStatus(e) { this.form.status = STATUS[e.detail.value].value },
    async loadCompany() {
      try {
        const body = await request('/api/companies/' + this.editId)
        const c = body.company || body
        this.form = {
          name: c.name || '',
          nameChinese: c.nameChinese || '',
          registrationNumber: c.registrationNumber || '',
          jurisdiction: c.jurisdiction || 'HK',
          type: c.type || 'private_limited',
          status: c.status || 'active',
          isListed: !!c.isListed,
          stockCode: c.stockCode || '',
          incDate: c.incorporationDate ? String(c.incorporationDate).slice(0, 10) : '',
          brDate: c.brExpiryDate ? String(c.brExpiryDate).slice(0, 10) : '',
          nonHongKongCompany: !!c.nonHongKongCompany,
          email: c.email || '',
          phone: c.phone || '',
          businessNature: c.businessNature || '',
          notes: c.notes || '',
        }
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      }
    },
    async submit() {
      if (!this.form.name || !this.form.name.trim()) {
        uni.showToast({ title: '请填写公司名称', icon: 'none' }); return
      }
      this.saving = true
      const f = this.form
      const payload = {
        name: f.name.trim(),
        nameChinese: f.nameChinese || undefined,
        registrationNumber: f.registrationNumber || undefined,
        jurisdiction: f.jurisdiction,
        type: f.type,
        status: f.status,
        isListed: f.isListed,
        stockCode: f.stockCode || undefined,
        incorporationDate: f.incDate || undefined,
        brExpiryDate: f.brDate || undefined,
        nonHongKongCompany: f.nonHongKongCompany,
        email: f.email || undefined,
        phone: f.phone || undefined,
        businessNature: f.businessNature || undefined,
        notes: f.notes || undefined,
      }
      try {
        if (this.editId) {
          await request('/api/companies/' + this.editId, { method: 'PUT', data: payload })
        } else {
          await request('/api/companies', { method: 'POST', data: payload })
        }
        uni.showToast({ title: this.editId ? '已更新' : '已创建', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; }
.form { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.field { margin-bottom: 28rpx; }
.field.row { display: flex; justify-content: space-between; align-items: center; }
.label { display: block; font-size: 26rpx; color: #475569; margin-bottom: 12rpx; }
.input, .picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.picker { color: #0f172a; }
.textarea { width: 100%; height: 160rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[loading] { opacity: 0.7; }
</style>
