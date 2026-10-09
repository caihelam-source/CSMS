<template>
  <view class="page">
    <view class="form">
      <view class="field">
        <text class="label">文件*</text>
        <view class="file-box" @tap="chooseFile">
          <text v-if="file" class="file-name">{{ file.name }}</text>
          <text v-else class="file-ph">点击选择文件（PDF / Word / 图片等，≤50MB）</text>
          <text class="file-size" v-if="file">{{ fmtSize(file.size) }}</text>
        </view>
      </view>
      <view class="field">
        <text class="label">文档标题</text>
        <input class="input" v-model="form.title" placeholder="留空则取文件名" />
      </view>
      <view class="field">
        <text class="label">类型</text>
        <picker :range="typeOptions" range-key="label" @change="onType">
          <view class="picker">{{ typeLabel(form.type) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">归属公司</text>
        <picker :range="companyNames" @change="onCompany">
          <view class="picker">{{ companyName || '选择公司（可选）' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">描述</text>
        <textarea class="textarea" v-model="form.description" placeholder="可选" />
      </view>
      <view class="field row">
        <text class="label">机密文件</text>
        <switch :checked="form.isConfidential" @change="e => form.isConfidential = e.detail.value" color="#2563EB" />
      </view>

      <button class="submit" :loading="uploading" :disabled="!file" @tap="submit">{{ uploading ? '上传中…' : '上传文档' }}</button>
    </view>
  </view>
</template>

<script>
import { API_BASE } from '../../config.js'
import { getToken } from '../../utils/auth.js'
import { request } from '../../utils/request.js'

const TYPE = [
  { value: 'other', label: '其他' },
  { value: 'minutes', label: '会议纪要' },
  { value: 'resolution', label: '决议' },
  { value: 'agreement', label: '协议' },
  { value: 'form', label: '表格' },
  { value: 'certificate', label: '证书' },
  { value: 'return', label: '申报表' },
  { value: 'notice', label: '通知' },
  { value: 'annual_report', label: '年报' },
  { value: 'financial_statement', label: '财务报表' },
  { value: 'id_document', label: '身份证件' },
  { value: 'incorporation_doc', label: '成立文件' },
  { value: 'nar1_return', label: 'NAR1' },
  { value: 'nn3_return', label: 'NN3' },
  { value: 'business_registration', label: '商业登记' },
]

export default {
  data() {
    return {
      file: null,
      uploading: false,
      companies: [], companyNames: [], companyId: '', companyName: '',
      typeOptions: TYPE,
      form: { title: '', type: 'other', description: '', isConfidential: false },
    }
  },
  onLoad() { this.loadCompanies() },
  methods: {
    typeLabel(v) { const o = TYPE.find(t => t.value === v); return o ? o.label : '未知' },
    onType(e) { this.form.type = TYPE[e.detail.value].value },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    fmtSize(b) {
      if (!b && b !== 0) return ''
      if (b < 1024) return b + ' B'
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
      return (b / 1024 / 1024).toFixed(1) + ' MB'
    },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = b.companies || []; this.companyNames = this.companies.map(c => c.name) } catch (e) {}
    },
    chooseFile() {
      uni.chooseFile({
        count: 1,
        type: 'all',
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0]
          if (!f) return
          // 50MB 上限（与后端 multer limit 对齐）
          if (f.size > 50 * 1024 * 1024) { uni.showToast({ title: '文件超过 50MB 限制', icon: 'none' }); return }
          this.file = f
          if (!this.form.title) {
            const base = (f.name || '').replace(/\.[^/.]+$/, '')
            this.form.title = base || ''
          }
        },
        fail: (e) => { uni.showToast({ title: (e && e.errMsg) || '选择失败', icon: 'none' }) },
      })
    },
    submit() {
      if (!this.file) { uni.showToast({ title: '请先选择文件', icon: 'none' }); return }
      this.uploading = true
      const token = getToken()
      const formData = {
        title: this.form.title || this.file.name,
        type: this.form.type,
        description: this.form.description || undefined,
        isConfidential: this.form.isConfidential ? 'true' : 'false',
      }
      if (this.companyId) formData.company = this.companyId
      uni.uploadFile({
        url: API_BASE + '/api/documents',
        filePath: this.file.path,
        name: 'file',
        formData,
        header: token ? { Authorization: 'Bearer ' + token } : {},
        success: (res) => {
          try {
            const body = JSON.parse(res.data)
            if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
              uni.showToast({ title: '已上传', icon: 'success' })
              setTimeout(() => uni.navigateBack(), 600)
            } else {
              uni.showToast({ title: (body && body.message) || '上传失败', icon: 'none' })
            }
          } catch (e) {
            uni.showToast({ title: '上传失败（响应解析错误）', icon: 'none' })
          }
        },
        fail: (e) => { uni.showToast({ title: (e && e.errMsg) || '网络错误', icon: 'none' }) },
        complete: () => { this.uploading = false },
      })
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
.file-box { display: flex; flex-direction: column; background: #f8fafc; border: 1rpx dashed #cbd5e1; border-radius: 14rpx; padding: 24rpx; min-height: 96rpx; justify-content: center; }
.file-name { font-size: 28rpx; color: #0f172a; word-break: break-all; }
.file-ph { font-size: 26rpx; color: #94a3b8; }
.file-size { font-size: 22rpx; color: #64748b; margin-top: 8rpx; }
.input, .picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.textarea { width: 100%; height: 160rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #0f172a; }
.submit { margin-top: 12rpx; background: #2563EB; color: #fff; font-size: 30rpx; border-radius: 16rpx; height: 92rpx; line-height: 92rpx; }
.submit[disabled] { opacity: 0.5; }
</style>
