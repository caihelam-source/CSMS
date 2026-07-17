const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Document name required'], trim: true },
  description: { type: String, maxlength: 1000 },
  type: {
    type: String,
    enum: ['minutes', 'resolution', 'agreement', 'form', 'certificate', 'return', 'notice', 'memo',
           'annual_report', 'financial_statement', 'id_document', 'passport', 'proof_of_address',
           'board_resolution', 'incorporation_doc', 'other'],
    default: 'other',
  },
  fileUrl: { type: String },
  fileName: { type: String },
  category: { type: String, default: 'other' },
  note: { type: String },
  fileSize: { type: Number },
  mimeType: { type: String },
  // Linked entities
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },
  meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
  tags: [String],
  isConfidential: { type: Boolean, default: false },
  expiresAt: { type: Date },
  annualRenewal: { type: Boolean, default: false },
  renewalDueDate: { type: Date },
  documentYear: { type: Number },
  // Legacy fields
  docNumber: { type: String, unique: true, sparse: true },
  signStatus: { type: String, enum: ['draft', 'pending_sign', 'partially_signed', 'fully_signed', 'archived'], default: 'draft' },
}, { timestamps: true });

documentSchema.index({ company: 1, type: 1 });
documentSchema.index({ personnel: 1, type: 1 });
documentSchema.index({ renewalDueDate: 1 });
// 文件到期徽章 / 公司维度到期清单
documentSchema.index({ expiresAt: 1 });
documentSchema.index({ company: 1, expiresAt: 1 });

// 自动生成文档编号：<类型缩写>-<年份>-<序号>
// 使用 counters 集合原子自增，消除 count+1 竞态（DB-AUDIT P1-8）
documentSchema.statics.generateDocNumber = async function (company, directorName, type) {
  const Counter = mongoose.model('Counter');
  const raw = (type || 'doc').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = raw.slice(0, 4) || 'DOC';
  const year = new Date().getFullYear();
  const counterKey = `DOC-${prefix}-${year}`;

  // 原子自增：不存在则 upsert 创建 seq=1，已存在则 $inc
  const counter = await Counter.findByIdAndUpdate(
    counterKey,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );

  const seq = String(counter.seq).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
};

module.exports = mongoose.model('Document', documentSchema);
