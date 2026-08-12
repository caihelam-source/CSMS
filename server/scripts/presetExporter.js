/**
 * Preset → 前端契约 JSON 的派生逻辑（导出脚本与防漂移测试共用，单一事实源）。
 *
 * 本模块只负责「补齐前端契约字段」，绝不读取/修改 server/data/presets/*.js 本体。
 * 单一事实源始终是 server/data/presets/*.js（经 templatePresets.getPresets() 聚合）。
 *
 * 设计动机：
 *   getPresets() 返回 9 个 preset，顶层键为
 *     presetKey / name / description / category / engine / schemaVersion / docSchema / sampleData
 *   但前端 TemplateFill / mock 数据源还需要以下契约字段，须在此补齐：
 *     _id        稳定派生 `preset-${presetKey}`（绝不用 Date.now()，否则每次导出产物都会变 → 非幂等）
 *     isPreset   true
 *     version    1
 *     variables  deriveVariables(docSchema) —— 决定是否渲染「董事多选/会议下拉」选择器
 *
 * 该派生逻辑被 exportPresets.mjs 与 presetsGenerated.test.js 共用，
 * 避免「测试抄了一份可能过时的实现」导致漂移测试形同虚设。
 */

const path = require('node:path');

const TEMPLATE_PRESETS_PATH = path.join(__dirname, '..', 'data', 'templatePresets.js');
const TEMPLATE_SCHEMA_PATH = path.join(__dirname, '..', 'constants', 'templateSchema.js');

const { getPresets } = require(TEMPLATE_PRESETS_PATH);
const { deriveVariables, assertValidDocSchema } = require(TEMPLATE_SCHEMA_PATH);

/**
 * 为单个 preset 补齐前端契约字段。
 * @param {Object} preset getPresets() 返回的单个原始 preset
 * @returns {Object} 补齐 _id / isPreset / version / variables 的前端契约对象
 * @throws {Error} 当 docSchema 校验失败时，错误信息含 presetKey 便于定位
 */
function derivePresetContract(preset) {
  const presetKey = preset && preset.presetKey;
  const docSchema = preset && preset.docSchema;

  try {
    assertValidDocSchema(docSchema);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    throw new Error(`presetKey「${presetKey}」docSchema 校验失败：${reason}`);
  }

  return {
    ...preset,
    _id: `preset-${presetKey}`,
    isPreset: true,
    version: 1,
    // 关键：variables 缺失会导致 TemplateFill 不渲染董事/会议自动填充选择器
    variables: deriveVariables(docSchema),
  };
}

/**
 * 加载并派生全部 preset 契约（实时重算，供防漂移测试比对）。
 * @returns {Array<Object>} 补齐后的前端契约对象数组（顺序同 getPresets()）
 */
function loadPresetContracts() {
  return getPresets().map(derivePresetContract);
}

module.exports = {
  getPresets,
  deriveVariables,
  assertValidDocSchema,
  derivePresetContract,
  loadPresetContracts,
};
