const mongoose = require('mongoose');

const personnelSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  nameChinese: { type: String, trim: true },
  nric: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  nationality: { type: String, trim: true },
  address: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },
  // 角色标签 — v5.0 读时聚合：以 Company.links.roles 为唯一事实源，stored roles 仅作过渡缓存（migrate-v5 --with-roles-cache 可填充）
  roles: [{ type: String }],
  // v5.0: 任职关系已统一迁至 Company.links（单一事实源），Personnel 不再存储 appointments
  // Legacy fields for compatibility
  dateOfBirth: Date,
  placeOfBirth: String,
  idType: String,
  idNumber: String,
  passportNumber: String,
  occupation: String,
  // v5.0: ROD 登记册专有字段（吸收原 DirectorEntry，可选）
  formerNameOrAlias: String,
  documentServiceAddress: String,
  usualResidentialAddress: String,
  notes: String,

  // ====== v6.x 人员去重 / 合并 (Personnel Dedup & Merge) ======
  // 与 Company 同构的软合并：源 personnel status='merged' 后指向 target，零数据丢失。
  // formerNames[]：中文名 / 曾用名 / 别名（含括注别名如「施侃成」），由 merge 接口或用户手填追加；
  //   用于 (1) Personnel 检测重复（alias 命中）(2) PersonnelDetail 区块展示 (3) 反查定位。
  status: { type: String, enum: ['active', 'merged'], default: 'active' },
  formerNames: [{
    name: { type: String, trim: true },
    nameChinese: { type: String, trim: true },
    changedAt: { type: Date },
    source: { type: String, enum: ['merger', 'seed', 'manual'], default: 'manual' },
    mergedFromPersonnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },
    notes: { type: String, trim: true },
  }],
  // 软合并反向指针：源 personnel status='merged' 后指向 target _id（nullable）
  mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },
  mergedAt: { type: Date },
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// 全文本搜索索引（搜索增强 M2.1）：覆盖中英文名/证件号/邮箱
personnelSchema.index({ name: 'text', nameChinese: 'text', nric: 'text', idNumber: 'text', email: 'text' });
personnelSchema.index({ nric: 1 }, { sparse: true });
// v6.x 合并：源 personnel mergedInto 反查 → 列出哪些人员被合并到当前 target
personnelSchema.index({ mergedInto: 1 }, { sparse: true });
// v6.x 去重：formerNames 任一项可命中 name/nameChinese（按元素查 → 用于 alias 重复检测）；sparse 跳过无曾用名的人员
personnelSchema.index({ 'formerNames.name': 1 }, { sparse: true });
personnelSchema.index({ 'formerNames.nameChinese': 1 }, { sparse: true });

module.exports = mongoose.model('Personnel', personnelSchema);
