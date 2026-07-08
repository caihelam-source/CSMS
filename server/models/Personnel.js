const mongoose = require('mongoose');

// 任职记录子文档 — 人员可在多家公司担任不同职位
const appointmentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  position: { type: String, trim: true },          // 职位, 如 董事/公司秘书/股东
  appointedDate: { type: Date },
  ceasedDate: { type: Date },
  status: { type: String, enum: ['current', 'ceased', '在任', '离任'], default: 'current' },
  notes: { type: String },
}, { _id: true });

const personnelSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  nameChinese: { type: String, trim: true },
  nric: { type: String, trim: true, sparse: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  nationality: { type: String, trim: true },
  address: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },
  // 角色标签 — 由任职记录自动汇总 (director/secretary/shareholder/employee/manager)
  roles: [{ type: String }],
  // 任职记录 — 关联多家公司的职位时间线
  appointments: [appointmentSchema],
  // Legacy fields for compatibility
  dateOfBirth: Date,
  placeOfBirth: String,
  idType: String,
  idNumber: String,
  passportNumber: String,
  occupation: String,
  notes: String,
}, { timestamps: true });

personnelSchema.index({ name: 'text', nric: 'text', email: 'text' });
personnelSchema.index({ nric: 1 }, { sparse: true });

module.exports = mongoose.model('Personnel', personnelSchema);
