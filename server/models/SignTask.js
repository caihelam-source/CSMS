const mongoose = require('mongoose');

const signRecordSchema = new mongoose.Schema({
  signer: { type: mongoose.Schema.Types.ObjectId, ref: 'Director' },
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
  title: { type: String },
  description: { type: String },
  deadline: { type: Date },

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

module.exports = mongoose.model('SignTask', signTaskSchema);
