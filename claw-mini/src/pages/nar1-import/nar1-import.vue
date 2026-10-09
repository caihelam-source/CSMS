<template>
  <view class="page">
    <view class="engine" :class="engine.ok ? 'on' : 'off'">
      <text class="e-ico">{{ engine.ok ? '✅' : '⚠️' }}</text>
      <view class="e-text">
        <text class="e-title">解析引擎{{ engine.ok ? '可用' : '不可用' }}</text>
        <text class="e-sub">{{ engine.ok ? '可识别 NAR1 / NN3 / BR PDF' : (engine.reason || '服务端缺少 pdfplumber 依赖') }}</text>
      </view>
    </view>

    <view class="actions">
      <button class="btn primary" @tap="chooseFiles" :disabled="!engine.ok">选择 PDF 文件</button>
      <button class="btn ghost" v-if="results.length" @tap="clearAll">清空</button>
    </view>

    <view v-if="parsing" class="state">解析中（{{ uploaded }}/{{ pending }}）…</view>

    <view v-for="(r, i) in results" :key="r.id" class="card">
      <view class="c-head">
        <text class="fname">{{ r.fileName }}</text>
        <text v-if="r.ok && r.hasConflict" class="flag">冲突</text>
        <text v-else-if="r.ok" class="flag ok">就绪</text>
        <text v-else class="flag bad">失败</text>
      </view>

      <view v-if="!r.ok" class="err">{{ r.error }}</view>

      <view v-else class="summary">
        <view class="s-row"><text class="s-k">公司</text><text class="s-v">{{ planOf(r).company.name }}</text></view>
        <view class="s-row"><text class="s-k">注册号</text><text class="s-v">{{ planOf(r).company.registrationNumber || '—' }}</text></view>
        <view class="s-row"><text class="s-k">表单</text><text class="s-v">{{ planOf(r).formType }}</text></view>
        <view class="s-row"><text class="s-k">结算日</text><text class="s-v">{{ planOf(r).document.madeUpDate || '—' }}</text></view>
        <view class="s-row"><text class="s-k">申报日</text><text class="s-v">{{ planOf(r).document.filedDate || '—' }}</text></view>
        <view class="s-row"><text class="s-k">人员/实体</text><text class="s-v">{{ (planOf(r).people || []).length }} / {{ (planOf(r).entities || []).length }}</text></view>
      </view>

      <view class="mode">
        <text class="label">导入方式</text>
        <picker :range="modeOptions(r)" range-key="label" @change="(e) => onMode(r, e)">
          <view class="picker">{{ modeLabel(r.mode) }}</view>
        </picker>
      </view>
    </view>

    <button v-if="results.length && canCommit" class="btn primary commit" :loading="committing" @tap="commit">提交导入（{{ commitCount }}）</button>

    <view v-if="summary" class="card summary-card">
      <text class="sc-title">导入完成</text>
      <text class="sc-line">导入 {{ summary.imported }} · 跳过 {{ summary.skipped }} · 失败 {{ summary.failed }}</text>
    </view>
  </view>
</template>

<script>
import { API_BASE } from '../../config.js'
import { getToken } from '../../utils/auth.js'
import { request } from '../../utils/request.js'

const MODE = {
  create: { value: 'create', label: '新建' },
  skip: { value: 'skip', label: '跳过' },
  overwrite: { value: 'overwrite', label: '覆盖' },
}

export default {
  data() {
    return {
      engine: { ok: false, reason: '' },
      results: [],
      parsing: false,
      uploaded: 0,
      pending: 0,
      committing: false,
      summary: null,
    }
  },
  onShow() { this.checkCapability() },
  computed: {
    canCommit() { return this.results.some((r) => r.ok) },
    commitCount() { return this.results.filter((r) => r.ok && r.mode !== 'skip').length },
  },
  methods: {
    planOf(r) { return (r.plan || { company: {}, document: {}, people: [], entities: [] }) },
    modeLabel(m) { return (MODE[m] && MODE[m].label) || '新建' },
    modeOptions(r) {
      const opts = [MODE.create, MODE.skip]
      if (r.hasConflict) opts.push(MODE.overwrite)
      return opts
    },
    onMode(r, e) {
      const opts = this.modeOptions(r)
      r.mode = opts[e.detail.value].value
    },
    async checkCapability() {
      try {
        const b = await request('/api/nar1-import/capability', { auth: false })
        this.engine = { ok: !!(b && b.engine && b.engine.ok), reason: (b && b.engine && b.engine.reason) || '' }
      } catch (e) {
        this.engine = { ok: false, reason: '探测失败' }
      }
    },
    chooseFiles() {
      uni.chooseFile({
        count: 10,
        type: 'file',
        extension: ['pdf'],
        success: (res) => {
          const files = (res.tempFiles || []).filter((f) => /\.pdf$/i.test(f.name || ''))
          if (!files.length) { uni.showToast({ title: '请选择 PDF 文件', icon: 'none' }); return }
          this.upload(files)
        },
        fail: (e) => { uni.showToast({ title: (e && e.errMsg) || '选择失败', icon: 'none' }) },
      })
    },
    async upload(files) {
      this.parsing = true
      this.summary = null
      this.uploaded = 0
      this.pending = files.length
      const token = getToken()
      for (const f of files) {
        await this.uploadOne(f, token)
        this.uploaded += 1
      }
      this.parsing = false
    },
    uploadOne(f, token) {
      return new Promise((resolve) => {
        uni.uploadFile({
          url: API_BASE + '/api/nar1-import/parse',
          filePath: f.path || f.file,
          name: 'files',
          header: token ? { Authorization: 'Bearer ' + token } : {},
          success: (res) => {
            try {
              const body = JSON.parse(res.data)
              if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
                const arr = body.results || []
                arr.forEach((x) => { x.mode = 'create' })
                this.results.push(...arr)
              } else {
                this.results.push({ id: Date.now() + Math.random(), fileName: f.name, ok: false, error: (body && body.message) || '解析失败' })
              }
            } catch (e) {
              this.results.push({ id: Date.now() + Math.random(), fileName: f.name, ok: false, error: '响应解析错误' })
            }
            resolve()
          },
          fail: (e) => {
            this.results.push({ id: Date.now() + Math.random(), fileName: f.name, ok: false, error: (e && e.errMsg) || '上传失败' })
            resolve()
          },
        })
      })
    },
    clearAll() { this.results = []; this.summary = null },
    async commit() {
      const items = this.results.filter((r) => r.ok && r.mode !== 'skip').map((r) => ({
        id: r.id,
        fileName: r.fileName,
        result: r.result,
        mode: r.mode,
        storage: r.storage || null,
      }))
      if (!items.length) { uni.showToast({ title: '没有可导入的项', icon: 'none' }); return }
      this.committing = true
      try {
        const b = await request('/api/nar1-import/commit', { method: 'POST', data: { items } })
        this.summary = (b && b.summary) || { imported: 0, skipped: 0, failed: 0 }
        uni.showToast({ title: '导入完成', icon: 'success' })
      } catch (err) {
        uni.showToast({ title: (err && err.message) || '提交失败', icon: 'none' })
      } finally {
        this.committing = false
      }
    },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; background: #f5f7fa; min-height: 100vh; box-sizing: border-box; }
.engine { display: flex; align-items: center; padding: 22rpx 24rpx; border-radius: 16rpx; margin-bottom: 20rpx; }
.engine.on { background: #ecfdf5; }
.engine.off { background: #fff7ed; }
.e-ico { font-size: 36rpx; margin-right: 14rpx; }
.e-text { display: flex; flex-direction: column; }
.e-title { font-size: 26rpx; font-weight: 700; color: #0f172a; }
.e-sub { font-size: 20rpx; color: #64748b; margin-top: 4rpx; }
.actions { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.btn { box-sizing: border-box; height: 84rpx; line-height: 84rpx; border-radius: 16rpx; font-size: 28rpx; border: none; text-align: center; flex: 1; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #475569; border: 1rpx solid #cbd5e1; }
.btn::after { border: none; }
.btn[disabled] { opacity: 0.5; }
.state { text-align: center; font-size: 26rpx; color: #2563eb; margin: 20rpx 0; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.c-head { display: flex; align-items: center; justify-content: space-between; }
.fname { font-size: 26rpx; font-weight: 600; color: #0f172a; word-break: break-all; flex: 1; margin-right: 12rpx; }
.flag { font-size: 20rpx; border-radius: 16rpx; padding: 2rpx 14rpx; background: #f1f5f9; color: #475569; }
.flag.ok { background: #ecfdf5; color: #059669; }
.flag.bad { background: #fef2f2; color: #dc2626; }
.err { font-size: 22rpx; color: #dc2626; margin-top: 12rpx; }
.summary { margin-top: 14rpx; background: #f8fafc; border-radius: 14rpx; padding: 16rpx; }
.s-row { display: flex; justify-content: space-between; padding: 6rpx 0; }
.s-k { font-size: 22rpx; color: #94a3b8; }
.s-v { font-size: 22rpx; color: #0f172a; }
.mode { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; }
.label { font-size: 24rpx; color: #475569; }
.picker { height: 64rpx; line-height: 64rpx; background: #eff6ff; color: #2563eb; border-radius: 12rpx; padding: 0 24rpx; font-size: 26rpx; }
.commit { margin-top: 10rpx; }
.summary-card { background: #ecfdf5; }
.sc-title { font-size: 28rpx; font-weight: 700; color: #059669; display: block; }
.sc-line { font-size: 24rpx; color: #047857; margin-top: 6rpx; display: block; }
</style>
