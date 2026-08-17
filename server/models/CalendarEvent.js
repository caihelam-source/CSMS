const mongoose = require('mongoose')

// 用户自建事件（日历第 7 源 user_event）
// 独立集合，与合规提醒等系统源不互通（互通留 P2）。
// 聚合时映射为统一事件结构：source='user_event'、module='我的事件'、link=''。
const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true }, // 事件锚定日
    time: { type: String, default: null }, // 可选，如 "14:30"；空 = 全天
    allDay: { type: Boolean, default: true },
    category: { type: String, default: '' }, // 可选分类标签
    note: { type: String, default: '' }, // 可选备注
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }, // 可选关联公司
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 归属
  },
  { timestamps: true },
)

// 列表查询（按公司 + 日期）；个人事件归属查询
calendarEventSchema.index({ companyId: 1, date: 1 })
calendarEventSchema.index({ createdBy: 1 })

// 映射为前端统一事件 VO（与 6 类系统源结构一致）
calendarEventSchema.methods.toEventVO = function toEventVO() {
  return {
    id: String(this._id),
    source: 'user_event',
    module: '我的事件',
    title: this.title,
    date: this.date,
    time: this.time || null,
    allDay: this.allDay !== false,
    priority: 'medium',
    status: 'open',
    overdue: false,
    companyId: this.companyId ? String(this.companyId) : null,
    companyName: null, // 聚合场景下由服务层 populate 后填充
    link: '', // 自建事件点击打开编辑而非跳转
    category: this.category || '',
    note: this.note || '',
  }
}

module.exports = mongoose.model('CalendarEvent', calendarEventSchema)
