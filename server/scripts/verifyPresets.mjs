#!/usr/bin/env node
/**
 * preset 端到端渲染核验脚本
 *
 * 用途：把后端内置 preset（server/data/templatePresets.js）灌进前端渲染引擎
 *      （client/src/schemaDoc/schemaUtils.js 的 buildDocPlan），逐区块扫描产出的
 *      PlanNode，确保不存在「渲染成空白、没有下划线」的签署格。
 *
 * 背景：resolveSegments 的分支顺序是 join → var → text → blank，且 text 分支判定为
 *      `typeof seg.text === 'string'`（空串同样命中并 return）。因此把留白写成
 *      `{ text: '', blank: X }` 会被 text 分支吞掉，产出 `{ text: '', bold: false }`，
 *      即空白无下划线。正确写法是纯留白段 `{ blank: true }`。
 *
 * 校验两道关：
 *   1. 结构关 —— 对每个 preset 的 docSchema 跑 assertValidDocSchema（含新增的段校验）；
 *   2. 渲染关 —— 实跑 buildDocPlan，统计签署格 / 留白 run / 空白格。
 *
 * 退出码：0 = 全部通过；1 = 存在空白格或 schema 校验不通过。
 *
 * 用法：
 *   node server/scripts/verifyPresets.mjs
 *   npm --prefix server run verify:presets
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** 本脚本所在目录（server/scripts） */
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** 仓库根目录 */
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// ── 依赖加载（server 侧 CommonJS 用 require，client 侧 ESM 用动态 import）──────
const { getPresets } = require(path.join(REPO_ROOT, 'server', 'data', 'templatePresets.js'));
const { assertValidDocSchema } = require(
  path.join(REPO_ROOT, 'server', 'constants', 'templateSchema.js')
);

const schemaUtilsUrl = pathToFileURL(
  path.join(REPO_ROOT, 'client', 'src', 'schemaDoc', 'schemaUtils.js')
).href;
const { buildDocPlan, createSampleData, BLANK } = await import(schemaUtilsUrl);

/**
 * 判定一组 run 是否「视觉上完全空白」。
 * 空数组，或所有 run 的 text 都是空串 → 该格在纸面上什么都没有（连下划线都没有）。
 * @param {Array<{text?:string}>} runs run 数组
 * @returns {boolean} 是否为空白格
 */
function isBlankCell(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return true;
  return runs.every((run) => !run || String(run.text ?? '') === '');
}

/**
 * 统计一组 run 中标记为留白（blank: true）的数量。
 * @param {Array<{blank?:boolean}>} runs run 数组
 * @returns {number} 留白 run 数
 */
function countBlankRuns(runs) {
  if (!Array.isArray(runs)) return 0;
  return runs.filter((run) => run && run.blank === true).length;
}

/**
 * 递归遍历 PlanNode 树（buildDocPlan 产出的区块结构为 { type, className, props, children }）。
 * @param {Array<object>} nodes 区块数组
 * @param {(node: object) => void} visit 访问回调
 * @returns {void}
 */
function walkPlan(nodes, visit) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    visit(node);
    if (Array.isArray(node.children)) walkPlan(node.children, visit);
  }
}

/**
 * 扫描单个 preset：跑 schema 校验 + 渲染统计。
 * @param {{presetKey?:string, key?:string, docSchema:object, sampleData?:object}} preset preset 定义
 * @returns {{
 *   key: string,
 *   schemaError: string,
 *   sectionCount: number,
 *   signCellCount: number,
 *   blankRunCount: number,
 *   blankCells: Array<{label:string, type:string}>,
 *   renderError: string,
 * }} 扫描结果
 */
function scanPreset(preset) {
  const key = preset.presetKey || preset.key || '(未命名 preset)';
  const result = {
    key,
    schemaError: '',
    sectionCount: 0,
    signCellCount: 0,
    blankRunCount: 0,
    blankCells: [],
    renderError: '',
  };

  // 第一道关：schema 结构校验
  try {
    assertValidDocSchema(preset.docSchema);
  } catch (err) {
    result.schemaError = err && err.message ? err.message : String(err);
  }

  // 第二道关：实跑渲染
  try {
    const data = createSampleData(preset.docSchema, preset.sampleData || {});
    const plan = buildDocPlan(preset.docSchema, data);
    const nodes = Array.isArray(plan) ? plan : (plan && plan.sections) || [];

    walkPlan(nodes, (node) => {
      result.sectionCount += 1;
      const props = node.props || {};

      if (node.type === 'signBlock') {
        for (const item of props.items || []) {
          result.signCellCount += 1;
          const runs = (item && item.runs) || [];
          result.blankRunCount += countBlankRuns(runs);
          if (isBlankCell(runs)) {
            result.blankCells.push({ label: (item && item.label) || '(无 label)', type: 'signBlock' });
          }
        }
      }

      if (node.type === 'infoTable') {
        for (const row of props.rows || []) {
          const runs = (row && row.runs) || [];
          result.blankRunCount += countBlankRuns(runs);
          if (isBlankCell(runs)) {
            result.blankCells.push({ label: (row && row.label) || '(无 label)', type: 'infoTable' });
          }
        }
      }

      if (node.type === 'paragraph') {
        result.blankRunCount += countBlankRuns(props.runs);
      }

      if (node.type === 'meta') {
        result.blankRunCount += countBlankRuns(props.left);
        result.blankRunCount += countBlankRuns(props.right);
      }
    });
  } catch (err) {
    result.renderError = err && err.message ? err.message : String(err);
  }

  return result;
}

/**
 * 主流程：逐 preset 扫描并打印报告。
 * @returns {number} 进程退出码（0 通过 / 1 失败）
 */
function main() {
  const presets = getPresets();
  console.log('preset 端到端渲染核验');
  console.log(`BLANK 常量：长度 ${BLANK.length}，值 ${JSON.stringify(BLANK)}`);
  console.log('='.repeat(96));

  const results = presets.map(scanPreset);
  const nameWidth = Math.max(...results.map((r) => r.key.length), 12);

  for (const r of results) {
    const failed = r.blankCells.length > 0 || r.schemaError || r.renderError;
    const flag = failed ? '✗' : '✓';
    console.log(
      `${flag} ${r.key.padEnd(nameWidth)}`
      + `  区块 ${String(r.sectionCount).padStart(3)}`
      + `  签署格 ${String(r.signCellCount).padStart(2)}`
      + `  留白run ${String(r.blankRunCount).padStart(3)}`
      + `  空白格 ${String(r.blankCells.length).padStart(2)}`
    );
    for (const cell of r.blankCells) {
      console.log(`      ⚠ 空白无下划线：[${cell.type}] ${cell.label}`);
    }
    if (r.schemaError) console.log(`      ⚠ schema 校验失败：${r.schemaError}`);
    if (r.renderError) console.log(`      ⚠ 渲染异常：${r.renderError}`);
  }

  console.log('='.repeat(96));

  const blankTotal = results.reduce((sum, r) => sum + r.blankCells.length, 0);
  const schemaFailed = results.filter((r) => r.schemaError);
  const renderFailed = results.filter((r) => r.renderError);

  console.log(`preset 总数：${results.length}`);
  console.log(`签署格总数：${results.reduce((s, r) => s + r.signCellCount, 0)}`);
  console.log(`留白 run 总数：${results.reduce((s, r) => s + r.blankRunCount, 0)}`);
  console.log(`空白格总数：${blankTotal}`);
  console.log(`schema 校验不通过：${schemaFailed.length}${schemaFailed.length ? ` → ${schemaFailed.map((r) => r.key).join('、')}` : ''}`);
  console.log(`渲染异常：${renderFailed.length}${renderFailed.length ? ` → ${renderFailed.map((r) => r.key).join('、')}` : ''}`);

  if (blankTotal || schemaFailed.length || renderFailed.length) {
    console.log('\n结论：❌ 核验未通过，请按上方 ⚠ 明细修复。');
    console.log('提示：留白必须写 { blank: true }，不可写 { text: "", blank: ... }。');
    return 1;
  }
  console.log('\n结论：✅ 全部 preset 通过（无空白格、schema 合法、渲染无异常）。');
  return 0;
}

/**
 * 打印本脚本在整体校验体系中的定位（避免误解为「读路径也会被拦」）。
 * @returns {void}
 */
function printScopeNote() {
  console.log(
    '\n说明：本脚本是**写路径**的离线闸门（POST / PUT / /duplicate / /initialize 会 throw → 400）；'
    + '\n      **读路径**（GET 列表 / GET 单条 / /resolve）不调用 assertValidDocSchema，'
    + '不阻断，\n      如未来引入读路径校验须降级为返回 `schemaIssues: string[]`，'
    + '保证坏数据仍能被打开与修复。'
  );
}

const exitCode = main();
printScopeNote();
process.exit(exitCode);
