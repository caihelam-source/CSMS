const mongoose = require('mongoose');

/**
 * 模板填写快照（Q7 / O5：独立集合）。
 *
 * 本期**只建 model，不注册路由、不接 UI**。存在的意义：
 *   1. 为 Phase 2「归档进 Documents」预留 `documentRef` 接线点；
 *   2. 让「同一模板的多次填写」可回溯，且不把大 JSON 塞进 DocumentTemplate 造成文档膨胀。
 *
 * ⚠️ Mixed 写入约定同 DocumentTemplate：
 *    hydrate 后就地改 `docSchemaSnapshot` / `data` 必须 markModified；
 *    `$set` 显式路径赋值与 `create()` 不需要。
 */
const templateSnapshotSchema = new mongoose.Schema({
  // 来源模板引用
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentTemplate', index: true },

  // 冗余存名，模板被删除后快照仍可读
  templateName: { type: String, trim: true, default: '' },

  // 快照名（用户可自定义，默认取 templateName + 时间）
  snapshotName: { type: String, trim: true, default: '' },

  // 内置模板幂等键（冗余，便于按 preset 维度聚合统计）
  presetKey: { type: String, trim: true, default: '' },

  // 生成快照时的契约版本
  schemaVersion: { type: Number, default: 1 },

  // ⭐ 生成快照时的 docSchema 全量副本（模板后续改版不影响历史快照可复现）
  docSchemaSnapshot: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // ⭐ 用户填写的数据（key → value，形状由 docSchema.fields 决定）
  data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  status: {
    type: String,
    enum: ['draft', 'finalized', 'archived'],
    default: 'draft',
  },

  // 导出 Word 时使用的文件名
  fileName: { type: String, trim: true, default: '' },

  exportedAt: { type: Date },

  // Phase 2 接线点：归档为正式文档后回填 Document._id
  documentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

templateSnapshotSchema.index({ template: 1, createdAt: -1 });
templateSnapshotSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('TemplateSnapshot', templateSnapshotSchema);
