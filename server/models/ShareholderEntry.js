const mongoose = require('mongoose');

// 股东条目 — 记录公司中每个股东的历史（含时间线）
// 一个股东可以有多次股份变更记录
const shareholderEntrySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  // 股东类型：个人或公司(法人)
  shareholderType: { type: String, enum: ['个人', '公司'], default: '个人' },

  // 关联方式：从人员库选择 or 从公司库选择 or 手动输入
  personnelRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },   // 个人股东 → 人员库
  companyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },       // 法人股东 → 公司库

  // 手动输入的名字（不关联库时使用）
  shareholderName: { type: String, trim: true },            // 股东名称(个人名或公司名)
  shareholderNameChinese: { type: String, trim: true },     // 中文名
  shareholderAddress: { type: String },                      // 地址
  shareholderOccupation: { type: String, trim: true },       // 职业(个人股东)

  // 成员状态
  dateEnteredAsMember: { type: Date },                       // 成为成员日期
  dateCeasedAsMember: { type: Date },                        // 退出成员日期
  isCurrentMember: { type: Boolean, default: true },         // 是否现任成员

  // 股份记录（一个股东可以有多次变更）
  shareRecords: [{
    transactionType: { type: String, enum: ['acquired', 'transferred', 'other'], default: 'acquired' },
    distinctiveNumberFrom: { type: String },                  // 股号起始
    distinctiveNumberTo: { type: String },                    // 股号结束
    certificateNumber: { type: String },                      // 证书编号
    transferDeed: { type: String },                           // 转让契据编号(公司股东适用)
    considerationPaid: { type: String },                      // 已付代价
    numberOfShares: { type: Number, default: 0 },             // 股份数
    transactionDate: { type: Date },                          // 交易日期
  }],

  totalSharesHeld: { type: Number, default: 0 },             // 总持股数

  // 登记信息
  entryMadeBy: { type: String, trim: true },                  // 登记人
  remarks: { type: String },                                  // 备注
}, {
  timestamps: true
});

shareholderEntrySchema.index({ company: 1, isCurrentMember: 1 });

module.exports = mongoose.model('ShareholderEntry', shareholderEntrySchema);
