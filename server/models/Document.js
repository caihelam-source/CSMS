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
  // v5.1 来源追溯 + 归档锁定（会议纪要闭环 / 文件管理中心）
  // source: 记录文件从何处自动归集而来，便于公司档案展示"来自 [会议纪要]"并可跳回
  source: {
    kind: { type: String, enum: ['meeting_minutes', 'signing_scan', 'task_attachment', 'manual_upload', 'other'] },
    refId: { type: mongoose.Schema.Types.ObjectId }, // 关联 Meeting / Task
    label: { type: String }, // 人类可读来源标签，如 "来自 [2026-07-17 董事会纪要]"
  },
  // locked: 归档锁定 → 只读（无法删除/修改），公司档案展示"已归档"印章
  locked: { type: Boolean, default: false },
  lockedAt: { type: Date },
}, { timestamps: true });

documentSchema.index({ company: 1, type: 1 });
documentSchema.index({ personnel: 1, type: 1 });
documentSchema.index({ renewalDueDate: 1 });
// 文件到期徽章 / 公司维度到期清单
documentSchema.index({ expiresAt: 1 });
documentSchema.index({ company: 1, expiresAt: 1 });
// 全文本搜索索引（搜索增强 M2.1）
documentSchema.index({ title: 'text', docNumber: 'text', description: 'text', tags: 'text', keywords: 'text' });

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
