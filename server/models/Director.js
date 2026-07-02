const mongoose = require('mongoose');

// 每个职位是一个子文档，关联到一家公司
const appointmentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  position: { type: String, default: '董事' },          // 执行董事 / 独立非执行董事 / 主席 等
  appointedDate: { type: Date },
  resignedDate: { type: Date },
  status: { type: String, enum: ['在任', '离任', '其他'], default: '在任' },
}, { _id: true });

const directorSchema = new mongoose.Schema({
  // 基本信息
  name: { type: String, required: true, trim: true },      // 英文姓名
  nameChinese: { type: String, trim: true },               // 中文姓名
  dateOfBirth: { type: Date },
  idNumber: { type: String, trim: true },                  // 身份证
  passportNumber: { type: String, trim: true },            // 护照
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  residentialAddress: { type: String },                    // 住址
  correspondenceAddress: { type: String },                 // 通讯地址
  nationality: { type: String },

  // 在各公司的职位列表（多对多关联）
  appointments: [appointmentSchema],
}, {
  timestamps: true
});

// 文本搜索索引
directorSchema.index({ name: 'text', nameChinese: 'text', idNumber: 'text' });

module.exports = mongoose.model('Director', directorSchema);
