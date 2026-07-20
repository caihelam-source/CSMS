// Wave 0 rev2 — 审计日志写入工具（fire-and-forget，不阻塞主流程）
const AuditLog = require('../models/AuditLog');

// logAudit(req, { action, entityType, entityId, detail })
// req.user 提供操作者信息（若缺失则记为 system）
function logAudit(req, { action, entityType, entityId, detail }) {
  try {
    const actor = req?.user;
    const entry = new AuditLog({
      actor: actor?._id || null,
      actorName: actor?.name || 'system',
      action,
      entityType,
      entityId,
      detail: detail || '',
    });
    // 不 await：审计失败不应影响主业务
    entry.save().catch(() => {});
  } catch {
    // 静默失败
  }
}

module.exports = { logAudit };
