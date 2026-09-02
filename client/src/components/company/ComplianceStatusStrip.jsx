// ComplianceStatusStrip — 公司简介页顶部「周年申报表 (NAR1/NN3)」与「商业登记证」双状态位。
// 数据来源 = 真实自动生成的合规提醒（ruleId HK_AR_42 / HK_NN3_AR / HK_BR_RENEW），与合规提醒模块单一事实源打通：
//   - 提醒存在：显示到期/续期倒计时与状态（已逾期 / 即将到期 / 有效 / 本年度已提交）
//   - 提醒缺失：提示缺字段（成立日期 / BR 到期日）或「提醒未生成」并可一键刷新
//   - 每个卡片可点击跳转合规 Tab 查看明细；右上「更新」按钮打开补录/续期弹窗
//   - 非香港公司标记 (nonHongKongCompany=true) → 显示 NN3 卡片（取代 NAR1）
// 术语（按 Vincent 纠正）：BR 全称「商业登记证」（Business Registration Certificate），不是"BR 证书"；
// NAR1/NN3 全称「周年申报表」（Annual Return），不是"NAR1 申报"或"周年申报表 NAR1"嵌套写法。
import { FileText, ShieldCheck, RefreshCw, Pencil, Globe2 } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

const NAR1_RULE = 'HK_AR_42'
const NN3_RULE  = 'HK_NN3_AR'
const BR_RULE   = 'HK_BR_RENEW'

function daysTo(date) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return Math.floor((d - new Date()) / (1000 * 60 * 60 * 24))
}

// 通用状态推导：返回 { tone, label }
// tone: success | warning | danger | muted
function deriveStatus(reminder, hasBaseField) {
  if (reminder) {
    if (reminder.status === '已完成') return { tone: 'success', label: '本年度已提交' }
    const d = daysTo(reminder.dueDate)
    if (d == null) return { tone: 'muted', label: '已排程' }
    if (d < 0) return { tone: 'danger', label: `已逾期 ${Math.abs(d)} 天` }
    if (d <= 42) return { tone: 'warning', label: `即将到期（剩 ${d} 天）` }
    return { tone: 'success', label: `有效（剩 ${d} 天）` }
  }
  if (!hasBaseField) return { tone: 'warning', label: '缺基础日期，无法生成提醒' }
  return { tone: 'muted', label: '提醒未生成' }
}

const TONE = {
  success: 'border-success/40 bg-success/10',
  warning: 'border-warning/40 bg-warning/10',
  danger: 'border-danger/40 bg-danger/10',
  muted: 'border-hairline bg-canvas/40',
}
const DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-ink-3',
}
const LABEL_COLOR = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-ink-2',
}

function Nar1Chip({ company, reminder, onUpdate, onView, onGenerate }) {
  const hasField = !!company.incorporationDate
  const st = deriveStatus(reminder, hasField)
  return (
    <button
      type="button"
      onClick={onView}
      className={`text-left card !p-4 border ${TONE[st.tone]} hover:shadow-2 transition-shadow flex items-start gap-3 w-full`}
    >
      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
        <FileText size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink-1">周年申报表 <span className="text-[10px] text-ink-3 font-normal">(NAR1)</span></p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${LABEL_COLOR[st.tone]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[st.tone]}`} />{st.label}
          </span>
        </div>
        <p className="text-xs text-ink-2 mt-1 truncate">
          {reminder
            ? `下次到期：${formatDate(reminder.dueDate)}`
            : hasField
              ? '提交后自动续排下一年度'
              : 'NAR1 表本就不印成立日期，请在基本信息录入后可自动生成'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onUpdate(reminder) }}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-surface border border-hairline text-ink-1 hover:bg-canvas font-medium"
        >
          <Pencil size={12} /> 更新
        </span>
        {!reminder && hasField && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onGenerate() }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-primary-600 hover:bg-primary-50 font-medium"
          >
            <RefreshCw size={12} /> 生成提醒
          </span>
        )}
      </div>
    </button>
  )
}

function Nn3Chip({ company, reminder, onUpdate, onView, onGenerate }) {
  const hasField = !!company.incorporationDate
  const st = deriveStatus(reminder, hasField)
  return (
    <button
      type="button"
      onClick={onView}
      className={`text-left card !p-4 border ${TONE[st.tone]} hover:shadow-2 transition-shadow flex items-start gap-3 w-full`}
    >
      <div className="w-10 h-10 rounded-xl bg-info/10 text-primary-700 flex items-center justify-center shrink-0">
        <Globe2 size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink-1">周年申报表 <span className="text-[10px] text-ink-3 font-normal">(NN3 · 非香港公司)</span></p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${LABEL_COLOR[st.tone]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[st.tone]}`} />{st.label}
          </span>
        </div>
        <p className="text-xs text-ink-2 mt-1 truncate">
          {reminder
            ? `下次到期：${formatDate(reminder.dueDate)}`
            : hasField
              ? '提交后自动续排下一年度'
              : '请在基本信息补「在港注册日期」后可自动生成 NN3 周年申报提醒'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onUpdate(reminder) }}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-surface border border-hairline text-ink-1 hover:bg-canvas font-medium"
        >
          <Pencil size={12} /> 更新
        </span>
        {!reminder && hasField && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onGenerate() }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-primary-600 hover:bg-primary-50 font-medium"
          >
            <RefreshCw size={12} /> 生成提醒
          </span>
        )}
      </div>
    </button>
  )
}

function BrChip({ company, reminder, onUpdate, onView, onGenerate }) {
  const hasField = !!company.brExpiryDate
  const st = deriveStatus(reminder, hasField)
  return (
    <button
      type="button"
      onClick={onView}
      className={`text-left card !p-4 border ${TONE[st.tone]} hover:shadow-2 transition-shadow flex items-start gap-3 w-full`}
    >
      <div className="w-10 h-10 rounded-xl bg-info/10 text-primary-700 flex items-center justify-center shrink-0">
        <ShieldCheck size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink-1">商业登记证 <span className="text-[10px] text-ink-3 font-normal">(BR)</span></p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${LABEL_COLOR[st.tone]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[st.tone]}`} />{st.label}
          </span>
        </div>
        <p className="text-xs text-ink-2 mt-1 truncate">
          {company.brExpiryDate
            ? `有效期至：${formatDate(company.brExpiryDate)}`
            : reminder
              ? `续期截止：${formatDate(reminder.dueDate)}`
              : 'BR 扫描件 OCR 在沙箱不可用，请在基本信息补「商业登记证到期日」后可自动续排提醒'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onUpdate(reminder) }}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-surface border border-hairline text-ink-1 hover:bg-canvas font-medium"
        >
          <Pencil size={12} /> 更新
        </span>
        {!reminder && hasField && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onGenerate() }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-primary-600 hover:bg-primary-50 font-medium"
          >
            <RefreshCw size={12} /> 生成提醒
          </span>
        )}
      </div>
    </button>
  )
}

export default function ComplianceStatusStrip({ company, reminders, onUpdateNar1, onUpdateBr, onViewReminders, onGenerate }) {
  if (!company || company.jurisdiction !== 'HK') return null
  const isNonHK = !!company.nonHongKongCompany
  const annualRule = isNonHK ? NN3_RULE : NAR1_RULE
  const annualReminder = reminders.find((r) => r.ruleId === annualRule)
  const br = reminders.find((r) => r.ruleId === BR_RULE)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {isNonHK ? (
        <Nn3Chip
          company={company}
          reminder={annualReminder}
          onView={onViewReminders}
          onUpdate={onUpdateNar1}
          onGenerate={() => onGenerate(NN3_RULE)}
        />
      ) : (
        <Nar1Chip
          company={company}
          reminder={annualReminder}
          onView={onViewReminders}
          onUpdate={onUpdateNar1}
          onGenerate={() => onGenerate(NAR1_RULE)}
        />
      )}
      <BrChip
        company={company}
        reminder={br}
        onView={onViewReminders}
        onUpdate={onUpdateBr}
        onGenerate={() => onGenerate(BR_RULE)}
      />
    </div>
  )
}
