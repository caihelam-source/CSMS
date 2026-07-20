const mongoose = require('mongoose');

// Wave 0 rev2 — 审计日志：记录敏感操作（归档/锁定/解档/权限分配等），供合规举证与审计员追溯
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String },
  action: { type: String, required: true },       // archive | unarchive | lock | unlock | assign_scope | login ...
  entityType: { type: String },                    // Document | Meeting | Company | User
  entityId: { type: mongoose.Schema.Types.ObjectId },
  detail: { type: String },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
