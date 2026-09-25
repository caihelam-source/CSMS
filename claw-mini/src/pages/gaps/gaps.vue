<template>
  <view class="page">
    <view class="header">
      <text class="title">合规数据缺口</text>
      <text class="sub">共 {{ list.length }} 家待补全</text>
    </view>

    <view v-if="loading" class="center"><text>加载中…</text></view>

    <view v-else-if="list.length === 0" class="center">
      <text class="done">🎉 没有数据缺口</text>
    </view>

    <view v-else>
      <view v-for="c in list" :key="c._id" class="card" @tap="openEdit(c)">
        <view class="card-top">
          <text class="name">{{ c.name }}</text>
          <text class="jur">{{ jurLabel(c.jurisdiction) }}</text>
        </view>
        <view class="tags">
          <text v-for="f in c.missingFields" :key="f" class="tag">{{ fieldLabel(f) }}</text>
        </view>
        <text class="arrow">填写 ›</text>
      </view>
    </view>

    <!-- 底部抽屉：填写缺失字段 -->
    <view v-if="editTarget" class="mask" @tap="closeEdit">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">{{ editTarget.name }}</view>
        <view class="sheet-sub">只填你掌握的真实日期，空着不会改动库里其他值</view>

        <view v-if="has(editTarget, 'brExpiryDate')" class="field">
          <text class="label">商业登记到期日</text>
          <picker mode="date" :value="form.brExpiryDate" @change="onDate('brExpiryDate', $event)">
            <view class="picker">{{ form.brExpiryDate || '选择日期' }}</view>
          </picker>
        </view>

        <view v-if="has(editTarget, 'incorporationDate')" class="field">
          <text class="label">成立日期</text>
          <picker mode="date" :value="form.incorporationDate" @change="onDate('incorporationDate', $event)">
            <view class="picker">{{ form.incorporationDate || '选择日期' }}</view>
          </picker>
        </view>

        <view v-if="has(editTarget, 'financialYearEnd')" class="field">
          <text class="label">财政年度结算日</text>
          <view class="fye">
            <picker mode="selector" :range="months" :value="mIdx" @change="onMonth">
              <view class="picker small">{{ form.fyeMonth || '月' }}</view>
            </picker>
            <text class="dash">月 /</text>
            <picker mode="selector" :range="days" :value="dIdx" @change="onDay">
              <view class="picker small">{{ form.fyeDay || '日' }}</view>
            </picker>
            <text class="dash">日</text>
          </view>
        </view>

        <view class="sheet-actions">
          <button class="btn ghost" @tap="closeEdit">取消</button>
          <button class="btn primary" :disabled="submitting" :loading="submitting" @tap="submit">提交补全</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

export default {
  data() {
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1))
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1))
    return {
      loading: true,
      list: [],
      editTarget: null,
      submitting: false,
      form: { brExpiryDate: '', incorporationDate: '', fyeMonth: '', fyeDay: '' },
      days,
      months,
      mIdx: 0,
      dIdx: 0,
    }
  },
  onShow() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const body = await request('/api/compliance-rules/diagnose')
        const data = body.data || {}
        const all = data.companies || []
        this.list = all.filter((c) => c.missingFields && c.missingFields.length)
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    jurLabel(j) {
      const m = { HK: '香港', BVI: 'BVI', Cayman: '开曼', SG: '新加坡', OTHER: '其他' }
      return m[j] || j || ''
    },
    fieldLabel(f) {
      const m = {
        brExpiryDate: '商业登记到期日',
        incorporationDate: '成立日期',
        financialYearEnd: '财政年度结算日',
      }
      return m[f] || f
    },
    has(c, f) {
      return c.missingFields && c.missingFields.indexOf(f) >= 0
    },
    openEdit(c) {
      this.editTarget = c
      this.form = { brExpiryDate: '', incorporationDate: '', fyeMonth: '', fyeDay: '' }
      this.mIdx = 0
      this.dIdx = 0
    },
    closeEdit() {
      this.editTarget = null
    },
    onDate(key, e) {
      this.form[key] = e.detail.value
    },
    onMonth(e) {
      this.mIdx = e.detail.value
      this.form.fyeMonth = this.months[this.mIdx]
    },
    onDay(e) {
      this.dIdx = e.detail.value
      this.form.fyeDay = this.days[this.dIdx]
    },
    async submit() {
      const upd = { _id: this.editTarget._id }
      if (this.has(this.editTarget, 'brExpiryDate') && this.form.brExpiryDate) {
        upd.brExpiryDate = this.form.brExpiryDate
      }
      if (this.has(this.editTarget, 'incorporationDate') && this.form.incorporationDate) {
        upd.incorporationDate = this.form.incorporationDate
      }
      if (
        this.has(this.editTarget, 'financialYearEnd') &&
        this.form.fyeMonth &&
        this.form.fyeDay
      ) {
        upd.financialYearEndMonth = this.form.fyeMonth
        upd.financialYearEndDay = this.form.fyeDay
      }
      if (Object.keys(upd).length <= 1) {
        uni.showToast({ title: '请至少填写一项', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const r = await request('/api/companies/bulk-update', {
          method: 'POST',
          data: { updates: [upd] },
        })
        if (r.success === false) throw new Error(r.message || '更新失败')
        uni.showToast({
          title: `已更新（匹配 ${r.matched || 0}，改动 ${r.modified || 0}）`,
          icon: 'success',
        })
        // 自动重算相关合规提醒（BR 续期 / 周年申报 / NN3），与网页版一致
        try {
          await request('/api/compliance-reminders/ensure-all-hk', {
            method: 'POST',
            data: {},
          })
        } catch (e2) {
          console.warn('[ensure] 自动重算失败', e2)
          uni.showToast({ title: '已补全，但提醒重算需手动', icon: 'none' })
        }
        this.closeEdit()
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '提交失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
  },
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}
.header {
  margin: 16rpx 8rpx 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1f2937;
}
.sub {
  font-size: 26rpx;
  color: #6b7280;
  margin-left: 16rpx;
}
.center {
  text-align: center;
  color: #6b7280;
  padding: 160rpx 0;
  font-size: 30rpx;
}
.done {
  font-size: 34rpx;
  color: #059669;
}
.card {
  position: relative;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}
.jur {
  font-size: 24rpx;
  color: #2563eb;
  background: #eff6ff;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}
.tags {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}
.tag {
  font-size: 22rpx;
  color: #b45309;
  background: #fffbeb;
  border: 1rpx solid #fde68a;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin: 0 12rpx 12rpx 0;
}
.arrow {
  position: absolute;
  right: 28rpx;
  bottom: 24rpx;
  color: #2563eb;
  font-size: 26rpx;
}
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 99;
}
.sheet {
  width: 100%;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding: 36rpx 32rpx 48rpx;
}
.sheet-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}
.sheet-sub {
  font-size: 24rpx;
  color: #6b7280;
  margin: 8rpx 0 24rpx;
}
.field {
  margin-bottom: 24rpx;
}
.label {
  font-size: 28rpx;
  color: #374151;
  display: block;
  margin-bottom: 12rpx;
}
.picker {
  background: #f3f4f6;
  border-radius: 12rpx;
  padding: 22rpx 24rpx;
  font-size: 30rpx;
  color: #111827;
}
.picker.small {
  padding: 18rpx 20rpx;
  text-align: center;
  min-width: 96rpx;
}
.fye {
  display: flex;
  align-items: center;
}
.dash {
  margin: 0 12rpx;
  color: #6b7280;
  font-size: 28rpx;
}
.sheet-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 12rpx;
}
.btn {
  flex: 1;
  border-radius: 14rpx;
  padding: 24rpx 0;
  font-size: 30rpx;
  border: none;
}
.btn.ghost {
  background: #f3f4f6;
  color: #374151;
}
.btn.primary {
  background: #2563eb;
  color: #fff;
}
.btn.primary[disabled] {
  opacity: 0.6;
}
</style>
