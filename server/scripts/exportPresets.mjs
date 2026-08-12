#!/usr/bin/env node
/**
 * 将 9 个后端内置 preset 导出为前端可直接消费的 JSON。
 *
 * 写入目标：shared/templatePresets.generated.json
 * 单一事实源：server/data/presets/*.js（经 server/data/templatePresets.js 的 getPresets 聚合）
 *
 * 为什么需要这层：前端 mock 模式（client/src/services/mock.js）的 MOCK_TEMPLATES
 * 必须从「真实预设」派生，否则用户在 Claw 界面预览到的模板与后端实际预设不一致。
 * 本脚本与 presetsGenerated.test.js 共用 server/scripts/presetExporter.js 的派生逻辑，
 * 保证「生成产物」与「实时重算」永远同一套代码，防漂移测试才有效。
 *
 * 幂等性：
 *   - 不写入任何时间戳/随机值；_id 用 `preset-${presetKey}` 稳定派生。
 *   - 2 空格缩进 + 末尾换行；同样输入两次运行产物字节级相同。
 *
 * 用法：
 *   node server/scripts/exportPresets.mjs
 *   npm run presets:export
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const OUT_PATH = path.join(REPO_ROOT, 'shared', 'templatePresets.generated.json');

const { loadPresetContracts } = require(path.join(SCRIPT_DIR, 'presetExporter.js'));

/**
 * 递归统计 docSchema 中的 section 数量（含 group 嵌套的 children）。
 * @param {Object} docSchema schema 主体
 * @returns {number} section 总数
 */
function countSections(docSchema) {
  let total = 0;
  const walk = (sections) => {
    if (!Array.isArray(sections)) return;
    for (const section of sections) {
      if (!section || typeof section !== 'object') continue;
      total += 1;
      if (section.type === 'group' && Array.isArray(section.children)) {
        walk(section.children);
      }
    }
  };
  walk(docSchema && docSchema.layout && docSchema.layout.sections);
  return total;
}

/**
 * 主流程：派生 → 校验 → 写出 → 打印人工核对报告。
 * @returns {void}
 */
function main() {
  let contracts;
  try {
    contracts = loadPresetContracts();
  } catch (err) {
    console.error('❌ 导出中止：', err && err.message ? err.message : String(err));
    process.exit(1);
  }

  const output = {
    _README: '本文件由 `npm run presets:export` 生成，请勿手改。单一事实源是 server/data/presets/*.js。',
    _source: 'server/data/presets/*.js',
    generatedCount: contracts.length,
    presets: contracts,
  };

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, serialized, 'utf-8');

  const rel = path.relative(REPO_ROOT, OUT_PATH);
  console.log(`✅ 已导出 ${contracts.length} 个预设 → ${rel}`);
  console.log('─'.repeat(72));
  for (const c of contracts) {
    const sections = countSections(c.docSchema);
    const fields = Array.isArray(c.docSchema && c.docSchema.fields) ? c.docSchema.fields.length : 0;
    const variables = Array.isArray(c.variables) ? c.variables.length : 0;
    const directorVars = c.variables.filter((v) => v.source === 'director').length;
    const meetingVars = c.variables.filter((v) => v.source === 'meeting').length;
    const extra = directorVars || meetingVars
      ? `  (director=${directorVars}, meeting=${meetingVars})`
      : '';
    console.log(
      `  • ${String(c.presetKey).padEnd(40)}`
      + `  section=${String(sections).padStart(2)}`
      + `  field=${String(fields).padStart(2)}`
      + `  variable=${String(variables).padStart(2)}${extra}`
    );
  }
  console.log('─'.repeat(72));
  console.log(`字节数：${Buffer.byteLength(serialized, 'utf-8')}`);
  console.log('提示：若 shared/ 与 server/data/presets 不一致，请运行 `npm run presets:export` 重新生成。');
}

main();
