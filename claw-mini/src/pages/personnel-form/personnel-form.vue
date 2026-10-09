<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">姓名（英文）*</text>
        <input class="input" v-model="form.name" placeholder="必填" />
      </view>
      <view class="field">
        <text class="label">中文名</text>
        <input class="input" v-model="form.nameChinese" placeholder="可选" />
      </view>
      <view class="field">
        <text class="label">证件号 (NRIC)</text>
        <input class="input" v-model="form.nric" placeholder="可选，用于查重" />
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
        <text class="label">国籍</text>
        <input class="input" v-model="form.nationality" placeholder="可选" />
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

export default {
  data() {
    return {
      editId: '',
      saving: false,
      form: { name: '', nameChinese: '', nric: '', email: '', phone: '', nationality: '', notes: '' },
    }
  },
  computed: {
    submitText() { return this.editId ? '保存修改' : '创建人员' },
  },
  onLoad(opt) {
    if (opt && opt.id) {
      this.editId = opt.id
      this.loadPerson()
    }
  },
  methods: {
    async loadPerson() {
      try {
        const body = await request('/api/personnel/' + this.editId)
        const p = body.personnel || body
        this.form = {
          name: p.name || '',
          nameChinese: p.nameChinese || '',
          nric: p.nric || '',
          email: p.email || '',
          phone: p.phone || '',
          nationality: p.nationality || '',
          notes: p.notes || '',
        }
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      }
    },
    async submit() {
      if (!this.form.name || !this.form.name.trim()) {
        uni.showToast({ title: '请填写姓名', icon: 'none' }); return
      }
      this.saving = true
      const f = this.form
      const payload = {
        name: f.name.trim(),
        nameChinese: f.nameChinese || undefined,
        nric: f.nric || undefined,
        email: f.email || undefined,
        phone: f.phone || undefined,
        nationality: f.nationality || undefined,
        notes: f.notes || undefined,
      }
      try {
        if (this.editId) {
          await request('/api/personnel/' + this.editId, { method: 'PUT', data: payload })
        } else {
          await request('/api/personnel', { method: 'POST', data: payload })
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
.label { display: block; font-size: 26rpx; color: #475569; margin-bottom: 12rpx; }
.input, .picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.textarea { width: 100%; height: 160rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[loading] { opacity: 0.7; }
</style>
