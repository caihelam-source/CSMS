const mongoose = require('mongoose');

// 董事/秘书条目 — 专门用于ROD登记册的完整记录
// 与Director模型不同：这里更侧重ROD登记所需的字段（文件送达地址、曾用名等）
const directorEntrySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  // 关联方式：从人员库选择 or 手动输入
  personnelRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },

  // 手动输入的基本信息（不关联库时使用）
  fullName: { type: String, trim: true },                    // 英文全名
  fullNameChinese: { type: String, trim: true },             // 中文姓名
  formerNameOrAlias: { type: String, trim: true },           // 曾用名/别名

  // ROD专用字段
  dateOfBirth: { type: Date },                               // 出生日期
  placeOfBirth: { type: String, trim: true },                // 出生地点
  nationality: { type: String, trim: true },                 // 国籍
  idType: { type: String },                                  // 证件类型
  idNumber: { type: String, trim: true },                    // 证件号码

  documentServiceAddress: { type: String },                  // 文件送达地址（ROD必填）
  usualResidentialAddress: { type: String },                 // 住宅地址（如与送达地址不同）
  occupation: { type: String, trim: true },                  // 职业

  // 委任/离任信息
  positionType: { type: String, enum: ['董事', '公司秘书', '其他'], default: '董事' },
  positionTitle: { type: String, trim: true },               // 具体职位（如：执行董事/独立非执行董事）
  dateOfAppointment: { type: Date },                         // 委任日期
  dateOfCessation: { type: Date },                           // 离任日期
  isCurrent: { type: Boolean, default: true },               // 是否现任

  // 登记信息
  entryMadeBy: { type: String, trim: true },                 // 登记人
  remarks: { type: String },                                  // 备注
}, {
  timestamps: true
});

directorEntrySchema.index({ company: 1, isCurrent: 1 });

module.exports = mongoose.model('DirectorEntry', directorEntrySchema);
