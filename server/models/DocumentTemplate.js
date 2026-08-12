const mongoose = require('mongoose');
// ⚠️ category 枚举来自 shared/templateCategories.json（O6 单一事实源）。
//    禁止在本文件内联字面量分类数组 —— 前后端不同源即 B4 根因。
const { CATEGORY_VALUES, SCHEMA_VERSION, VARIABLE_SOURCES } = require('../constants/templateSchema');

/**
 * 文书模板（Schema 驱动引擎，v2）。
 *
 * ⚠️ 命名红线：schema 主体字段名恒为 `docSchema`。
 *    `schema` 是 Mongoose 保留字，任何层级命名为 `schema` 都会直接抛错。
 *
 * ⚠️ Mixed 写入约定（docSchema / sampleData / versionHistory / annualCycle）：
 *    - findOneAndUpdate + $set: { docSchema } → 显式路径赋值，**无需** markModified
 *    - Model.create({ docSchema })            → **无需** markModified
 *    - findById → 就地改 → save()             → **必须** doc.markModified('docSchema')
 *    一律禁止 findByIdAndUpdate(id, { ...req.body }) 把 Mixed 铺开写。
 */
const documentTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },

  category: {
    type: String,
    enum: CATEGORY_VALUES,
    default: 'other',
  },

  // 历史字段：旧 HTML 引擎的 {{变量}} 模板正文。
  // Q1 后无使用者，`required` 由 true 改为 false，仅为历史兼容保留。
  content: { type: String, required: false, default: '' },

  // 单值 enum：本期纯 schema 引擎，html 路径已删除。
  engine: { type: String, enum: ['schema'], default: 'schema' },

  // ⭐ schema 主体（见 docs/design-template-module-v2.md §3.2 docSchema v1 契约）
  docSchema: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // ⭐ Builder 实时预览 / 卡片预览用示例数据（独立于 docSchema，避免污染契约）
  sampleData: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // 契约版本
  schemaVersion: { type: Number, default: SCHEMA_VERSION },

  // ⭐ 内置模板幂等键（唯一稀疏索引，见下方 index 声明）
  presetKey: { type: String, trim: true },

  isPreset: { type: Boolean, default: false },

  // 变量列表 —— 由 deriveVariables(docSchema) 派生，服务端忽略客户端传入
  variables: [{
    _id: false,
    key: String,
    label: String,
    source: {
      type: String,
      enum: VARIABLE_SOURCES,
      default: 'manual',
    },
    fieldPath: { type: String, default: '' },
  }],

  // 关联公司（可空，空 = 通用模板）
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // ⭐ Q6：版本模型本期落地，UI 见 Phase 2
  version: { type: Number, default: 1 },

  // ⭐ Q6：{ version, docSchema, note, updatedBy, updatedAt }，路由层保留最近 20 条
  versionHistory: { type: mongoose.Schema.Types.Mixed, default: () => ([]) },

  // ⭐ 年度 multitask 锚点，本期只存不用
  annualCycle: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ enabled: false, fiscalYearField: '', taskGroupKey: '' }),
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

// presetKey 唯一稀疏索引 —— /initialize 幂等 upsert 的依据。
// sparse: true 保证「用户自建模板无 presetKey」不冲突。
documentTemplateSchema.index({ presetKey: 1 }, { unique: true, sparse: true });
documentTemplateSchema.index({ category: 1, name: 1 });
documentTemplateSchema.index({ isPreset: -1, name: 1 });

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
