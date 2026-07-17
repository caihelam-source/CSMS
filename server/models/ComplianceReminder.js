const mongoose = require('mongoose');

const complianceReminderSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  rule: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceRule', required: true },
  ruleId: { type: String },                     // 冗余存储方便查询
  sourceRuleId: { type: String },               // 来源规则 ruleId（生成提醒去重用）
  year: { type: Number },                       // 提醒所属年度（fixed 年费按年循环去重用）
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },

  dueDate: { type: Date, required: true },
  reminderDate: { type: Date },                 // 下一次应提醒日期
  reminderLevel: { type: Number, default: 1 }, // 第几级提醒

  priority: {
    type: String,
    enum: ['高', '中', '低', '紧急'],
    default: '高'
  },
  status: {
    type: String,
    enum: ['待办', '处理中', '已完成', '已过期', '已忽略'],
    default: '待办'
  },

  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },

  // 通知记录
  notificationsSent: [{
    sentAt: Date,
    channel: String,   // email / wechat / system
    level: Number
  }],
}, {
  timestamps: true
});

// 防止为同一公司+规则+截止日期重复生成
complianceReminderSchema.index({ company: 1, rule: 1, dueDate: 1 }, { unique: true });
// 生成引擎去重：同一公司 + 来源规则 + 年度 只生成一条（sparse 以兼容手动创建的提醒）
complianceReminderSchema.index({ company: 1, sourceRuleId: 1, year: 1 }, { unique: true, sparse: true });
// Dashboard 过滤 / 公司维度提醒列表
complianceReminderSchema.index({ status: 1, dueDate: 1 });
complianceReminderSchema.index({ company: 1, dueDate: 1 });

module.exports = mongoose.model('ComplianceReminder', complianceReminderSchema);
