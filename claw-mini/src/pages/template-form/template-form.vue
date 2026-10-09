<template>
  <view class="page">
    <view class="card">
      <view class="field">
        <text class="field-label">模板名称 *</text>
        <input class="input" v-model="name" placeholder="如：董事会决议" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field-label">分类</text>
        <picker :range="categoryLabels" @change="onCat">
          <view class="picker">{{ categoryLabel }}<text class="caret">▾</text></view>
        </picker>
      </view>

      <view class="field">
        <text class="field-label">说明</text>
        <textarea class="textarea" v-model="description" placeholder="模板用途说明（可选）" placeholder-class="ph" />
      </view>

      <view class="sub-h">字段 (docSchema.fields)</view>
      <view v-for="(f, i) in fields" :key="i" class="frow">
        <view class="frow-top">
          <input class="fin" v-model="f.key" placeholder="字段 key（英文）" placeholder-class="ph" />
          <text class="del" @tap="removeField(i)">✕</text>
        </view>
        <view class="frow-bottom">
          <input class="fin" v-model="f.label" placeholder="显示名（可选）" placeholder-class="ph" />
          <picker :range="fieldTypeLabels" @change="(e) => onType(i, e)">
            <view class="ptype">{{ f.type }}<text class="caret">▾</text></view>
          </picker>
        </view>
      </view>
      <view v-if="!fields.length" class="empty">暂无字段，点击下方添加</view>
      <button class="add-field" @tap="addField">+ 添加字段</button>
    </view>

    <button class="submit" :disabled="submitting" @tap="submit">{{ submitting ? '保存中…' : (id ? '保存修改' : '创建模板') }}</button>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const CATEGORIES = [
  { value: 'board_resolution', label: '董事会决议' },
  { value: 'agm_resolution', label: '股东大会决议' },
  { value: 'minutes', label: '会议记录' },
  { value: 'director_change', label: '董事变更' },
  { value: 'secretary_change', label: '公司秘书变更' },
  { value: 'shareholder_notice', label: '股东通知' },
  { value: 'annual_report', label: '年度报告' },
  { value: 'internal_control', label: '内部监控' },
  { value: 'risk_management', label: '风险管理' },
  { value: 'ipo_filing', label: 'IPO 及申报' },
  { value: 'compliance_filing', label: '合规申报' },
  { value: 'project_governance', label: '项目治理' },
  { value: 'other', label: '其他' },
]
const FIELD_TYPES = ['text', 'textarea', 'date', 'select', 'boolean', 'list', 'clauses', 'checklist', 'objectList']

export default {
  data() {
    return {
      id: '',
      name: '',
      categoryIndex: 12,
      description: '',
      fields: [],
      submitting: false,
      categories: CATEGORIES,
    }
  },
  computed: {
    categoryLabels() { return this.categories.map(c => c.label) },
    categoryLabel() { return this.categories[this.categoryIndex] ? this.categories[this.categoryIndex].label : '其他' },
    categoryValue() { return this.categories[this.categoryIndex] ? this.categories[this.categoryIndex].value : 'other' },
    fieldTypeLabels() { return FIELD_TYPES },
  },
  onLoad(opt) {
    if (opt && opt.id) {
      this.id = opt.id
      this.loadTemplate(opt.id)
    }
  },
  methods: {
    async loadTemplate(id) {
      try {
        const body = await request('/api/templates/' + id)
        const t = body.template || {}
        this.name = t.name || ''
        this.description = t.description || ''
        const idx = this.categories.findIndex(c => c.value === t.category)
        this.categoryIndex = idx >= 0 ? idx : 12
        const fs = (t.docSchema && t.docSchema.fields) || []
        this.fields = fs.map(f => ({
          key: f.key || '',
          label: f.label || '',
          type: FIELD_TYPES.includes(f.type) ? f.type : 'text',
        }))
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      }
    },
    onCat(e) { this.categoryIndex = e.detail.value },
    onType(i, e) { this.fields[i].type = FIELD_TYPES[e.detail.value] },
    addField() { this.fields.push({ key: '', label: '', type: 'text' }) },
    removeField(i) { this.fields.splice(i, 1) },
    buildDocSchema() {
      const clean = []
      for (const f of this.fields) {
        if (!f.key || !f.key.trim()) continue
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.key.trim())) {
          throw new Error('字段 key「' + f.key + '」不合法（须英文开头、仅字母数字下划线）')
        }
        if (!FIELD_TYPES.includes(f.type)) {
          throw new Error('字段类型「' + f.type + '」不被支持')
        }
        clean.push({ key: f.key.trim(), label: (f.label && f.label.trim()) || f.key.trim(), type: f.type })
      }
      return { schemaVersion: 1, layoutMode: 'auto', fields: clean }
    },
    async submit() {
      if (!this.name || !this.name.trim()) {
        uni.showToast({ title: '请填写模板名称', icon: 'none' })
        return
      }
      let docSchema
      try {
        docSchema = this.buildDocSchema()
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const payload = {
          name: this.name.trim(),
          category: this.categoryValue,
          description: this.description || '',
          docSchema,
        }
        const url = this.id ? '/api/templates/' + this.id : '/api/templates'
        const method = this.id ? 'PUT' : 'POST'
        const body = await request(url, { method, data: payload })
        if (!body.success && !body.template) throw new Error(body.message || '保存失败')
        uni.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 60rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.field { margin-bottom: 24rpx; }
.field-label { display: block; font-size: 24rpx; font-weight: 600; color: #16213a; margin-bottom: 12rpx; }
.input, .textarea, .fin { width: 100%; box-sizing: border-box; background: #f8fafc; border: 2rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #16213a; }
.input, .fin { height: 88rpx; line-height: 88rpx; }
.textarea { padding: 20rpx 24rpx; height: 140rpx; }
.ph { color: #94a3b8; }
.picker { height: 88rpx; line-height: 88rpx; background: #f8fafc; border: 2rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #16213a; display: flex; justify-content: space-between; align-items: center; }
.caret { color: #94a3b8; margin-left: 12rpx; }
.sub-h { font-size: 26rpx; color: #0f172a; font-weight: 600; margin: 10rpx 0 16rpx; }
.frow { background: #f8fafc; border: 2rpx solid #e2e8f0; border-radius: 14rpx; padding: 16rpx; margin-bottom: 16rpx; }
.frow-top { display: flex; align-items: center; }
.frow-top .fin { flex: 1; margin-right: 12rpx; }
.del { color: #dc2626; font-size: 28rpx; padding: 0 8rpx; }
.frow-bottom { display: flex; align-items: center; margin-top: 12rpx; }
.frow-bottom .fin { flex: 1; margin-right: 12rpx; }
.ptype { background: #fff; border: 2rpx solid #e2e8f0; border-radius: 12rpx; padding: 0 18rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; color: #16213a; display: flex; align-items: center; }
.empty { text-align: center; color: #94a3b8; font-size: 26rpx; padding: 24rpx 0; }
.add-field { width: 100%; height: 80rpx; line-height: 80rpx; background: #eff6ff; color: #2563eb; font-size: 28rpx; border-radius: 14rpx; border: none; margin-top: 8rpx; }
.add-field::after { border: none; }
.submit { width: 100%; height: 92rpx; line-height: 92rpx; background: #2563EB; color: #fff; font-size: 30rpx; font-weight: 600; border-radius: 16rpx; border: none; margin-top: 28rpx; }
.submit::after { border: none; }
</style>
