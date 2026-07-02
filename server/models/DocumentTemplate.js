const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },
  category: {
    type: String,
    enum: ['board_resolution', 'minutes', 'agm_resolution', 'director_change', 'other'],
    default: 'other'
  },

  // 模板内容（富文本 HTML 或 Markdown，含 {{变量}} 占位符）
  content: { type: String, required: true },

  // 变量列表（从 content 解析，方便前端渲染变量面板）
  variables: [{
    key: String,      // 如 company_name
    label: String,    // 如 公司名称
    source: {
      type: String,
      enum: ['company', 'director', 'meeting', 'manual'],
      default: 'manual'
    },
    fieldPath: String, // 如 company.name
  }],

  // 关联公司（可空，空=通用模板）
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  isPreset: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

module.exports = mongoose.model('DocumentTemplate', templateSchema);
