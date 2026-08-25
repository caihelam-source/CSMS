/**
 * 9 个内置模板（preset）聚合入口。
 *
 * 本文件已于 T04-A 退化为「聚合器」：各 preset 定义拆分至 `server/data/presets/*.js`，
 * 本文件只负责 require 并按固定顺序导出数组。
 *
 *   presets/_shared.js                 → SCHEMA_VERSION / BLANK 等公共常量
 *   presets/directorConfirmation.js    → preset 1 董事确认函（完整正文，T04-A）
 *   presets/du004gUndertaking.js       → preset 2 DU004G 董事声明及承诺（完整正文，T04-A）
 *   presets/departmentSelfAssessment.js→ preset 3 部门管理层年度内控自评表（完整正文）
 *   presets/internalControlReport.js   → preset 4 内控评估报告模板（骨架）
 *   presets/boardResolution.js         → preset 5 董事会声明和决议记录（骨架）
 *   presets/projectCharter.js          → preset 6 项目章程（骨架）
 *   presets/directorResignation.js     → preset 7 董事辞任信（完整正文，分类 director_change）
 *   presets/directorConsentToAct.js    → preset 8 同意出任董事函（完整正文，分类 director_change）
 *   presets/directorCodeComplianceConfirmation.js
 *                                      → preset 9 董事遵守标准守则之确认函（完整正文，分类 compliance_filing）
 *
 * ⚠️ 对外 API 契约（`routes/templates.js` 依赖，不得改动）：
 *      module.exports = { BLANK, templatePresets, getPresets }
 *    `getPresets()` 始终返回**深拷贝**，防止调用方就地改动污染模块级常量。
 *
 * ⚠️ 契约约束：每个 preset 的 `docSchema` 必须通过
 *    `server/constants/templateSchema.js` 的 `assertValidDocSchema()`。
 *    presetKey ↔ category 映射见设计 §7.1，**已定死，不得随意改动**。
 */

const { BLANK } = require('./presets/_shared');

const directorConfirmation = require('./presets/directorConfirmation');
const du004gUndertaking = require('./presets/du004gUndertaking');
const departmentSelfAssessment = require('./presets/departmentSelfAssessment');
const internalControlReport = require('./presets/internalControlReport');
const boardResolution = require('./presets/boardResolution');
const projectCharter = require('./presets/projectCharter');
const directorResignation = require('./presets/directorResignation');
const directorConsentToAct = require('./presets/directorConsentToAct');
const directorCodeComplianceConfirmation = require('./presets/directorCodeComplianceConfirmation');

/**
 * 9 个内置模板定义（顺序即 /initialize 的写入顺序，新增模板一律追加在末尾）。
 * @type {Array<Object>}
 */
const templatePresets = [
  directorConfirmation,
  du004gUndertaking,
  departmentSelfAssessment,
  internalControlReport,
  boardResolution,
  projectCharter,
  directorResignation,
  directorConsentToAct,
  directorCodeComplianceConfirmation,
];

/**
 * 获取全部内置模板定义（返回深拷贝，防止调用方就地改动污染模块级常量）。
 * @returns {Array<Object>} preset 定义数组
 */
function getPresets() {
  return templatePresets.map((p) => JSON.parse(JSON.stringify(p)));
}

module.exports = {
  BLANK,
  templatePresets,
  getPresets,
};
