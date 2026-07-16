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
}, { timestamps: true });

personnelSchema.index({ name: 'text', nric: 'text', email: 'text' });
personnelSchema.index({ nric: 1 }, { sparse: true });

module.exports = mongoose.model('Personnel', personnelSchema);
