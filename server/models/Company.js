const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Company name required'], trim: true },
  nameChinese: { type: String, trim: true },
  stockCode: { type: String, trim: true },
  registrationNumber: { type: String, unique: true, trim: true },
  type: { type: String, enum: ['private_limited', 'public_limited', 'llp', 'sole_proprietorship', 'partnership', 'other'], default: 'private_limited' },
  status: { type: String, enum: ['active', 'dormant', 'struck_off', 'winding_up', 'dissolved', 'merged'], default: 'active' },
  jurisdiction: { type: String, enum: ['HK', 'BVI', 'Cayman', 'SG', 'OTHER'], default: 'HK' },
  incorporationDate: { type: Date },

  // ====== v6.x 公司去重 / 合并 (Company Dedup & Merge) ======
  // formerNames[]：历史公司名 / 中文名 / 别名，由 merge 接口或用户手填追加；
  // 用于 (1) Companies.jsx 检测重复按钮 (fuzzy/alias 命中) (2) CompanyDetail formerNames 区块展示
  // (3) 反查任一名字快速定位公司。一项对应一次"改名/合并"事件。
  formerNames: [{
    name: { type: String, trim: true },                    // 旧/曾用英文名
    nameChinese: { type: String, trim: true },              // 旧/曾用中文名（可选）
    changedAt: { type: Date },                              // 改名时间；merge 时取 now
    source: {                                                // 来源
      type: String,
      enum: ['merger', 'seed', 'manual'],
      default: 'manual',
    },
    mergedFromCompanyId: {                                   // merge 时指向源公司 _id
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
    notes: { type: String, trim: true },
  }],
  // 软合并反向指针：源公司 status='merged' 后指向 target _id（nullable）
  mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  mergedAt: { type: Date },
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Addresses
  registeredAddress: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },
  businessAddress: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },

  // Unified links — can reference Personnel or Company
  links: [{
    linkModel: { type: String, enum: ['Personnel', 'Company'], required: true },
    link: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'links.linkModel' },
    roles: [{ type: String, enum: ['director', 'alternate_director', 'shareholder', 'secretary', 'auditor', 'other'] }],
    shares: Number,
    shareType: { type: String, enum: ['ordinary', 'preference', 'other'], default: 'ordinary' },
    appointmentDate: Date,
    cessationDate: Date,
    notes: String,
    // v5.0: 股份变更时间线（吸收原 ShareholderEntry.shareRecords）
    shareRecords: [{
      transactionType: { type: String, enum: ['acquired', 'transferred', 'other'], default: 'acquired' },
      distinctiveNumberFrom: String,
      distinctiveNumberTo: String,
      certificateNumber: String,
      transferDeed: String,
      considerationPaid: String,
      numberOfShares: Number,
      transactionDate: Date,
    }],
    // v5.0: ROD 登记册专有字段（吸收原 DirectorEntry）
    formerNameOrAlias: String,
    documentServiceAddress: String,
    usualResidentialAddress: String,
  }],

  // Share capital
  shareCapital: {
    issued: Number, paidUp: Number, currency: { type: String, default: 'HKD' },
  },

  // Financial
  financialYearEnd: { day: Number, month: Number },

  // Compliance
  compliance: {
    agmDueDate: Date, arDueDate: Date, lastAgmDate: Date, lastArDate: Date,
    taxFilingDue: Date,
  },

  // 属地特有合规字段（v5.0 按 jurisdiction 扩展）
  brExpiryDate: { type: Date },          // 香港：商业登记证到期日
  bviRelevantActivity: { type: String }, // BVI：经济实质相关活动分类（如 fund_management / finance_leasing / holding / ip / shipping / distribution / service_center / holding_only 等）
  // v6.x：是否在港注册的非香港公司（NN3 适用主体，jurisdiction 通常为 BVI/Cayman/SG/OTHER，但有 HK 公司注册处签发的「注册非香港公司注册证书」）
  nonHongKongCompany: { type: Boolean, default: false },

  // Legacy fields
  isListed: { type: Boolean, default: false },
  listingLocation: { type: String },
  businessNature: { type: String },
  industry: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  companySecretary: { type: String },
  notes: { type: String },

  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

companySchema.index({ name: 1 });
companySchema.index({ 'compliance.agmDueDate': 1 });
companySchema.index({ 'compliance.arDueDate': 1 });
companySchema.index({ 'links.link': 1 });
// v5.0 读时聚合索引：加速 reverse-links 与按角色/公司筛选
companySchema.index({ 'links.linkModel': 1, 'links.link': 1 });
companySchema.index({ 'links.linkModel': 1, 'links.roles': 1 });
// 状态筛选 / active 统计
companySchema.index({ status: 1 });
// 全文本搜索索引（搜索增强 M2.1）
companySchema.index({ name: 'text', nameChinese: 'text', stockCode: 'text', registrationNumber: 'text' });
// v6.x 合并：源公司 mergedInto 反查 → 列出哪些公司被合并到当前 target
companySchema.index({ mergedInto: 1 }, { sparse: true });
// v6.x 去重：formerNames 任一项可命中 name（按元素查 → 用于 alias 重复检测）；sparse 跳过无曾用名的公司
companySchema.index({ 'formerNames.name': 1 }, { sparse: true });

module.exports = mongoose.model('Company', companySchema);
