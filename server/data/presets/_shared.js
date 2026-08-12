/**
 * 内置 preset 公共常量（从原 server/data/templatePresets.js 抽出）。
 *
 * ⚠️ 命名红线：文档 schema 主体字段名恒为 `docSchema`（`schema` 是 Mongoose 保留字）。
 * ⚠️ 安全红线：本目录下所有模块**禁止**出现 eval / new Function / Function()，
 *    条件一律走 JSON DSL（算子白名单见 server/constants/templateSchema.js）。
 *
 * 本模块只导出「无副作用的纯常量」，供各 preset 模块 require，
 * 以保证 6 个 preset 在占位下划线长度、schemaVersion 上完全一致。
 */

const { SCHEMA_VERSION } = require('../../constants/templateSchema');

/** 8 个全角下划线，与 MVP 完全一致（长空位：签署栏、整段留白） */
const BLANK = '＿＿＿＿＿＿＿＿';

/** 6 个全角下划线（中空位：姓名、职位、日期等） */
const BLANK_MD = '＿＿＿＿＿＿';

/** 4 个全角下划线（短空位：股份代号、年度、Y/N 等） */
const BLANK_SM = '＿＿＿＿';

/** 董事类别值域（模板 1 / 模板 2 共用，与 MVP DIRECTOR_TYPES 一致） */
const DIRECTOR_TYPES = Object.freeze(['执行董事', '非执行董事', '独立非执行董事']);

/** 身份证明文件类别值域（与 MVP ID_TYPES 一致） */
const ID_TYPES = Object.freeze([
  '香港身份证',
  '中国居民身份证',
  '护照',
  '其他身份证明文件',
]);

/**
 * 把纯文本条款数组转成 checklist 字段值（{text, checked}[]）。
 * 与 MVP `toCheckItems()` 语义完全一致。
 *
 * @param {string[]} texts 条款文本数组
 * @param {boolean} checked 是否默认勾选
 * @returns {Array<{text:string, checked:boolean}>} checklist 条目数组
 */
function toCheckItems(texts = [], checked = false) {
  return texts.map((text) => ({ text: String(text), checked: Boolean(checked) }));
}

module.exports = {
  SCHEMA_VERSION,
  BLANK,
  BLANK_MD,
  BLANK_SM,
  DIRECTOR_TYPES,
  ID_TYPES,
  toCheckItems,
};
