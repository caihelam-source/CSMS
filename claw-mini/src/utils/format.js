// 通用格式化工具：日期 / 枚举标签 / 颜色映射。
// 全项目复用，避免各页面重复硬编码。

/* 日期：YYYY-MM-DD，非法返回占位符 */
export function fmtDate(d, placeholder = '—') {
  if (!d) return placeholder
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return placeholder
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* 日期时间：YYYY-MM-DD HH:mm */
export function fmtDateTime(d, placeholder = '—') {
  if (!d) return placeholder
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return placeholder
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  return `${fmtDate(d)} ${hh}:${mm}`
}

/* 是否逾期 */
export function isOverdue(d) {
  if (!d) return false
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return false
  return dt.getTime() < Date.now()
}

/* 距今还有多少天（正数未来，负数逾期） */
export function daysLeft(d) {
  if (!d) return null
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return null
  return Math.ceil((dt.getTime() - Date.now()) / (24 * 3600 * 1000))
}

/* 司法管辖区 */
export function jurLabel(j) {
  const m = { HK: '香港', BVI: 'BVI', Cayman: '开曼', SG: '新加坡', OTHER: '其他', ALL: '全部' }
  return m[j] || j || ''
}

/* 公司状态 */
export function companyStatusLabel(s) {
  const m = { active: '营运中', dormant: '休眠', dissolved: '已解散', merged: '已合并', pending: '待处理' }
  return m[s] || s || ''
}

/* 合规提醒状态 */
export function reminderStatusLabel(s) {
  const m = { 待办: '待办', 处理中: '处理中', 已完成: '已完成', 已过期: '已过期', 已忽略: '已忽略' }
  return m[s] || s || ''
}
export function reminderStatusType(s) {
  // 返回用于配色的类型：warn / danger / success / muted
  if (s === '已完成') return 'success'
  if (s === '已过期' || s === '已忽略') return 'muted'
  return 'warn'
}

/* 优先级（中文 高/中/低/紧急） */
export function priorityLabel(p) {
  const m = { 高: '高', 中: '中', 低: '低', 紧急: '紧急', urgent: '紧急', high: '高', medium: '中', low: '低' }
  return m[p] || p || ''
}
export function priorityType(p) {
  if (p === '紧急' || p === 'urgent') return 'danger'
  if (p === '高' || p === 'high') return 'warn'
  if (p === '低' || p === 'low') return 'muted'
  return 'normal'
}

/* 任务状态（英文枚举） */
export function taskStatusLabel(s) {
  const m = { pending: '待办', in_progress: '进行中', completed: '已完成', overdue: '逾期' }
  return m[s] || s || ''
}
export function taskStatusType(s) {
  if (s === 'completed') return 'success'
  if (s === 'overdue') return 'danger'
  if (s === 'in_progress') return 'warn'
  return 'normal'
}

/* 任务类型 */
export function taskTypeLabel(t) {
  const m = {
    filing: '申报', compliance: '合规', meeting_preparation: '会议准备',
    document_review: '文件审阅', signing: '签署', other: '其他', results_timetable: '业绩排期',
  }
  return m[t] || t || ''
}

/* 文档类型 */
export function docTypeLabel(t) {
  const m = {
    minutes: '会议纪要', resolution: '决议', agreement: '协议', form: '表格', certificate: '证书',
    return: '申报表', notice: '通知', memo: '备忘', annual_report: '年报', financial_statement: '财务报表',
    id_document: '身份证件', passport: '护照', proof_of_address: '地址证明', board_resolution: '董事会决议',
    incorporation_doc: '成立文件', ctc: '认证副本', business_registration: '商业登记', nar1_return: 'NAR1',
    nn3_return: 'NN3', other: '其他',
  }
  return m[t] || t || ''
}

/* 文档签署状态 */
export function signStatusLabel(s) {
  const m = {
    draft: '草稿', pending_sign: '待签署', pending_ctc: '待认证', partially_signed: '部分签署',
    fully_signed: '已签妥', ctc: '已认证', archived: '已归档',
  }
  return m[s] || s || ''
}

/* 会议类型 */
export function meetingTypeLabel(t) {
  const m = { board: '董事会', egm: '特别股东大会', agm: '股东大会', statutory: '法定会议', other: '其他' }
  return m[t] || t || ''
}

/* 会议状态 */
export function meetingStatusLabel(s) {
  const m = { scheduled: '已排期', completed: '已完成', cancelled: '已取消', draft: '草稿' }
  return m[s] || s || ''
}

/* 签署任务状态 */
export function signTaskStatusLabel(s) {
  const m = { pending: '待发起', in_progress: '签署中', completed: '已完成', cancelled: '已取消' }
  return m[s] || s || ''
}

/* 模板分类 */
export function templateCategoryLabel(c) {
  const m = {
    incorporation: '公司成立', annual: '周年申报', meeting: '会议文书', resolution: '决议文书',
    filing: '申报表格', hr: '人事', finance: '财务', agreement: '协议', other: '其他',
  }
  return m[c] || c || ''
}
