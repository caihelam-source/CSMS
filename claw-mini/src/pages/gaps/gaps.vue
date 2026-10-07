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
        <!-- ④ 气泡提示：点标签，解释气泡从标签上方冒出，3 秒自动收回 -->
        <view class="tags">
          <view
            v-for="f in c.missingFields"
            :key="f"
            class="tag-wrap"
            @tap.stop="showBubble(c._id, f)"
          >
            <text class="tag">{{ fieldLabel(f) }}</text>
            <view v-if="bubbleKey === c._id + ':' + f" class="bubble">
              <view class="bubble-text">{{ fieldTip(f) }}</view>
              <view class="bubble-arrow" />
            </view>
          </view>
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
          <button class="btn primary" :disabled="submitting" @tap="askConfirm">提交补全</button>
        </view>
      </view>
    </view>

    <!-- ③ 确认弹窗：弹簧回弹弹出，确认后原地切换为完成状态 -->
    <view v-if="confirming" class="dlg-mask" @tap="confirmCancel">
      <view class="dlg" @tap.stop>
        <template v-if="!confirmDone">
          <view class="dlg-icon">↥</view>
          <view class="dlg-title">确认提交补全？</view>
          <view class="dlg-body">
            将为「{{ editTarget.name }}」补全 {{ filledCount }} 项，并自动重算 HK 合规提醒
          </view>
          <view class="dlg-actions">
            <button class="btn ghost" @tap="confirmCancel">再想想</button>
            <button class="btn primary" @tap="confirmOk">确认提交</button>
          </view>
        </template>
        <template v-else>
          <view class="dlg-check">✓</view>
          <view class="dlg-done-text">已确认，正在写入…</view>
        </template>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'

const FIELD_TIPS = {
  brExpiryDate: '商业登记证上的「届满日期」，可在 gov.hk 生意牌页查询',
  incorporationDate: '公司注册证明书(CI)上的成立日期，ICRIS 可查',
  financialYearEnd: '公司自订的年结日，决定周年申报表(NAR1)何时到期',
}

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
      // ③ 确认弹窗状态
      confirming: false,
      confirmDone: false,
      // ④ 气泡提示状态：'companyId:field' 定位到具体标签
      bubbleKey: '',
      bubbleTimer: null,
    }
  },
  onShow() {
    this.load()
  },
  onHide() {
    this.clearBubble()
  },
  computed: {
    filledCount() {
      const f = this.form
      return ['brExpiryDate', 'incorporationDate'].filter((k) => f[k]).length + (f.fyeMonth && f.fyeDay ? 1 : 0)
    },
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
    fieldTip(f) {
      return FIELD_TIPS[f] || '点卡片即可填写此项'
    },
    /* ④ 气泡：从被点标签上方冒出，3 秒自动收回；重复点击换内容重新计时 */
    showBubble(companyId, field) {
      this.clearBubble()
      this.bubbleKey = companyId + ':' + field
      this.bubbleTimer = setTimeout(() => {
        this.bubbleKey = ''
      }, 3000)
    },
    clearBubble() {
      if (this.bubbleTimer) {
        clearTimeout(this.bubbleTimer)
        this.bubbleTimer = null
      }
      this.bubbleKey = ''
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
      this.confirming = false
      this.confirmDone = false
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
    /* 校验通过后弹 ③ 确认弹窗（弹簧回弹进入） */
    askConfirm() {
      if (!this.filledCount) {
        uni.showToast({ title: '请至少填写一项', icon: 'none' })
        return
      }
      this.confirming = true
      this.confirmDone = false
    },
    confirmCancel() {
      if (this.confirmDone) return // 写入中不允许误触关闭
      this.confirming = false
    },
    /* 确认后原地切换状态（✓ 弹出），随后执行真实提交 */
    confirmOk() {
      this.confirmDone = true
      this.doSubmit()
    },
    async doSubmit() {
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
      this.submitting = true
      try {
        const r = await request('/api/companies/bulk-update', {
          method: 'POST',
          data: { updates: [upd] },
        })
        if (r.success === false) throw new Error(r.message || '更新失败')
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
        setTimeout(() => {
          this.confirming = false
          this.confirmDone = false
          uni.showToast({
            title: `已更新（改动 ${r.modified || 0} 项）`,
            icon: 'success',
          })
          this.load()
        }, 600)
      } catch (e) {
        this.confirming = false
        this.confirmDone = false
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
  color: var(--ink-900);
}
.sub {
  font-size: 26rpx;
  color: var(--ink-600);
  margin-left: 16rpx;
}
.center {
  text-align: center;
  color: var(--ink-600);
  padding: 160rpx 0;
  font-size: 30rpx;
}
.done {
  font-size: 34rpx;
  color: #059669;
}
.card {
  position: relative;
  background: var(--surface);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.04);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ink-900);
}
.jur {
  font-size: 24rpx;
  color: var(--blue-600);
  background: #eff6ff;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}
.tags {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}
/* ④ 每个标签独立定位容器，气泡从标签正上方冒出 */
.tag-wrap {
  position: relative;
  margin: 0 12rpx 12rpx 0;
}
.tag {
  display: inline-block;
  font-size: 22rpx;
  color: var(--amber-text);
  background: var(--amber-bg);
  border: 1rpx solid var(--amber-border);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.bubble {
  position: absolute;
  bottom: calc(100% + 14rpx);
  left: 0;
  z-index: 20;
  max-width: 460rpx;
  background: var(--ink-900);
  border-radius: 14rpx;
  padding: 14rpx 20rpx;
  animation: bubbleIn var(--dur-base) var(--ease-spring) both;
}
.bubble-text {
  color: #fff;
  font-size: 22rpx;
  line-height: 1.5;
}
.bubble-arrow {
  position: absolute;
  bottom: -8rpx;
  left: 28rpx;
  width: 16rpx;
  height: 16rpx;
  background: var(--ink-900);
  transform: rotate(45deg);
  border-radius: 2rpx;
}
@keyframes bubbleIn {
  0% {
    opacity: 0;
    transform: translateY(10rpx) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.arrow {
  position: absolute;
  right: 28rpx;
  bottom: 24rpx;
  color: var(--blue-600);
  font-size: 26rpx;
}
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 99;
}
.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: 28rpx 28rpx 0 0;
  padding: 36rpx 32rpx 48rpx;
}
.sheet-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--ink-900);
}
.sheet-sub {
  font-size: 24rpx;
  color: var(--ink-600);
  margin: 8rpx 0 24rpx;
}
.field {
  margin-bottom: 24rpx;
}
.label {
  font-size: 28rpx;
  color: var(--ink-600);
  display: block;
  margin-bottom: 12rpx;
}
.picker {
  background: #f3f4f6;
  border-radius: 12rpx;
  padding: 22rpx 24rpx;
  font-size: 30rpx;
  color: var(--ink-900);
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
  color: var(--ink-600);
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
  color: var(--ink-600);
}
.btn.primary {
  background: var(--blue-600);
  color: #fff;
}
.btn.primary[disabled] {
  opacity: 0.6;
}

/* ③ 确认弹窗：居中面板，弹簧回弹弹出 */
.dlg-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dlg {
  width: 600rpx;
  background: var(--surface);
  border-radius: 28rpx;
  padding: 44rpx 36rpx 36rpx;
  box-sizing: border-box;
  animation: dlgPop var(--dur-base) var(--ease-spring) both;
}
@keyframes dlgPop {
  0% {
    opacity: 0;
    transform: scale(0.82);
  }
  60% {
    opacity: 1;
    transform: scale(1.04);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
.dlg-icon {
  width: 88rpx;
  height: 88rpx;
  line-height: 84rpx;
  text-align: center;
  margin: 0 auto 20rpx;
  border-radius: 50%;
  background: #eff6ff;
  color: var(--blue-600);
  font-size: 44rpx;
  font-weight: 700;
}
.dlg-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ink-900);
  text-align: center;
}
.dlg-body {
  font-size: 26rpx;
  color: var(--ink-600);
  line-height: 1.6;
  text-align: center;
  margin: 14rpx 0 32rpx;
}
.dlg-actions {
  display: flex;
  gap: 20rpx;
}
/* 确认后原地切换：✓ 弹性放大，解释「这步被系统确认」 */
.dlg-check {
  width: 96rpx;
  height: 96rpx;
  line-height: 92rpx;
  text-align: center;
  margin: 8rpx auto 20rpx;
  border-radius: 50%;
  background: #ecfdf5;
  color: #059669;
  font-size: 48rpx;
  font-weight: 700;
  animation: checkPop var(--dur-slow) var(--ease-spring) both;
}
@keyframes checkPop {
  0% {
    transform: scale(0.4);
  }
  60% {
    transform: scale(1.24);
  }
  100% {
    transform: scale(1);
  }
}
.dlg-done-text {
  font-size: 28rpx;
  color: var(--ink-600);
  text-align: center;
  padding-bottom: 8rpx;
}
</style>
