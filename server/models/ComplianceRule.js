const mongoose = require('mongoose');

const complianceRuleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true },   // 如 HK_AR_42
  ruleName: { type: String, required: true },
  description: { type: String },
  category: { type: String },                               // 公司注册处 / 税务局 / 定期财务报告 等
  legalReference: { type: String },                         // 法规依据

  // 适用范围
  jurisdiction: {
    type: String,
    enum: ['HK', 'BVI', 'Cayman', 'SG', 'OTHER', 'ALL'],
    required: true
  },
  isListedOnly: { type: Boolean, default: false },          // 仅上市公司
  listingLocation: { type: String },                        // 如 HK 仅香港上市

  /**
   * 公司主体范围（与 jurisdiction 配合，用来表达 NAR1 / NN3 这类互斥规则）。
   *
   * 背景：注册地在开曼/BVI 但在港注册的公司（「注册非香港公司」，Company.nonHongKongCompany=true）
   * 除适用其注册地规则外，还**并行**适用香港规则。但周年申报表二者互斥——
   * 香港本地公司交 NAR1，注册非香港公司交 NN3，不能同时生成。
   *
   * 取值：
   *  - 'ANY'（默认）      ：不额外限制，仅按 jurisdiction 匹配（既有规则行为不变）
   *  - 'HK_LOCAL'         ：仅香港本地成立公司（jurisdiction=HK 且 nonHongKongCompany=false）→ NAR1
   *  - 'HK_NON_HK'        ：仅「在港注册的非香港公司」（nonHongKongCompany=true）→ NN3
   *
   * 注意：不要用 condition 文本表达该约束——引擎不解析 condition，它只是展示用说明。
   */
  companyScope: {
    type: String,
    enum: ['ANY', 'HK_LOCAL', 'HK_NON_HK'],
    default: 'ANY'
  },

  // 截止日期计算
  baseDateType: {
    type: String,
    enum: ['incorporationDate', 'financialYearEnd', 'fixed', 'trigger'],
    default: 'incorporationDate'
  },
  baseDateOffset: { type: Number, default: 0 },             // 基准日偏移天数（年为单位用365）
  dueDateOffset: { type: Number, default: 0 },              // 在周年日/财年结束日基础上再加N天
  anchorPayload: { type: mongoose.Schema.Types.Mixed, default: null }, // fixed 基准：{month,day} 或 {reference:'brExpiryDate'}（BR 续期）
  condition: { type: String },                              // 补充条件说明（如BVI年费按注册月份分两档截止）

  // 多级提醒天数（提前N天）
  reminderDays: [{ type: Number }],

  priority: {
    type: String,
    enum: ['高', '中', '低', '紧急'],
    default: '高'
  },
  penaltyNote: { type: String },                            // 罚款说明
  specialNote: { type: String },                            // 特殊说明

  // 管理
  isPreset: { type: Boolean, default: false },              // 预设规则不可删除
  status: { type: String, enum: ['启用', '停用'], default: '启用' },
  appliedCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],

  createdBy: { type: String, default: 'system' },
}, {
  timestamps: true
});

module.exports = mongoose.model('ComplianceRule', complianceRuleSchema);
