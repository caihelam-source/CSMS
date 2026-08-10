const mongoose = require('mongoose');

/**
 * RuleLibrary — 港股业绩公告规则库（单例配置文档）
 *
 * 设计要点：
 *  - **单例**：整库只有一条文档。写入统一走 `findOneAndUpdate({}, doc, { upsert: true })`，
 *    读取统一走 `findOne({})`。不使用固定 _id 常量，避免跨环境迁移时 _id 冲突。
 *  - **形状对齐种子**：字段与 `server/services/timetableData.js` 严格一致
 *    （meta / parties / rules / offsets_midyear / offsets_annual / tasks_midyear / tasks_annual），
 *    使得「库为空 → 回落种子」与「库已写入 → 用库」对引擎完全透明。
 *  - **懒写入**：系统首次启动时库为空，`loadLibrary()` 直接返回种子对象，
 *    不强制落库；只有 admin 主动保存（PUT /rules）或导入（POST /rules/import）才写库。
 *
 * 单条任务/偏移量的「禁用」通过在对象上打 `_disabled: true` 标记实现
 * （Mixed 类型，schema 不做强约束），由 timetableEngine 在取定义时过滤。
 *
 * **两个「版本」的区别（勿混用）**：
 *  - `version`  —— 规则库**内容版本**标签（如 '2026-01'），随规则文件本身携带，由编写规则的人维护，
 *                  可能长期不变，也可能被导入的文件覆写成任意字符串。
 *  - `revision` —— 规则库**修订号**（单调递增整数），由服务端在每次落库（PUT /rules、
 *                  POST /rules/import）时 +1，用于给业绩排期结果打「用的是第几版规则库」的水印。
 *                  排期结果文档的 `ruleLibraryVersion` 取的就是它。
 *                  约定 `revision = 0` 表示「库中无文档、正在使用内置种子 timetableData.js」。
 */
const ruleLibrarySchema = new mongoose.Schema({
  version: { type: String, default: '2026-01' },
  /** 修订号：每次落库自增，0 = 未落库（内置种子）。服务端掌控，不接受客户端传入。 */
  revision: { type: Number, default: 1 },
  meta: { type: Object, default: {} },
  parties: { type: Object, default: {} },
  rules: { type: Object, default: {} },
  offsets_midyear: { type: Array, default: [] },
  offsets_annual: { type: Array, default: [] },
  tasks_midyear: { type: Array, default: [] },
  tasks_annual: { type: Array, default: [] },
  /** 最后修改人（用户 _id 字符串或 email，便于审计追溯） */
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: true, minimize: false });

module.exports = mongoose.model('RuleLibrary', ruleLibrarySchema);
