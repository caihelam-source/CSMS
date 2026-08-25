/**
 * 模板 schema 契约常量与校验器（后端唯一事实源的消费入口）
 *
 * ⚠️ 安全红线：本模块及其调用方**禁止**出现 eval / new Function / Function()。
 *    条件与校验一律走 JSON DSL + 算子白名单（纯 switch 求值）。
 *
 * ⚠️ 命名红线：schema 主体字段名恒为 `docSchema`。
 *    `schema` 是 Mongoose 保留字，任何层级命名为 `schema` 都会直接抛错。
 */

// category 唯一事实源：shared/templateCategories.json
// 禁止在 Model / Route 内联字面量分类数组（B4 根因）。
const categoriesJson = require('../../shared/templateCategories.json');

/** @type {string[]} 12 项 category 值域 */
const CATEGORY_VALUES = Object.freeze([...categoriesJson.values]);

/** @type {Object<string,string>} category → 中文 label */
const CATEGORY_LABELS = Object.freeze({ ...categoriesJson.labels });

/** docSchema 契约版本 */
const SCHEMA_VERSION = 1;

/** 字段 type 枚举（本期开放 9 类） */
const FIELD_TYPES = Object.freeze([
  'text',       // 单行文本
  'textarea',   // 多行文本（渲染时按换行拆段）
  'date',       // YYYY-MM-DD → 「YYYY年M月D日」
  'select',     // 单选
  'boolean',    // 单勾选框
  'list',       // 可增删改文本条目，值 string[]
  'clauses',    // 同 list，语义为「条款」
  'checklist',  // 可增删改 + 可勾选，值 {text,checked}[]
  'objectList', // 可增删改对象条目，值 object[]
]);

/** P2 预留字段类型（引擎留扩展位，Builder 类型下拉不出现） */
const RESERVED_FIELD_TYPES = Object.freeze(['number', 'multiselect', 'matrix']);

/**
 * 引擎当前不消费的字段级关键字。写入即报错，避免「看起来生效、实际静默失效」。
 * 条件必填一律改用 docSchema.rules 表达。
 */
const UNSUPPORTED_FIELD_KEYS = Object.freeze(['requiredWhen']);

/** 区块 type 枚举（10 类，闭合）。⚠️ 不提供 'html' 区块类型（安全红线） */
const SECTION_TYPES = Object.freeze([
  'heading', 'paragraph', 'infoTable', 'checkList', 'clauseList',
  'objectTable', 'signBlock', 'note', 'divider', 'group',
]);

/** 条件 DSL 算子白名单（10 个） */
const OPERATORS = Object.freeze([
  'eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy',
]);

/** 条件 DSL 组合器（3 个） */
const COMBINATORS = Object.freeze(['all', 'any', 'not']);

/** 布局模式 */
const LAYOUT_MODES = Object.freeze(['auto', 'custom']);

/** 变量来源枚举（补 'system'） */
const VARIABLE_SOURCES = Object.freeze(['company', 'director', 'meeting', 'system', 'manual']);

/** 字段 key 命名规则 */
const FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 原型污染保护：禁止作为字段 key 的名称 */
const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);

/**
 * 契约校验错误。路由层据此返回 400 而非 500。
 */
class SchemaValidationError extends Error {
  /**
   * @param {string} message 人类可读的错误说明
   */
  constructor(message) {
    super(message);
    this.name = 'SchemaValidationError';
    this.statusCode = 400;
  }
}

/**
 * 判断是否为纯对象（非数组、非 null）。
 * @param {unknown} v 待判定值
 * @returns {boolean} 是否为纯对象
 */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 校验条件 DSL 节点（递归，支持 all / any / not 组合器）。
 * @param {unknown} cond 条件节点
 * @param {string} path 错误定位路径
 * @param {number} depth 递归深度（防御环状/超深结构）
 * @returns {void}
 * @throws {SchemaValidationError} 结构或算子非法时抛出
 */
function assertValidCondition(cond, path, depth = 0) {
  if (cond === undefined || cond === null) return;
  if (depth > 10) {
    throw new SchemaValidationError(`${path}: 条件嵌套层级超过 10 层`);
  }
  if (!isPlainObject(cond)) {
    throw new SchemaValidationError(`${path}: 条件必须是对象`);
  }

  // 组合器
  for (const comb of COMBINATORS) {
    if (cond[comb] !== undefined) {
      if (comb === 'not') {
        assertValidCondition(cond.not, `${path}.not`, depth + 1);
        return;
      }
      if (!Array.isArray(cond[comb])) {
        throw new SchemaValidationError(`${path}.${comb}: 必须是条件数组`);
      }
      cond[comb].forEach((c, i) => assertValidCondition(c, `${path}.${comb}[${i}]`, depth + 1));
      return;
    }
  }

  // 叶子条件
  if (typeof cond.field !== 'string' || !cond.field.trim()) {
    throw new SchemaValidationError(`${path}: 条件缺少 field`);
  }
  if (!OPERATORS.includes(cond.op)) {
    throw new SchemaValidationError(
      `${path}: 非法算子「${String(cond.op)}」，仅允许 ${OPERATORS.join(' / ')}`
    );
  }
  if ((cond.op === 'in' || cond.op === 'nin') && !Array.isArray(cond.value)) {
    throw new SchemaValidationError(`${path}: 算子 ${cond.op} 的 value 必须是数组`);
  }
}

/**
 * 校验单个字段定义。
 * @param {unknown} field 字段定义
 * @param {number} index 字段序号
 * @param {Set<string>} seenKeys 已出现的 key 集合（用于唯一性判定）
 * @returns {void}
 * @throws {SchemaValidationError} 字段非法时抛出
 */
function assertValidField(field, index, seenKeys) {
  const at = `fields[${index}]`;
  if (!isPlainObject(field)) {
    throw new SchemaValidationError(`${at}: 字段定义必须是对象`);
  }
  if (typeof field.key !== 'string' || !FIELD_KEY_PATTERN.test(field.key)) {
    throw new SchemaValidationError(
      `${at}.key: 「${String(field.key)}」不合法，须匹配 /^[A-Za-z_][A-Za-z0-9_]*$/`
    );
  }
  if (FORBIDDEN_KEYS.includes(field.key)) {
    throw new SchemaValidationError(`${at}.key: 「${field.key}」为保留名，禁止使用`);
  }
  if (seenKeys.has(field.key)) {
    throw new SchemaValidationError(`${at}.key: 「${field.key}」重复`);
  }
  seenKeys.add(field.key);

  if (!FIELD_TYPES.includes(field.type)) {
    throw new SchemaValidationError(
      `${at}.type: 「${String(field.type)}」不在白名单，仅允许 ${FIELD_TYPES.join(' / ')}`
    );
  }
  if (field.label !== undefined && typeof field.label !== 'string') {
    throw new SchemaValidationError(`${at}.label: 必须是字符串`);
  }
  if (field.source !== undefined && !VARIABLE_SOURCES.includes(field.source)) {
    throw new SchemaValidationError(
      `${at}.source: 「${String(field.source)}」不在白名单，仅允许 ${VARIABLE_SOURCES.join(' / ')}`
    );
  }
  if (field.options !== undefined && !Array.isArray(field.options)) {
    throw new SchemaValidationError(`${at}.options: 必须是数组`);
  }
  if (field.itemDefFields !== undefined && !Array.isArray(field.itemDefFields)) {
    throw new SchemaValidationError(`${at}.itemDefFields: 必须是数组`);
  }
  if (field.itemDataFields !== undefined && !Array.isArray(field.itemDataFields)) {
    throw new SchemaValidationError(`${at}.itemDataFields: 必须是数组`);
  }
  // 未支持关键字：引擎不读取，配置会被静默忽略，故在写入时直接拒绝。
  for (const unsupportedKey of UNSUPPORTED_FIELD_KEYS) {
    if (field[unsupportedKey] !== undefined) {
      throw new SchemaValidationError(
        `${at}.${unsupportedKey}: 引擎不支持该关键字（配置会被静默忽略）。条件必填请改用 docSchema.rules 表达。`
      );
    }
  }
  assertValidCondition(field.visibleWhen, `${at}.visibleWhen`);
}

/**
 * 判定 seg 是否命中 resolveSegments 的 join 分支。
 * 对齐 client/src/schemaDoc/schemaUtils.js:539 `Array.isArray(seg.join)`。
 * @param {Object} seg 段对象
 * @returns {boolean} 是否为拼接段
 */
function isJoinSegment(seg) {
  return Array.isArray(seg.join);
}

/**
 * 判定 seg 是否命中 resolveSegments 的 var 分支。
 * 对齐 schemaUtils.js:546 `seg.var !== undefined && seg.var !== null && seg.var !== ''`。
 * @param {Object} seg 段对象
 * @returns {boolean} 是否为变量段
 */
function isVarSegment(seg) {
  return seg.var !== undefined && seg.var !== null && seg.var !== '';
}

/**
 * 判定 seg 是否命中 resolveSegments 的 text 分支。
 * 对齐 schemaUtils.js:559 `typeof seg.text === 'string'`（⚠️ 空串也命中）。
 * @param {Object} seg 段对象
 * @returns {boolean} 是否为文本段
 */
function isTextSegment(seg) {
  return typeof seg.text === 'string';
}

/**
 * 判定 seg 的 blank 是否为「生效的留白声明」。
 * 对齐 schemaUtils.js:567 `seg.blank !== undefined && seg.blank !== null && seg.blank !== false`。
 * @param {Object} seg 段对象
 * @returns {boolean} blank 是否生效
 */
function hasEffectiveBlank(seg) {
  return seg.blank !== undefined && seg.blank !== null && seg.blank !== false;
}

/**
 * 校验 segments[]（渲染引擎 resolveSegments 的输入契约）。
 *
 * 背景：`resolveSegments` 的分支顺序是 join → var → text → blank，且 text 分支判定为
 * `typeof seg.text === 'string'`（空串同样命中并 return）。因此 `{ text: '', blank: X }`
 * 会被 text 分支吞掉，产出 `{ text: '', bold: false }` —— 渲染为**空白、无下划线**，
 * 这是「签署格渲染成空白」缺陷的根因。本校验把该写法永久堵死。
 *
 * 校验规则（命中即抛错）：
 *   1. `text: ''`（空串）与生效的 `blank` 并存 —— 意图矛盾，blank 必被吞掉；
 *   2. 段既不是 join / var / text / blank 四种形态之一（含空对象 `{}`）—— 会被静默丢弃；
 *   3. 段既不是对象也不是字符串 —— 引擎无法解析。
 *
 * 宽松处：单独出现的 `{ text: '' }`（不带 blank）放行，视为有意的空占位。
 *
 * @param {unknown} segments 段数组（允许 undefined/null，视为未提供）
 * @param {string} path 错误定位路径
 * @returns {void}
 * @throws {SchemaValidationError} 任一段不合法
 */
function assertValidSegments(segments, path) {
  if (segments === undefined || segments === null) return;
  if (!Array.isArray(segments)) {
    throw new SchemaValidationError(`${path}: segments 必须是数组`);
  }

  segments.forEach((seg, i) => {
    const at = `${path}[${i}]`;

    // 规则 3：字符串段合法（引擎会转成 { text: seg }）；其余非对象一律非法。
    if (typeof seg === 'string') return;
    if (!isPlainObject(seg)) {
      throw new SchemaValidationError(
        `${at}: 段必须是对象或字符串，收到 ${seg === null ? 'null' : typeof seg}。`
        + '合法形态：{ join: [...] } / { var: "key" } / { text: "..." } / { blank: true }'
      );
    }

    const hasJoin = isJoinSegment(seg);
    const hasVar = isVarSegment(seg);
    const hasText = isTextSegment(seg);
    const hasBlank = hasEffectiveBlank(seg);

    // 规则 1：text:'' + blank 并存 —— text 分支先命中并 return，blank 被吞掉。
    // 仅在 join / var 均未命中时判定（此时 text 分支确实会赢）。
    if (!hasJoin && !hasVar && seg.text === '' && hasBlank) {
      throw new SchemaValidationError(
        `${at}: 留白请写 { blank: true }，不可写 { text: "", blank: ... } —— `
        + 'text 分支会先命中并吞掉 blank，渲染为空白无下划线。'
        + '如需自定义留白长度请写 { blank: "＿＿＿＿" }'
      );
    }

    // 规则 2：四种形态一个都不具备（含空对象 {}）—— 会被 resolveSegments 静默丢弃。
    if (!hasJoin && !hasVar && !hasText && !hasBlank) {
      throw new SchemaValidationError(
        `${at}: 该段会被 resolveSegments 静默丢弃，不产出任何内容。`
        + '段必须至少具备 join / var / text / blank 四种形态之一：'
        + '{ join: ["a","b"] } / { var: "key" } / { text: "文本" } / { blank: true }'
      );
    }
  });
}

/**
 * 校验区块（section）定义（递归处理 group.children）。
 * @param {unknown} section 区块定义
 * @param {string} path 错误定位路径
 * @param {number} depth 递归深度
 * @returns {void}
 * @throws {SchemaValidationError} 区块非法时抛出
 */
function assertValidSection(section, path, depth = 0) {
  if (depth > 6) {
    throw new SchemaValidationError(`${path}: group 嵌套层级超过 6 层`);
  }
  if (!isPlainObject(section)) {
    throw new SchemaValidationError(`${path}: 区块必须是对象`);
  }
  if (!SECTION_TYPES.includes(section.type)) {
    throw new SchemaValidationError(
      `${path}.type: 「${String(section.type)}」不在白名单，仅允许 ${SECTION_TYPES.join(' / ')}`
    );
  }
  assertValidCondition(section.visibleWhen, `${path}.visibleWhen`);

  // ── segments 承载位（与 resolveSegments 的三个共用方一一对应）────────────────
  // 1) paragraph.segments —— schemaUtils.js:620 `resolveSegments(section.segments || [])`
  //    （历史上曾误写为 paragraph.value，一并兜底校验）
  if (section.type === 'paragraph') {
    assertValidSegments(section.segments, `${path}.segments`);
    if (Array.isArray(section.value)) {
      assertValidSegments(section.value, `${path}.value`);
    }
  }

  // 2) infoTable.rows[].value —— schemaUtils.js:662 `valueToRuns(row.value)`
  if (section.type === 'infoTable' && Array.isArray(section.rows)) {
    section.rows.forEach((row, i) => {
      if (isPlainObject(row) && Array.isArray(row.value)) {
        assertValidSegments(row.value, `${path}.rows[${i}].value`);
      }
    });
  }

  // 3) signBlock.items[].value —— schemaUtils.js:747 `valueToRuns(it.value)`
  if (section.type === 'signBlock' && Array.isArray(section.items)) {
    section.items.forEach((item, i) => {
      if (isPlainObject(item) && Array.isArray(item.value)) {
        assertValidSegments(item.value, `${path}.items[${i}].value`);
      }
    });
  }

  if (section.type === 'group') {
    if (!Array.isArray(section.children)) {
      throw new SchemaValidationError(`${path}.children: group 区块必须提供 children 数组`);
    }
    section.children.forEach((child, i) =>
      assertValidSection(child, `${path}.children[${i}]`, depth + 1)
    );
  }
}

/**
 * 校验 docSchema 契约合法性。
 *
 * 校验维度：layoutMode / fields（key 规则 + 唯一性 + type 白名单 + 条件 DSL）
 * / rules（scope + 条件 DSL） / layout.sections（区块白名单 + group 递归）。
 *
 * @param {unknown} docSchema 待校验的 schema 主体
 * @returns {Object} 校验通过的 docSchema（原对象引用）
 * @throws {SchemaValidationError} 任一维度不合法
 */
function assertValidDocSchema(docSchema) {
  if (docSchema === undefined || docSchema === null) {
    throw new SchemaValidationError('docSchema 不能为空');
  }
  if (!isPlainObject(docSchema)) {
    throw new SchemaValidationError('docSchema 必须是对象');
  }

  const layoutMode = docSchema.layoutMode === undefined ? 'auto' : docSchema.layoutMode;
  if (!LAYOUT_MODES.includes(layoutMode)) {
    throw new SchemaValidationError(
      `layoutMode: 「${String(layoutMode)}」非法，仅允许 ${LAYOUT_MODES.join(' / ')}`
    );
  }

  if (docSchema.meta !== undefined && !isPlainObject(docSchema.meta)) {
    throw new SchemaValidationError('meta: 必须是对象');
  }

  // 页眉左右两栏同样走 resolveSegments（schemaUtils.js:835-836），沿用同一段契约。
  if (isPlainObject(docSchema.meta) && isPlainObject(docSchema.meta.headerMeta)) {
    assertValidSegments(docSchema.meta.headerMeta.left, 'meta.headerMeta.left');
    assertValidSegments(docSchema.meta.headerMeta.right, 'meta.headerMeta.right');
  }

  const fields = docSchema.fields === undefined ? [] : docSchema.fields;
  if (!Array.isArray(fields)) {
    throw new SchemaValidationError('fields: 必须是数组');
  }
  const seenKeys = new Set();
  fields.forEach((f, i) => assertValidField(f, i, seenKeys));

  const rules = docSchema.rules === undefined ? [] : docSchema.rules;
  if (!Array.isArray(rules)) {
    throw new SchemaValidationError('rules: 必须是数组');
  }
  rules.forEach((rule, i) => {
    const at = `rules[${i}]`;
    if (!isPlainObject(rule)) {
      throw new SchemaValidationError(`${at}: 规则必须是对象`);
    }
    const scope = rule.scope === undefined ? 'form' : rule.scope;
    if (typeof scope !== 'string' || (scope !== 'form' && !scope.startsWith('item:'))) {
      throw new SchemaValidationError(`${at}.scope: 必须是 'form' 或 'item:<fieldKey>'`);
    }
    if (typeof rule.message !== 'string' || !rule.message.trim()) {
      throw new SchemaValidationError(`${at}.message: 必须是非空字符串`);
    }
    assertValidCondition(rule.when, `${at}.when`);
  });

  if (layoutMode === 'custom') {
    const layout = docSchema.layout;
    if (!isPlainObject(layout) || !Array.isArray(layout.sections)) {
      throw new SchemaValidationError("layoutMode='custom' 时必须提供 layout.sections 数组");
    }
    layout.sections.forEach((s, i) => assertValidSection(s, `layout.sections[${i}]`));
  } else if (docSchema.layout !== undefined) {
    if (!isPlainObject(docSchema.layout)) {
      throw new SchemaValidationError('layout: 必须是对象');
    }
    if (docSchema.layout.sections !== undefined) {
      if (!Array.isArray(docSchema.layout.sections)) {
        throw new SchemaValidationError('layout.sections: 必须是数组');
      }
      docSchema.layout.sections.forEach((s, i) => assertValidSection(s, `layout.sections[${i}]`));
    }
  }

  return docSchema;
}

/**
 * 从 docSchema.fields 派生 variables[]（模型侧变量面板数据源）。
 *
 * ⚠️ 服务端始终以本函数产物为准，**忽略客户端传入的 variables**。
 *
 * @param {unknown} docSchema schema 主体
 * @returns {Array<{key:string,label:string,source:string,fieldPath:string}>} 变量数组
 */
function deriveVariables(docSchema) {
  if (!isPlainObject(docSchema) || !Array.isArray(docSchema.fields)) return [];
  return docSchema.fields
    .filter((f) => isPlainObject(f) && typeof f.key === 'string' && f.key)
    .map((f) => ({
      key: f.key,
      label: typeof f.label === 'string' && f.label ? f.label : f.key,
      source: VARIABLE_SOURCES.includes(f.source) ? f.source : 'manual',
      fieldPath: typeof f.fieldPath === 'string' ? f.fieldPath : '',
    }));
}

/**
 * 判断 category 是否合法。
 * @param {unknown} category 分类值
 * @returns {boolean} 是否在 12 项白名单内
 */
function isValidCategory(category) {
  return typeof category === 'string' && CATEGORY_VALUES.includes(category);
}

module.exports = {
  CATEGORY_VALUES,
  CATEGORY_LABELS,
  SCHEMA_VERSION,
  FIELD_TYPES,
  RESERVED_FIELD_TYPES,
  UNSUPPORTED_FIELD_KEYS,
  SECTION_TYPES,
  OPERATORS,
  COMBINATORS,
  LAYOUT_MODES,
  VARIABLE_SOURCES,
  FIELD_KEY_PATTERN,
  SchemaValidationError,
  assertValidCondition,
  assertValidSegments,
  assertValidDocSchema,
  deriveVariables,
  isValidCategory,
};
