/**
 * 防漂移测试：shared/templatePresets.generated.json 必须与实时 getPresets() 派生结果
 * 逐字节一致（node:test，无需 mongod）。
 *
 * 背景：前端 mock 数据源（client/src/services/mock.js 的 MOCK_TEMPLATES）直接 import
 *      本生成 JSON。若有人改了 server/data/presets/*.js 却忘了重新生成，前端就会看到
 *      与后端不一致的模板。本测试把「重新生成」变成强制门禁。
 *
 * 派生逻辑与导出脚本共用 server/scripts/presetExporter.js（单一事实源），
 * 避免测试抄了一份可能过时的实现导致漂移测试形同虚设。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_PATH = path.join(REPO_ROOT, 'shared', 'templatePresets.generated.json');
const CATEGORIES_PATH = path.join(REPO_ROOT, 'shared', 'templateCategories.json');

const { loadPresetContracts } = require(path.join(__dirname, '..', 'scripts', 'presetExporter.js'));

// 读取生成产物
let generated;
try {
  generated = JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf-8'));
} catch (err) {
  assert.ok(
    false,
    `无法读取 shared/templatePresets.generated.json：${err && err.message ? err.message : String(err)}。`
    + '请先运行 `npm run presets:export` 生成该文件。'
  );
}

test('生成 JSON 的 presets 与实时 getPresets() 派生结果深度相等（防止漂移）', () => {
  const expected = loadPresetContracts();
  assert.deepEqual(
    generated.presets,
    expected,
    'shared/templatePresets.generated.json 与实时 preset 派生结果不一致，'
    + '请运行 `npm run presets:export` 重新生成。'
  );
});

test('生成 JSON 恰好包含 9 条 preset', () => {
  assert.strictEqual(generated.presets.length, 9, `期望 9 条，实际 ${generated.presets.length} 条`);
  assert.strictEqual(generated.generatedCount, 9, 'generatedCount 应等于 9');
});

test('每条预设的 variables 均非空（缺失会导致自动填充 UI 消失）', () => {
  for (const p of generated.presets) {
    assert.ok(
      Array.isArray(p.variables) && p.variables.length > 0,
      `预设 ${p.presetKey} 的 variables 为空，TemplateFill 将无法渲染董事/会议选择器。`
    );
  }
});

test('每条预设的 category 都在 shared/templateCategories.json 合法值集合内', () => {
  const categories = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf-8'));
  const valid = new Set(categories.values);
  for (const p of generated.presets) {
    assert.ok(
      valid.has(p.category),
      `预设 ${p.presetKey} 的 category「${p.category}」不在合法值集合内，`
      + '前端分类筛选会将其筛掉导致模板不可见。'
    );
  }
});
