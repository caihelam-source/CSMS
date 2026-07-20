const mongoose = require('mongoose');

const signRecordSchema = new mongoose.Schema({
  signer: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },
  signerName: String,
  signerEmail: String,
  status: { type: String, enum: ['pending', 'signed', 'rejected'], default: 'pending' },
  signedAt: Date,
  signatureData: String,   // base64 手写签名图
  ipAddress: String,
  verificationCode: String, // 短信/邮件验证码（hash存储）
  verifiedAt: Date,
}, { _id: true });

const signTaskSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  title: { type: String },
  description: { type: String },
  deadline: { type: Date },

  // 关联的"签署 Task"（从会议发起签署时同步创建，用于标记完成 / 在 Task 列表追踪）
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },

  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'expired', 'cancelled'],
    default: 'draft'
  },

  signers: [signRecordSchema],

  // 签署顺序：sequential（按顺序）/ parallel（同时）
  signOrder: { type: String, enum: ['sequential', 'parallel'], default: 'parallel' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, {
  timestamps: true
});

// v5.0 读时聚合索引：签署任务按 company / meeting / document 聚合
signTaskSchema.index({ company: 1 });
signTaskSchema.index({ meeting: 1 });
signTaskSchema.index({ document: 1 });
signTaskSchema.index({ status: 1 });

module.exports = mongoose.model('SignTask', signTaskSchema);
