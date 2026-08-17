// 日历事件聚合服务（Wave 日历模块）
// 把 6 类来源的「日期事件」统一成一种结构，供前端月视图 / Dashboard 面板消费。
// 关键：服务端聚合天然复用 scope 行级权限（applyListScope 按 accessibleCompanies 过滤）。
//
// 统一事件结构：
// {
//   id:        String   // 来源 _id
//   source:    String   // compliance_reminder | task | company_filing | document | meeting | results_timetable
//   module:    String   // 中文模块名（导航/着色用）
//   title:     String
//   date:      String   // ISO，事件锚定日
//   priority:  String   // urgent | high | medium | low
//   status:    String   // open | completed | overdue
//   overdue:   Boolean
//   companyId: String|null
//   companyName: String|null
//   link:      String   // 钻取回来源页的相对路径
// }

const ComplianceReminder = require('../models/ComplianceReminder')
const Task = require('../models/Task')
const Company = require('../models/Company')
const Document = require('../models/Document')
const Meeting = require('../models/Meeting')
const ResultsTimetable = require('../models/ResultsTimetable')
const CalendarEvent = require('../models/CalendarEvent')
const mongoose = require('mongoose')
const { applyListScope } = require('../middleware/scope')

const SOURCE_MODULE = {
  compliance_reminder: '合规提醒',
  task: '任务',
  company_filing: '公司申报',
  document: '文档',
  meeting: '会议',
  results_timetable: '业绩排期',
  user_event: '我的事件',
}

// 优先级归一化：合规提醒用「紧急/高/中/低」，任务用 urgent/high/medium/low
function normPriority(p) {
  if (!p) return 'medium'
  const s = String(p).toLowerCase()
  if (['紧急', 'urgent'].includes(s)) return 'urgent'
  if (['高', 'high'].includes(s)) return 'high'
  if (['低', 'low'].includes(s)) return 'low'
  return 'medium'
}

// 开放态（未完成）= 仍需要在日历上提醒
const OPEN_COMPLIANCE = ['待办', '处理中']
const OPEN_TASK = ['pending', 'in_progress']

function computeStatus(rawStatus, date, openSet) {
  const open = openSet.includes(rawStatus)
  const overdue = open && new Date(date) < new Date()
  return {
    status: overdue ? 'overdue' : open ? 'open' : 'completed',
    overdue,
    open,
  }
}

// 取公司可见名（populate 结果可能是对象或字符串 id）
function companyNameOf(company) {
  if (!company) return null
  if (typeof company === 'object') return company.name || company.nameChinese || null
  return null
}
function companyIdOf(company) {
  if (!company) return null
  return typeof company === 'object' ? String(company._id) : String(company)
}

/**
 * 聚合 [from, to] 区间内（含区间前未完成的逾期项）的日历事件。
 * @param {Object}  opts
 * @param {Date}    opts.from
 * @param {Date}    opts.to
 * @param {string[]} opts.types  可选，仅返回指定 source
 * @param {Object}  opts.req     Express req（用于 scope 过滤）
 * @returns {Promise<Array>} 统一事件数组
 */
async function getCalendarEvents({ from, to, types, req } = {}) {
  const want = (s) => !types || !types.length || types.includes(s)
  const events = []

  // ── 1. 合规提醒 ────────────────────────────────────────────
  if (want('compliance_reminder')) {
    const q = { dueDate: { $lte: to } }
    q.$or = [{ dueDate: { $gte: from } }, { dueDate: { $lt: from }, status: { $in: OPEN_COMPLIANCE } }]
    applyListScope(q, req, 'company')
    const rows = await ComplianceReminder.find(q)
      .populate('company', 'name nameChinese')
      .sort({ dueDate: 1 })
    for (const r of rows) {
      const { status, overdue, open } = computeStatus(r.status, r.dueDate, OPEN_COMPLIANCE)
      if (!open && new Date(r.dueDate) < from) continue // 已完成且早于区间 → 不显示
      events.push({
        id: String(r._id),
        source: 'compliance_reminder',
        module: SOURCE_MODULE.compliance_reminder,
        title: r.title,
        date: r.dueDate,
        priority: normPriority(r.priority),
        status, overdue,
        companyId: companyIdOf(r.company),
        companyName: companyNameOf(r.company),
        link: `/compliance-reminders/${r._id}`,
      })
    }
  }

  // ── 2. 任务 ────────────────────────────────────────────────
  if (want('task')) {
    const q = { dueDate: { $lte: to } }
    q.$or = [{ dueDate: { $gte: from } }, { dueDate: { $lt: from }, status: { $in: OPEN_TASK } }]
    applyListScope(q, req, 'company')
    const rows = await Task.find(q)
      .populate('company', 'name nameChinese')
      .sort({ dueDate: 1 })
    for (const t of rows) {
      const { status, overdue, open } = computeStatus(t.status, t.dueDate, OPEN_TASK)
      if (!open && new Date(t.dueDate) < from) continue
      events.push({
        id: String(t._id),
        source: 'task',
        module: SOURCE_MODULE.task,
        title: t.title,
        date: t.dueDate,
        priority: normPriority(t.priority),
        status, overdue,
        companyId: companyIdOf(t.company),
        companyName: companyNameOf(t.company),
        link: `/tasks/${t._id}`,
      })
    }
  }

  // ── 3. 公司申报（AGM/年审/税务/BR 到期 + 财年终点按年循环）──
  if (want('company_filing')) {
    const q = {}
    applyListScope(q, req, '_id')
    const rows = await Company.find(q).sort({ name: 1 })
    for (const c of rows) {
      const filings = extractFilingDates(c, from, to)
      for (const f of filings) {
        const d = f.date
        const overdue = d < from // 早于区间且未标记完成 → 视为逾期待办
        if (d < from && !overdue) continue
        events.push({
          id: `filing-${c._id}-${f.kind}`,
          source: 'company_filing',
          module: SOURCE_MODULE.company_filing,
          title: `${f.label} · ${c.name}`,
          date: d,
          priority: f.priority,
          status: overdue ? 'overdue' : 'open',
          overdue,
          companyId: String(c._id),
          companyName: c.name,
          link: `/companies/${c._id}`,
        })
      }
    }
  }

  // ── 4. 文档到期 / 续期 ─────────────────────────────────────
  if (want('document')) {
    const dateFields = ['expiresAt', 'renewalDueDate']
    for (const field of dateFields) {
      const q = { [field]: { $lte: to } }
      q.$or = [{ [field]: { $gte: from } }, { [field]: { $lt: from } }]
      applyListScope(q, req, 'company')
      const rows = await Document.find(q)
        .populate('company', 'name nameChinese')
        .sort({ [field]: 1 })
      for (const doc of rows) {
        const d = doc[field]
        if (!d) continue
        const overdue = new Date(d) < new Date()
        // 已完成（locked 归档）的到期文档不再提醒
        if (doc.locked && !overdue) continue
        if (new Date(d) < from && !overdue) continue
        events.push({
          id: `${field}-${doc._id}`,
          source: 'document',
          module: SOURCE_MODULE.document,
          title: `${field === 'renewalDueDate' ? '续期到期' : '文档到期'} · ${doc.name}`,
          date: d,
          priority: overdue ? 'high' : 'medium',
          status: overdue ? 'overdue' : 'open',
          overdue,
          companyId: companyIdOf(doc.company),
          companyName: companyNameOf(doc.company),
          link: doc.company ? `/companies/${companyIdOf(doc.company)}` : '/documents',
        })
      }
    }
  }

  // ── 5. 会议 ────────────────────────────────────────────────
  if (want('meeting')) {
    const q = { scheduledAt: { $gte: from, $lte: to } }
    applyListScope(q, req, 'company')
    const rows = await Meeting.find(q)
      .populate('company', 'name nameChinese')
      .sort({ scheduledAt: 1 })
    for (const m of rows) {
      events.push({
        id: String(m._id),
        source: 'meeting',
        module: SOURCE_MODULE.meeting,
        title: m.title,
        date: m.scheduledAt,
        priority: 'medium',
        status: m.status === 'completed' || m.status === 'cancelled' ? 'completed' : 'open',
        overdue: false,
        companyId: companyIdOf(m.company),
        companyName: companyNameOf(m.company),
        link: `/meetings/${m._id}`,
      })
    }
  }

  // ── 6. 业绩排期锚点（T0–T4）────────────────────────────────
  if (want('results_timetable')) {
    const anchors = ['T0', 'T1', 'T2', 'T3', 'T4']
    const labels = { T0: '财年截止', T1: '董事会/公告', T2: 'Printer 递交', T3: 'AGM', T4: 'AGM 后事项' }
    const q = {}
    applyListScope(q, req, 'company')
    const rows = await ResultsTimetable.find(q)
      .populate('company', 'name nameChinese')
    for (const rt of rows) {
      for (const a of anchors) {
        const d = rt.anchors && rt.anchors[a]
        if (!d) continue
        const dt = new Date(d)
        if (dt < from || dt > to) continue
        events.push({
          id: `rt-${rt._id}-${a}`,
          source: 'results_timetable',
          module: SOURCE_MODULE.results_timetable,
          title: `${labels[a]} · ${rt.name || rt.code || '业绩排期'}`,
          date: dt,
          priority: a === 'T1' || a === 'T2' ? 'high' : 'medium',
          status: 'open',
          overdue: false,
          companyId: companyIdOf(rt.company),
          companyName: companyNameOf(rt.company),
          link: `/results-timetable`,
        })
      }
    }
  }

  // ── 7. 用户自建事件（第 7 源 user_event）────────────────────
  // 权限遵循 Q4：
  //   - admin / auditor（req.scopeCompanies === null）：看全部
  //   - 其余角色：companyId ∈ scope  OR  createdBy === 本人
  if (want('user_event')) {
    const q = { date: { $gte: from, $lte: to } }
    if (req && req.scopeCompanies !== null) {
      const or = []
      if (Array.isArray(req.scopeCompanies) && req.scopeCompanies.length) {
        or.push({ companyId: { $in: req.scopeCompanies } })
      }
      if (req.user && req.user._id) {
        or.push({ createdBy: req.user._id })
      }
      if (or.length) q.$or = or
      else q._id = { $in: [] } // 明确无授权 → 空集合（绝不退化成不限）
    }
    const rows = await CalendarEvent.find(q)
      .populate('companyId', 'name nameChinese')
      .populate('createdBy', 'name email')
      .sort({ date: 1 })
    for (const ev of rows) {
      const companyId = ev.companyId ? String(ev.companyId._id) : null
      const companyName = ev.companyId ? ev.companyId.name || ev.companyId.nameChinese || null : null
      events.push({
        id: String(ev._id),
        source: 'user_event',
        module: SOURCE_MODULE.user_event,
        title: ev.title,
        date: ev.date,
        time: ev.time || null,
        allDay: ev.allDay !== false,
        priority: 'medium',
        status: 'open',
        overdue: false,
        companyId,
        companyName,
        link: '',
      })
    }
  }

  // 按日期升序
  events.sort((a, b) => new Date(a.date) - new Date(b.date))
  return events
}

// 是否为事件归属者或管理员（admin 可管理全部；auditor 仅只读，不可写）
function assertOwnershipOrAdmin(doc, user) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!doc.createdBy) return false
  return String(doc.createdBy) === String(user._id)
}

/**
 * 创建用户自建事件（第 7 源）。
 * @param {Object} payload { title, date, time?, allDay?, category?, note?, companyId? }
 * @param {Object} user    Express req.user（mongoose 文档）
 * @returns {Promise<Object>} 新建的 CalendarEvent 文档
 */
async function createEvent(payload = {}, user) {
  if (!payload || !payload.title || !payload.date) {
    const e = new Error('标题与日期为必填项')
    e.statusCode = 400
    throw e
  }
  const date = new Date(payload.date)
  if (isNaN(date.getTime())) {
    const e = new Error('日期格式无效')
    e.statusCode = 400
    throw e
  }
  const companyId =
    payload.companyId && mongoose.Types.ObjectId.isValid(payload.companyId) ? payload.companyId : null
  const doc = new CalendarEvent({
    title: String(payload.title).trim(),
    date,
    time: payload.time || null,
    allDay: payload.allDay !== false,
    category: payload.category || '',
    note: payload.note || '',
    companyId,
    createdBy: user && user._id,
  })
  await doc.save()
  return doc
}

/**
 * 编辑用户自建事件（仅创建者 / admin）。
 */
async function updateEvent(id, payload = {}, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const e = new Error('事件 ID 无效')
    e.statusCode = 400
    throw e
  }
  const doc = await CalendarEvent.findById(id)
  if (!doc) {
    const e = new Error('事件不存在')
    e.statusCode = 404
    throw e
  }
  if (!assertOwnershipOrAdmin(doc, user)) {
    const e = new Error('无权限修改该事件')
    e.statusCode = 403
    throw e
  }
  if (payload.title !== undefined) doc.title = String(payload.title).trim()
  if (payload.date !== undefined) {
    const d = new Date(payload.date)
    if (isNaN(d.getTime())) {
      const e = new Error('日期格式无效')
      e.statusCode = 400
      throw e
    }
    doc.date = d
  }
  if (payload.time !== undefined) doc.time = payload.time || null
  if (payload.allDay !== undefined) doc.allDay = !!payload.allDay
  if (payload.category !== undefined) doc.category = payload.category || ''
  if (payload.note !== undefined) doc.note = payload.note || ''
  if (payload.companyId !== undefined) {
    doc.companyId =
      payload.companyId && mongoose.Types.ObjectId.isValid(payload.companyId) ? payload.companyId : null
  }
  await doc.save()
  return doc
}

/**
 * 删除用户自建事件（仅创建者 / admin）。
 */
async function deleteEvent(id, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const e = new Error('事件 ID 无效')
    e.statusCode = 400
    throw e
  }
  const doc = await CalendarEvent.findById(id)
  if (!doc) {
    const e = new Error('事件不存在')
    e.statusCode = 404
    throw e
  }
  if (!assertOwnershipOrAdmin(doc, user)) {
    const e = new Error('无权限删除该事件')
    e.statusCode = 403
    throw e
  }
  await doc.deleteOne()
  return { id }
}

// 从 Company 抽取绝对申报日期；财年终点按年循环推算 next occurrence
function extractFilingDates(c, from, _to) {
  const out = []
  const push = (date, label, priority) => {
    if (date) out.push({ date: new Date(date), kind: label, label, priority })
  }
  if (c.compliance) {
    push(c.compliance.agmDueDate, 'AGM 到期', 'high')
    push(c.compliance.arDueDate, '年审到期', 'high')
    push(c.compliance.taxFilingDue, '税务申报', 'medium')
  }
  push(c.brExpiryDate, '商业登记证到期', 'high')
  // 财年终点（day/month）→ 推算 from 之后最近一次发生日
  if (c.financialYearEnd && c.financialYearEnd.month) {
    const next = nextAnnualDate(c.financialYearEnd.month, c.financialYearEnd.day || 31, from)
    if (next) out.push({ date: next, kind: 'fye', label: '财年终点', priority: 'medium' })
  }
  return out
}

// 计算从 from 起、指定 month/day 的下一个年度日期（含 from 当月）
function nextAnnualDate(month, day, from) {
  const y0 = from.getFullYear()
  for (const y of [y0, y0 + 1]) {
    const d = new Date(y, month - 1, day)
    if (d >= from) return d
  }
  return null
}

module.exports = { getCalendarEvents, createEvent, updateEvent, deleteEvent, SOURCE_MODULE }
