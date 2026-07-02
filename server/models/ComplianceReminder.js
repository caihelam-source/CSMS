const mongoose = require('mongoose');

const complianceReminderSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  rule: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceRule', required: true },
  ruleId: { type: String },                     // 冗余存储方便查询
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

module.exports = mongoose.model('ComplianceReminder', complianceReminderSchema);
