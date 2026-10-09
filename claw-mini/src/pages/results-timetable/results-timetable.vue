<template>
  <view class="page">
    <view class="seg">
      <view class="seg-item" :class="{ active: tab === 'list' }" @tap="tab = 'list'">历史排期</view>
      <view class="seg-item" :class="{ active: tab === 'new' }" @tap="tab = 'new'">生成排期</view>
    </view>

    <!-- 历史列表 -->
    <block v-if="tab === 'list'">
      <view v-if="loading" class="state">加载中…</view>
      <view v-else-if="docs.length === 0" class="state">暂无排期记录，去「生成排期」创建</view>
      <view v-else>
        <view v-for="d in docs" :key="d._id" class="card" @tap="openDetail(d)">
          <view class="c-head">
            <text class="c-name">{{ (d.company && d.company.name) || '—' }}</text>
            <text class="c-period">{{ periodLabel(d.period) }}</text>
          </view>
          <view class="c-meta">
            <text>财年：{{ d.fiscalYear || '—' }}</text>
            <text>规则库 v{{ d.ruleLibraryVersion || '0' }}</text>
          </view>
          <text class="c-date">{{ fmtDate(d.createdAt) }}</text>
        </view>
      </view>
    </block>

    <!-- 生成表单 -->
    <block v-else>
      <view class="card">
        <view class="field">
          <text class="label">公司 *</text>
          <picker :range="companyNames" @change="onCompany">
            <view class="picker">{{ companyName || '选择公司' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">期间 *</text>
          <picker :range="periodOptions" range-key="label" @change="onPeriod">
            <view class="picker">{{ periodLabel(form.period) }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">财年（如 2026）</text>
          <input class="input" v-model="form.fiscalYear" placeholder="可选" />
        </view>
        <view class="field">
          <text class="label">股票代码</text>
          <input class="input" v-model="form.code" placeholder="可选" />
        </view>

        <text class="sub">关键日期（留空则由规则库推算）</text>
        <view v-for="k in anchorKeys" :key="k" class="field row">
          <text class="label">{{ k }} · {{ anchorHint(k) }}</text>
          <picker mode="date" :value="form.anchors[k]" @change="(e) => onAnchor(k, e)">
            <view class="picker sm">{{ form.anchors[k] || '选择' }}</view>
          </picker>
        </view>

        <button class="btn primary" :loading="generating" @tap="generate">生成排期</button>
      </view>

      <view v-if="result" class="card result">
        <text class="result-title">生成成功 · 共 {{ result.count }} 项任务</text>
        <text class="result-sub">规则库 v{{ result.ruleLibraryVersion }} · 已回写 {{ result.tasksCreated }} 条任务</text>

        <view v-if="complianceList.length" class="comp-block">
          <text class="comp-h">合规自检</text>
          <view v-for="(c, i) in complianceList" :key="i" class="comp-row">
            <text :class="c.pass ? 'ok' : 'bad'">{{ c.pass ? '✓' : '✕' }}</text>
            <view class="comp-main">
              <text class="comp-label">{{ c.label }}</text>
              <text v-if="c.detail" class="comp-detail">{{ c.detail }}</text>
            </view>
          </view>
        </view>
      </view>
    </block>

    <!-- 详情弹层 -->
    <view v-if="detail" class="mask" @tap="closeDetail">
      <view class="sheet" @tap.stop>
        <text class="sheet-title">{{ (detail.company && detail.company.name) || '排期详情' }}</text>
        <text class="sheet-sub">{{ periodLabel(detail.period) }} · 规则库 v{{ detail.ruleLibraryVersion || '0' }}</text>

        <scroll-view scroll-y class="sheet-body">
          <text class="sheet-h">主要事项（{{ (detail.items || []).length }}）</text>
          <view v-for="(it, i) in detail.items" :key="i" class="item">
            <text class="item-title">{{ it.title }}</text>
            <view class="item-meta">
              <text>{{ dateCell(it.startDate, it.endDate) }}</text>
              <text v-if="it.owner">· {{ it.owner }}</text>
              <text v-if="it.priority">· {{ it.priority }}</text>
            </view>
          </view>

          <text v-if="offsets.length" class="sheet-h">关键偏移量</text>
          <view v-for="(o, i) in offsets" :key="'o'+i" class="offset">
            <text class="off-name">{{ o.name }}</text>
            <text class="off-date">{{ o.date }}</text>
          </view>
        </scroll-view>

        <button class="btn ghost" @tap="closeDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { fmtDate } from '../../utils/format.js'

const PERIOD = [
  { value: 'annual', label: '年度' },
  { value: 'interim', label: '中期' },
]
const ANCHOR_KEYS = ['T0', 'T1', 'T2', 'T3', 'T4']
const ANCHOR_HINT = {
  T0: '结算日 / 年报基准日',
  T1: '股东周年大会(AGM)',
  T2: '申报截止基准',
  T3: '补充时点',
  T4: '补充时点',
}

export default {
  data() {
    return {
      tab: 'list',
      docs: [],
      loading: true,
      companies: [],
      companyNames: [],
      companyId: '',
      companyName: '',
      periodOptions: PERIOD,
      anchorKeys: ANCHOR_KEYS,
      form: { period: 'annual', fiscalYear: '', code: '', anchors: { T0: '', T1: '', T2: '', T3: '', T4: '' } },
      generating: false,
      result: null,
      detail: null,
      offsets: [],
      complianceList: [],
    }
  },
  onShow() {
    if (this.tab === 'list') this.loadList()
    this.loadCompanies()
  },
  methods: {
    fmtDate,
    periodLabel(p) { const o = PERIOD.find((x) => x.value === p); return o ? o.label : (p || '—') },
    anchorHint(k) { return ANCHOR_HINT[k] || '' },
    dateCell(s, e) {
      const a = fmtDate(s), b = fmtDate(e)
      if (a && b && a !== b) return a + ' — ' + b
      return a || b || ''
    },
    async loadCompanies() {
      try { const b = await request('/api/companies'); this.companies = (b && b.companies) || []; this.companyNames = this.companies.map((c) => c.name) } catch (e) {}
    },
    async loadList() {
      this.loading = true
      try { const b = await request('/api/results-timetable/list'); this.docs = (b && b.results) || [] } catch (e) { this.docs = [] } finally { this.loading = false }
    },
    onCompany(e) { const i = e.detail.value; this.companyId = this.companies[i]._id; this.companyName = this.companies[i].name },
    onPeriod(e) { this.form.period = PERIOD[e.detail.value].value },
    onAnchor(k, e) { this.form.anchors[k] = e.detail.value },
    async generate() {
      if (!this.companyId) { uni.showToast({ title: '请选择公司', icon: 'none' }); return }
      this.generating = true
      this.result = null
      try {
        const anchors = {}
        ANCHOR_KEYS.forEach((k) => { if (this.form.anchors[k]) anchors[k] = this.form.anchors[k] })
        const b = await request('/api/results-timetable/generate', {
          method: 'POST',
          data: {
            companyId: this.companyId,
            period: this.form.period,
            fiscalYear: this.form.fiscalYear || undefined,
            code: this.form.code || undefined,
            anchors,
          },
        })
        this.result = b
        this.complianceList = this.normalizeCompliance(b.compliance)
        uni.showToast({ title: '已生成', icon: 'success' })
        this.loadList()
      } catch (err) {
        uni.showToast({ title: (err && err.message) || '生成失败', icon: 'none' })
      } finally {
        this.generating = false
      }
    },
    normalizeCompliance(c) {
      if (!c) return []
      if (Array.isArray(c)) return c.map((x) => ({ label: x.label || x.name || '检查', pass: !!x.pass, detail: x.detail || x.message || '' }))
      return Object.keys(c).map((k) => ({ label: k, pass: !!c[k].pass, detail: (c[k] && c[k].detail) || '' }))
    },
    async openDetail(d) {
      try {
        const b = await request('/api/results-timetable/' + d._id)
        this.detail = (b && b.data) || {}
        this.offsets = (b && b.offsets) || []
        this.complianceList = this.normalizeCompliance(b && b.compliance)
      } catch (e) {
        uni.showToast({ title: '加载详情失败', icon: 'none' })
        return
      }
      // 详情弹层内也展示 items / offsets（来自 /:id 响应）
      this.detail.items = this.detail.items || []
    },
    closeDetail() { this.detail = null; this.offsets = []; this.complianceList = [] },
  },
}
</script>

<style scoped>
.page { padding: 24rpx; background: #f5f7fa; min-height: 100vh; box-sizing: border-box; }
.seg { display: flex; background: #fff; border-radius: 16rpx; padding: 8rpx; margin-bottom: 20rpx; }
.seg-item { flex: 1; text-align: center; height: 72rpx; line-height: 72rpx; font-size: 28rpx; color: #64748b; border-radius: 12rpx; }
.seg-item.active { background: #2563eb; color: #fff; font-weight: 600; }
.state { margin-top: 80rpx; text-align: center; font-size: 26rpx; color: #94a3b8; }
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.c-head { display: flex; align-items: center; justify-content: space-between; }
.c-name { font-size: 30rpx; font-weight: 700; color: #0f172a; }
.c-period { font-size: 22rpx; color: #2563eb; background: #eff6ff; border-radius: 20rpx; padding: 4rpx 16rpx; }
.c-meta { display: flex; gap: 30rpx; margin-top: 14rpx; font-size: 22rpx; color: #64748b; }
.c-date { display: block; margin-top: 8rpx; font-size: 20rpx; color: #94a3b8; }
.field { margin-bottom: 24rpx; }
.field.row { display: flex; align-items: center; justify-content: space-between; }
.label { display: block; font-size: 24rpx; color: #475569; margin-bottom: 10rpx; }
.field.row .label { margin-bottom: 0; }
.picker { height: 84rpx; line-height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.picker.sm { height: 70rpx; line-height: 70rpx; padding: 0 20rpx; font-size: 26rpx; }
.input { width: 100%; box-sizing: border-box; height: 84rpx; background: #f8fafc; border: 1rpx solid #e2e8f0; border-radius: 14rpx; padding: 0 24rpx; font-size: 28rpx; color: #0f172a; }
.sub { display: block; font-size: 24rpx; color: #94a3b8; margin: 8rpx 0 12rpx; }
.btn { width: 100% !important; box-sizing: border-box; height: 88rpx; line-height: 88rpx; border-radius: 16rpx; font-size: 28rpx; border: none; text-align: center; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #475569; border: 1rpx solid #cbd5e1; margin-top: 12rpx; }
.btn::after { border: none; }
.result { background: #ecfdf5; }
.result-title { font-size: 30rpx; font-weight: 700; color: #059669; display: block; }
.result-sub { font-size: 22rpx; color: #047857; margin-top: 6rpx; display: block; }
.comp-block { margin-top: 18rpx; border-top: 1rpx solid #d1fae5; padding-top: 14rpx; }
.comp-h { font-size: 24rpx; font-weight: 700; color: #065f46; }
.comp-row { display: flex; align-items: flex-start; padding: 10rpx 0; }
.comp-row .ok { color: #059669; font-weight: 700; margin-right: 12rpx; }
.comp-row .bad { color: #dc2626; font-weight: 700; margin-right: 12rpx; }
.comp-main { flex: 1; display: flex; flex-direction: column; }
.comp-label { font-size: 24rpx; color: #0f172a; }
.comp-detail { font-size: 20rpx; color: #64748b; margin-top: 2rpx; }
.mask { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: flex-end; z-index: 100; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 36rpx 32rpx; box-sizing: border-box; max-height: 82vh; display: flex; flex-direction: column; }
.sheet-title { font-size: 32rpx; font-weight: 700; color: #0f172a; }
.sheet-sub { font-size: 22rpx; color: #64748b; margin-top: 6rpx; }
.sheet-body { flex: 1; margin-top: 20rpx; }
.sheet-h { display: block; font-size: 24rpx; font-weight: 700; color: #334155; margin: 16rpx 0 10rpx; }
.item { background: #f8fafc; border-radius: 14rpx; padding: 18rpx; margin-bottom: 12rpx; }
.item-title { font-size: 26rpx; color: #0f172a; display: block; }
.item-meta { font-size: 22rpx; color: #64748b; margin-top: 6rpx; }
.offset { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.off-name { font-size: 24rpx; color: #334155; }
.off-date { font-size: 24rpx; color: #2563eb; }
</style>
