// 日历模块共享常量与原生 Date 工具（不引入 date-fns 等新依赖）
// 所有视图 / 弹层 / 表单复用的来源配色、来源标签、周起始、视图类型、状态样式，
// 以及周起始对齐、加减天数、ISO 格式化等纯函数工具。

// 来源 → 固定配色（主理人裁定：user_event 固定 #14b8a6，不自选色）
export const SOURCE_COLOR = {
  compliance_reminder: '#ef4444',
  task: '#2563EB',
  company_filing: '#f59e0b',
  document: '#0ea5e9',
  meeting: '#8b5cf6',
  results_timetable: '#ec4899',
  user_event: '#14b8a6',
}

// 来源 → 中文模块名
export const SOURCE_LABEL = {
  compliance_reminder: '合规提醒',
  task: '任务',
  company_filing: '公司申报',
  document: '文档',
  meeting: '会议',
  results_timetable: '业绩排期',
  user_event: '我的事件',
}

// 全部来源 key（来源筛选 chip 遍历用）
export const ALL_SOURCES = Object.keys(SOURCE_LABEL)

// 周起始：周日（主理人裁定保持周日起始）
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export const STATUS_LABEL = { open: '待办', overdue: '逾期', completed: '已完成' }

// 四视图切换类型
export const VIEW_TYPES = [
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' },
  { key: 'agenda', label: '议程' },
]

// 新建/编辑表单分类选项
export const EVENT_CATEGORY_OPTIONS = ['会议', '出差', '客户电话', '内部备忘', '其他']

// ── 原生 Date 工具 ────────────────────────────────────────────
export const ymd = (d) => {
  const x = new Date(d)
  if (isNaN(x.getTime())) return ''
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)

export const endOfMonth = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  x.setHours(23, 59, 59, 999)
  return x
}

export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)

// 周日起始的本周首日（含传入日所在周）
export const startOfWeekSunday = (d) => {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export const endOfWeekSaturday = (d) => {
  const x = startOfWeekSunday(d)
  x.setDate(x.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

export const isSameDay = (a, b) => ymd(a) === ymd(b)
export const isToday = (d) => isSameDay(d, new Date())

export const formatMonthTitle = (d) => `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
export const formatDateTitle = (d) => ymd(d)
export const formatWeekRange = (d) => `${ymd(startOfWeekSunday(d))} ~ ${ymd(endOfWeekSaturday(d))}`

// 仅看未完成过滤（在 hook 返回后客户端过滤）
export const applyOnlyOpen = (events, onlyOpen) =>
  onlyOpen ? events.filter((e) => e.status === 'open' || e.status === 'overdue') : events

// 按 ymd 分组
export const groupByDay = (events) => {
  const map = {}
  for (const e of events) {
    const key = ymd(e.date)
    ;(map[key] = map[key] || []).push(e)
  }
  return map
}

// 事件展示排序：全天置顶，再按时间升序
export const sortDayEvents = (list) =>
  [...list].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    const ta = a.time || '00:00'
    const tb = b.time || '00:00'
    return ta.localeCompare(tb)
  })
