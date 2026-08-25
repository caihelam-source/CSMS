/**
 * schemaUtils.js — Schema 驱动合规文书引擎 · 纯函数内核
 *
 * ⚠️ 本文件是「解释器」核心，**禁止 import React**（保证可在 vitest node 环境下单测）。
 * 所有函数均为纯函数：无 DOM 依赖、无副作用、不执行任何用户输入的代码。
 *
 * 核心手法（设计 §1.1 / §7）：
 *   docSchema（AST）+ data → buildDocPlan() → PlanNode[]（带 className 的计划树）
 *   React 层（SchemaDocRenderer）只做「计划树 → JSX」的机械映射。
 * 这样既能单测纯函数，又让 docx 导出锚点（DOC_CLASS）稳定可守卫。
 *
 * 安全红线（§7.10）：本文件不出现 eval / new Function / dangerouslySetInnerHTML，
 * 条件与校验只走 JSON DSL + 算子白名单（evalCondition 纯 switch）。
 */

/* =========================================================
 * 一、常量与注册表（设计 §7.2 / §7.3 / §7.4 / §7.5 / §7.6）
 * ========================================================= */

/** 未填写时在正式文档中显示的占位下划线（8 个全角下划线，与 MVP 完全一致）。 */
export const BLANK = '＿＿＿＿＿＿＿＿'

/**
 * ⚠️⚠️ docx 导出锚点注册表（设计 §7.6）。
 * 每个 class 都是 client/src/utils/docxFromDom.js 的 convertElement 分派键。
 * "顺手"重命名任何一个都会静默破坏 Word 导出。修改前必须同步更新
 * SchemaDocRenderer、document.css、docxFromDom.js 与 docPlan.test.js 断言。
 */
export const DOC_CLASS = {
  page: 'doc-page',
  root: 'doc',
  company: 'doc-company',
  title: 'doc-title',
  subtitle: 'doc-subtitle',
  rule: 'doc-rule',
  meta: 'doc-meta',
  p: 'doc-p',
  pFlat: 'doc-p-flat',
  h2: 'doc-h2',
  label: 'doc-label',
  blank: 'doc-blank',
  quote: 'doc-quote',
  table: 'doc-table',
  thKey: 'doc-th-key',
  center: 'doc-center',
  list: 'doc-list',
  box: 'doc-box',
  ol: 'doc-ol',
  sign: 'doc-sign',
  signGrid: 'doc-sign-grid',
  signRow: 'doc-sign-row',
  signLabel: 'doc-sign-label',
  line: 'doc-line',
  note: 'doc-note',
  empty: 'doc-empty',
}

/** 本期开放的 9 类字段（设计 §7.2）。P2 预留 number/multiselect/matrix 不在此列。 */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'select',
  'boolean',
  'list',
  'clauses',
  'checklist',
  'objectList',
]

/** 10 类区块（设计 §7.3）。不提供 'html' 区块类型（安全红线）。 */
export const SECTION_TYPES = [
  'heading',
  'paragraph',
  'infoTable',
  'checkList',
  'clauseList',
  'objectTable',
  'signBlock',
  'note',
  'divider',
  'group',
]

/** 条件 DSL 算子白名单（10 个，设计 §7.4）。 */
export const OPERATORS = ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy']

/** 条件 DSL 组合器（3 个，设计 §7.4）。 */
export const COMBINATORS = ['all', 'any', 'not']

/* =========================================================
 * 二、通用纯工具
 * ========================================================= */

/**
 * 深拷贝纯数据（对象／数组／基本类型）。
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

/**
 * 规范化 string[] 值（容错：过滤 null / undefined / 空行）。
 * @param {*} value
 * @returns {string[]}
 */
export function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? ''))
  const text = String(value ?? '').trim()
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * 规范化 checklist 值（容错：允许纯字符串条目 → 视为未勾选）。
 * @param {*} value
 * @returns {Array<{text:string, checked:boolean}>}
 */
export function normalizeCheckItems(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) =>
    typeof item === 'string'
      ? { text: item, checked: false }
      : { text: String(item?.text ?? ''), checked: Boolean(item?.checked) },
  )
}

/**
 * 统一选项写法：字符串数组或 {value,label} 数组均可。
 * @param {Array<string|{value:string,label:string}>} options
 * @returns {Array<{value:string,label:string}>}
 */
export function normalizeOptions(options = []) {
  return options.map((item) =>
    typeof item === 'string' ? { value: item, label: item } : { value: item.value, label: item.label },
  )
}

/**
 * 将 `YYYY-MM-DD` 格式化为中文长日期（设计 §7.11）。
 * @param {string} value 原始日期字符串
 * @param {string} fallback 空值占位（默认 BLANK）
 * @returns {string}
 */
export function formatDate(value, fallback = BLANK) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  const matched = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (!matched) return raw
  return `${matched[1]}年${Number(matched[2])}月${Number(matched[3])}日`
}

/**
 * 取某值在「真」语义下是否非空（用于 truthy / falsy 算子）。
 * 规则：true→真；false/空串/空数组→假；字符串非空→真；
 *     checklist 条目数组：任一 checked→真，否则→假；数字非 0→真。
 * @param {*} v
 * @returns {boolean}
 */
function isTruthy(v) {
  if (v === true) return true
  if (v === false || v == null) return false
  if (Array.isArray(v)) {
    if (v.length === 0) return false
    if (typeof v[0] === 'object' && v[0] !== null && 'checked' in v[0]) {
      return v.some((it) => Boolean(it && it.checked))
    }
    return true
  }
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return v !== 0
  return Boolean(v)
}

/**
 * 数值化比较；任一非数字 → NaN（调用方判 NaN 即视为 false）。
 * @param {*} a
 * @param {*} b
 * @returns {number}
 */
function numCmp(a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) return NaN
  return na - nb
}

/**
 * 解析条件中的字段路径（设计 §3.4 作用域变量）。
 *   $item.<key> → scope.$item[key]（objectList 逐项作用域）
 *   $index       → scope.$index（0 基）
 *   $index1      → scope.$index1（1 基）
 *   其它         → data[field]
 * @param {string} field
 * @param {object} data
 * @param {object} scope
 * @returns {*}
 */
function resolveConditionPath(field, data, scope) {
  if (field == null) return undefined
  const f = String(field)
  if (f === '$index') return scope.$index
  if (f === '$index1') return scope.$index1
  if (f.startsWith('$item.')) {
    const key = f.slice(6)
    return scope.$item ? scope.$item[key] : undefined
  }
  return data ? data[f] : undefined
}

/* =========================================================
 * 三、条件 DSL 求值（10 算子 + 3 组合器，纯 switch）
 * ========================================================= */

/**
 * 求值单个条件（设计 §3.4 / §7.4）。
 * - 组合器：{ all: [c] } / { any: [c] } / { not: c }
 * - 原子条件：{ field, op, value }
 * - 白名单外算子 → 返回 false + console.warn（绝不 eval，绝不抛错）。
 *
 * @param {object|null} cond 条件对象（或组合器）
 * @param {object} data 表单数据
 * @param {object} [scope] 逐项作用域 { $item, $index, $index1 }
 * @returns {boolean}
 */
export function evalCondition(cond, data = {}, scope = {}) {
  if (!cond || typeof cond !== 'object') return false
  if (Array.isArray(cond.all)) return cond.all.every((c) => evalCondition(c, data, scope))
  if (Array.isArray(cond.any)) return cond.any.some((c) => evalCondition(c, data, scope))
  if (cond.not) return !evalCondition(cond.not, data, scope)

  const op = cond.op
  if (!OPERATORS.includes(op)) {
    if (op !== undefined) {
      console.warn(`[evalCondition] 未知算子 "${op}"，按 false 处理（安全默认，非 RCE）`)
    }
    return false
  }

  const raw = resolveConditionPath(cond.field, data, scope)
  switch (op) {
    case 'eq':
      return String(raw ?? '') === String(cond.value ?? '')
    case 'ne':
      return String(raw ?? '') !== String(cond.value ?? '')
    case 'in':
      return Array.isArray(cond.value) && cond.value.map(String).includes(String(raw ?? ''))
    case 'nin':
      return Array.isArray(cond.value) && !cond.value.map(String).includes(String(raw ?? ''))
    case 'gt':
      return numCmp(raw, cond.value) > 0
    case 'gte':
      return numCmp(raw, cond.value) >= 0
    case 'lt':
      return numCmp(raw, cond.value) < 0
    case 'lte':
      return numCmp(raw, cond.value) <= 0
    case 'truthy':
      return isTruthy(raw)
    case 'falsy':
      return !isTruthy(raw)
    default:
      return false
  }
}

/* =========================================================
 * 四、字段可见性 / 空值判定
 * ========================================================= */

/**
 * 字段是否可见（visibleWhen 走 JSON 条件 DSL）。
 * @param {object} field
 * @param {object} data
 * @returns {boolean}
 */
export function isFieldVisible(field = {}, data = {}) {
  if (!field) return false
  if (field.visibleWhen && typeof field.visibleWhen === 'object') {
    return evalCondition(field.visibleWhen, data, {})
  }
  return true
}

/**
 * 按字段类型判断值是否为「空」（设计 §7.2）。
 * @param {object} field
 * @param {*} value
 * @returns {boolean}
 */
export function isEmptyValue(field = {}, value) {
  switch (field.type) {
    case 'multiselect':
    case 'list':
    case 'clauses':
    case 'objectList':
      return !Array.isArray(value) || value.length === 0
    case 'checklist':
      return !Array.isArray(value) || value.length === 0 || value.every((it) => !(it && it.checked))
    case 'boolean':
      return value !== true
    case 'matrix':
      return !value || Object.keys(value).length === 0
    default:
      return String(value ?? '').trim() === ''
  }
}

/* =========================================================
 * 五、初值 / 示例数据 / 派生变量
 * ========================================================= */

/**
 * 按字段类型生成单个字段初始值（设计 §7.2）。
 * @param {object} field
 * @returns {*}
 */
export function createInitialFieldValue(field = {}) {
  if (field.default !== undefined) return deepClone(field.default)
  switch (field.type) {
    case 'boolean':
      return false
    case 'list':
    case 'clauses':
    case 'checklist':
    case 'objectList':
    case 'multiselect':
      return []
    default:
      return ''
  }
}

/**
 * 生成某 docSchema 的空白表单数据。
 * @param {object} docSchema
 * @returns {object}
 */
export function createInitialData(docSchema = {}) {
  const data = {}
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  fields.forEach((field) => {
    if (field && field.key != null) data[field.key] = createInitialFieldValue(field)
  })
  return data
}

/**
 * 生成某 docSchema 的示例数据（空白初值之上叠加 sampleData）。
 * @param {object} docSchema
 * @param {object} [sampleData]
 * @returns {object}
 */
export function createSampleData(docSchema = {}, sampleData = {}) {
  const data = createInitialData(docSchema)
  const sample = sampleData && typeof sampleData === 'object' ? sampleData : {}
  Object.keys(sample).forEach((key) => {
    data[key] = deepClone(sample[key])
  })
  return data
}

/**
 * 由 docSchema.fields 派生变量清单（设计 §3.1 variables 形状）。
 * @param {object} docSchema
 * @returns {Array<{key:string,label:string,source:string,fieldPath:string}>}
 */
export function deriveVariables(docSchema = {}) {
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  return fields
    .filter((field) => field && field.key != null)
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      source: field.source || 'manual',
      fieldPath: field.fieldPath || '',
    }))
}

/* =========================================================
 * 六、校验（跨字段 form 级 + 逐项 item 级 rules DSL）
 * ========================================================= */

/**
 * 消息模板填充：支持 {{fieldKey}} / {{$item.key}} / {{$index}} / {{$index1}}。
 * @param {string} message
 * @param {{data:object,item:object|null,index:number,index1:number}} ctx
 * @returns {string}
 */
function fillTemplate(message, ctx) {
  if (!message || typeof message !== 'string') return ''
  return message.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw) => {
    const key = raw.trim()
    if (key === '$index') return String(ctx.index ?? '')
    if (key === '$index1') return String(ctx.index1 ?? '')
    if (key.startsWith('$item.')) {
      const k = key.slice(6)
      const v = ctx.item ? ctx.item[k] : undefined
      return v == null ? '' : String(v)
    }
    const v = ctx.data ? ctx.data[key] : undefined
    return v == null ? '' : String(v)
  })
}

/**
 * 校验 docSchema + data，返回中文错误信息数组（空数组表示通过）。
 * @param {object} docSchema
 * @param {object} data
 * @returns {string[]}
 */
export function validateSchemaData(docSchema = {}, data = {}) {
  const errors = []
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  fields.forEach((field) => {
    if (!field || field.key == null) return
    if (!isFieldVisible(field, data)) return
    const value = data ? data[field.key] : undefined
    if (field.required && isEmptyValue(field, value)) {
      errors.push(`「${field.label || field.key}」为必填项。`)
    }
  })

  const rules = Array.isArray(docSchema.rules) ? docSchema.rules : []
  rules.forEach((rule) => {
    if (!rule || !rule.when) return
    const scope = rule.scope || 'form'
    if (scope === 'form') {
      if (evalCondition(rule.when, data, {})) {
        errors.push(fillTemplate(rule.message || '', { data, item: null, index: -1, index1: -1 }))
      }
      return
    }
    if (scope.startsWith('item:')) {
      const fieldKey = scope.slice(5)
      const arr = data && Array.isArray(data[fieldKey]) ? data[fieldKey] : []
      arr.forEach((item, i) => {
        if (evalCondition(rule.when, data, { $item: item, $index: i, $index1: i + 1 })) {
          errors.push(fillTemplate(rule.message || '', { data, item, index: i, index1: i + 1 }))
        }
      })
    }
  })
  return errors
}

/* =========================================================
 * 七、文件名解析（设计 §7.11）
 * ========================================================= */

/**
 * 生成 YYYYMMDD 紧凑日期串。
 * @returns {string}
 */
function todayCompact() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

/**
 * 将 fileNamePattern 中的 {{fieldKey}} 与内置 {{today}}（YYYYMMDD）替换为实际值。
 * @param {string} pattern 如 "{{companyName}}-董事确认函-{{today}}"
 * @param {object} data
 * @returns {string}
 */
export function resolveFileName(pattern, data = {}) {
  if (!pattern || typeof pattern !== 'string') return ''
  const today = todayCompact()
  return pattern.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    if (key === 'today') return today
    const v = data ? data[key] : undefined
    return v == null ? '' : String(v)
  })
}

/* =========================================================
 * 八、buildDocPlan —— docSchema + data → PlanNode[]
 * ========================================================= */

/**
 * 构造一个计划节点。
 * @param {string} type
 * @param {string} className
 * @param {object} props
 * @param {Array} [children]
 * @returns {object}
 */
function makeNode(type, className, props, children = []) {
  return { type, className, props: props || {}, children }
}

/**
 * 中文序号（1-99），用于 autoNumber 章节前缀。
 * @param {number} n
 * @returns {string}
 */
function chineseNum(n) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 0) return String(n)
  if (n <= 10) return digits[n]
  if (n < 20) return '十' + digits[n - 10]
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return digits[tens] + '十' + (ones ? digits[ones] : '')
  }
  return String(n)
}

/**
 * 将 segments[] 解析为「runs」数组（每个 run = { text, bold?, blank? }）。
 * 支持：纯文本段 {text,bold} / 变量段 {var,blank,format,bold} / 多字段拼接 {join,separator,blank}
 *      / 纯留白段 {blank}（不绑字段，直接产出留白）。
 * 变量空值 → { text: blank ?? BLANK, blank: true }（设计 §3.3 / §7.5：空值必须留白可手写）。
 * ⚠️ 四种形态都不中的段（如 {}）会被静默跳过、不产出任何 run —— 需要留白请用 {blank:true}，
 *    不要依赖「绑一个 fields 里不存在的哑 var」这种副作用写法。
 * @param {Array} segments
 * @param {object} data
 * @returns {Array<{text:string, bold?:boolean, blank?:boolean}>}
 */
function resolveSegments(segments, data) {
  if (!Array.isArray(segments)) return []
  const runs = []
  segments.forEach((seg) => {
    if (!seg || typeof seg !== 'object') {
      if (typeof seg === 'string') runs.push({ text: seg })
      return
    }
    if (Array.isArray(seg.join)) {
      const parts = seg.join.map((k) => (data ? data[k] : undefined)).map((v) => (v == null ? '' : String(v)))
      const joined = parts.filter((p) => p !== '').join(seg.separator || ' ／ ')
      if (!joined) runs.push({ text: seg.blank || BLANK, blank: true })
      else runs.push({ text: joined })
      return
    }
    if (seg.var !== undefined && seg.var !== null && seg.var !== '') {
      const raw = data ? data[seg.var] : undefined
      const empty =
        raw == null || (typeof raw === 'string' && raw.trim() === '') || (Array.isArray(raw) && raw.length === 0)
      if (empty) {
        runs.push({ text: seg.blank || BLANK, blank: true })
      } else if (seg.format === 'date') {
        runs.push({ text: formatDate(String(raw)), bold: Boolean(seg.bold) })
      } else {
        runs.push({ text: String(raw), bold: Boolean(seg.bold) })
      }
      return
    }
    if (typeof seg.text === 'string') {
      runs.push({ text: seg.text, bold: Boolean(seg.bold) })
      return
    }
    // ⭐ 纯留白段（一等公民）：不绑任何字段、仅表达「此处留白供手写」。
    // { blank: true } → BLANK（8 全角下划线）；{ blank: '＿＿＿＿' } → 自定义长度。
    // 必须放在最后一个分支：join / var / text 三分支已各自 return，故其行为完全不变
    // （历史上 blank 只作为 var 段的辅助属性出现，会先被 var 分支拦截，向后兼容）。
    if (seg.blank !== undefined && seg.blank !== null && seg.blank !== false) {
      const text = typeof seg.blank === 'string' && seg.blank !== '' ? seg.blank : BLANK
      runs.push({ text, blank: true })
    }
  })
  return runs
}

/**
 * 递归展开区块列表：
 *  - 条件隐藏的区块（visibleWhen 不符）整体跳过（其内 heading 也不占号 → 实现 autoNumber 连续）；
 *  - group 透明展开：其可见子节点直接上提，不产出额外 DOM 包裹层。
 * @param {Array} sections
 * @param {object} data
 * @param {{headingCounter:number}} ctx
 * @returns {Array}
 */
function buildSections(sections, data, ctx) {
  const out = []
  if (!Array.isArray(sections)) return out
  sections.forEach((section) => {
    if (!section || typeof section !== 'object') return
    if (section.visibleWhen && typeof section.visibleWhen === 'object') {
      if (!evalCondition(section.visibleWhen, data, {})) return
    }
    if (section.type === 'group') {
      out.push(...buildSections(section.children || [], data, ctx))
      return
    }
    const node = buildSection(section, data, ctx)
    if (node) out.push(node)
  })
  return out
}

/**
 * 将单个 section 编译为计划节点（见设计 §3.3）。
 * @param {object} section
 * @param {object} data
 * @param {{headingCounter:number}} ctx
 * @returns {object|null}
 */
function buildSection(section, data, ctx) {
  switch (section.type) {
    case 'heading': {
      let text = section.text || ''
      if (section.autoNumber) {
        ctx.headingCounter += 1
        text = `${chineseNum(ctx.headingCounter)}、${text}`
      }
      return makeNode('heading', DOC_CLASS.h2, { text })
    }
    case 'paragraph': {
      const runs = resolveSegments(section.segments || [], data)
      const cls = [DOC_CLASS.p]
      if (section.flat) cls.push(DOC_CLASS.pFlat)
      if (section.bold) cls.push(DOC_CLASS.label)
      return makeNode('paragraph', cls.join(' '), { runs, flat: Boolean(section.flat), bold: Boolean(section.bold) })
    }
    case 'infoTable':
      return makeInfoTable(section, data)
    case 'checkList':
      return makeCheckList(section, data)
    case 'clauseList':
      return makeClauseList(section, data)
    case 'objectTable':
      return makeObjectTable(section, data)
    case 'signBlock':
      return makeSignBlock(section, data)
    case 'note': {
      // 🔴 支持可编辑：text 可为字符串，或 { var } 引用字段（使「存档说明」文字可改）
      let noteText = section.text
      if (noteText && typeof noteText === 'object' && noteText.var) {
        const raw = data ? data[noteText.var] : undefined
        const empty = raw == null || (typeof raw === 'string' && raw.trim() === '')
        noteText = empty ? (noteText.blank || BLANK) : String(raw)
      } else if (Array.isArray(section.segments) && section.segments.length) {
        noteText = resolveSegments(section.segments, data)
          .map((r) => r.text)
          .join('')
      }
      return makeNode('note', DOC_CLASS.note, { text: noteText || '' })
    }
    case 'divider':
      return makeNode('divider', DOC_CLASS.rule, {})
    default:
      // 未知区块类型：安全丢弃（不提供 html 区块），有显式文本则降级为 note
      if (section.text) return makeNode('note', DOC_CLASS.note, { text: String(section.text) })
      return null
  }
}

/**
 * 将 value（可能是 segments[] 或纯字符串）统一成 runs。
 * @param {*} value
 * @param {object} data
 * @returns {Array}
 */
function valueToRuns(value, data) {
  if (Array.isArray(value)) return resolveSegments(value, data)
  if (value == null) return []
  return [{ text: String(value) }]
}

function makeInfoTable(section, data) {
  const rows = (section.rows || []).map((row) => ({
    label: row.label || '',
    runs: valueToRuns(row.value, data),
  }))
  return makeNode('infoTable', DOC_CLASS.table, { rows })
}

function makeCheckList(section, data) {
  if (section.mode === 'single') {
    const checked = section.field ? Boolean(data ? data[section.field] : false) : false
    return makeNode('checkList', DOC_CLASS.list, {
      mode: 'single',
      checked,
      text: section.text || '',
      placeholder: section.placeholder || '',
    })
  }
  const fieldKey = section.field
  const raw = fieldKey && data ? data[fieldKey] : undefined
  const items = normalizeCheckItems(raw)
  return makeNode('checkList', DOC_CLASS.list, {
    mode: 'items',
    items,
    placeholder: section.placeholder || '（暂无条目）',
  })
}

function makeClauseList(section, data) {
  const raw = section.field && data ? data[section.field] : undefined
  const items = normalizeStringList(raw)
  const className =
    section.variant === 'ordered' ? DOC_CLASS.ol : section.variant === 'plain' ? DOC_CLASS.p : DOC_CLASS.list
  return makeNode('clauseList', className, {
    items,
    variant: section.variant || 'checked',
    marker: section.marker || '☑',
    quote: Boolean(section.quote),
    placeholder: section.placeholder || '（暂无条款）',
  })
}

/**
 * objectTable 单元格计算（含空值三态 blankWhen，设计 §3.3 / T05 验收点 3）。
 * @param {object} col
 * @param {object} item 行对象
 * @param {number} idx 0 基行号
 * @returns {{text:string, blank:boolean}}
 */
function makeCell(col, item, idx) {
  if (col.type === 'index') {
    return { text: String(idx + 1), blank: false }
  }
  const raw = item ? item[col.key] : undefined
  const empty = raw == null || (typeof raw === 'string' && raw.trim() === '')
  if (col.blankWhen && typeof col.blankWhen === 'object') {
    const cond = col.blankWhen.cond
    const whenTrue = col.blankWhen.whenTrue
    const whenFalse = col.blankWhen.whenFalse
    const isTrue = cond
      ? evalCondition(cond, {}, { $item: item, $index: idx, $index1: idx + 1 })
      : !empty
    if (empty) {
      // 条件为真 → whenTrue（如 ＿＿＿＿，留白可写）；否则 → whenFalse（如 —，非留白）
      if (isTrue) return { text: String(whenTrue != null ? whenTrue : col.blank || BLANK), blank: true }
      return { text: String(whenFalse != null ? whenFalse : col.blank || BLANK), blank: false }
    }
    return { text: String(raw), blank: false }
  }
  if (empty) return { text: col.blank || BLANK, blank: true }
  return { text: String(raw), blank: false }
}

function makeObjectTable(section, data) {
  const raw = section.field && data ? data[section.field] : undefined
  const items = Array.isArray(raw) ? raw : []
  const columns = Array.isArray(section.columns) ? section.columns : []
  const rows = items.map((item, idx) => ({ cells: columns.map((col) => makeCell(col, item, idx)) }))
  return makeNode('objectTable', DOC_CLASS.table, {
    columns,
    rows,
    emptyText: section.emptyText || '（暂无条目）',
  })
}

function makeSignBlock(section, data) {
  const items = (section.items || []).map((it) => ({
    label: it.label || '',
    runs: valueToRuns(it.value, data),
  }))
  return makeNode('signBlock', DOC_CLASS.sign, { items, note: section.note || '' })
}

/**
 * auto 布局自动成文（设计 §4.2）：连续 text/date/select 合并为 infoTable，
 * 其余按类型映射到对应区块。
 * @param {object} docSchema
 * @returns {Array}
 */
function autoSections(docSchema) {
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  const sections = []
  let infoRows = null
  const flushInfo = () => {
    if (infoRows && infoRows.length) {
      sections.push({ type: 'infoTable', rows: infoRows })
      infoRows = null
    }
  }
  fields.forEach((field) => {
    if (!field || field.key == null) return
    const type = field.type
    if (type === 'text' || type === 'date' || type === 'select') {
      infoRows = infoRows || []
      infoRows.push({ label: field.label || field.key, value: [{ var: field.key, blank: '＿＿＿＿' }] })
      return
    }
    flushInfo()
    if (type === 'boolean') {
      sections.push({ type: 'checkList', mode: 'single', field: field.key, text: field.checkboxLabel || field.label || field.key })
    } else if (type === 'clauses') {
      sections.push({ type: 'clauseList', field: field.key, variant: 'checked' })
    } else if (type === 'list') {
      sections.push({ type: 'clauseList', field: field.key, variant: 'plain' })
    } else if (type === 'checklist') {
      sections.push({ type: 'checkList', mode: 'items', field: field.key })
    } else if (type === 'textarea') {
      sections.push({ type: 'paragraph', segments: [{ var: field.key, blank: '（未填写）' }], flat: true })
    } else if (type === 'objectList') {
      const columns = [{ key: '$index', label: '序号', type: 'index', width: 6, align: 'center' }]
      // 兜底 field.columns：Builder 产出的 objectList 把列定义写在 columns（与
      // ObjectListEditor 读取的键名一致），缺此兜底会在 auto 布局里丢列、只剩序号列。
      const defs = field.itemDefFields || field.columns || []
      const datas = field.itemDataFields || []
      ;[...defs, ...datas].forEach((cf) => {
        columns.push({ key: cf.key, label: cf.label || cf.key, type: 'value', width: 0 })
      })
      sections.push({ type: 'objectTable', field: field.key, columns })
    }
  })
  flushInfo()
  return sections
}

/**
 * ⭐ 主入口：将 docSchema + data 编译为计划树 PlanNode[]。
 * 返回的是 `.doc` 根的直接子节点集合（公司名/标题/副标题/分隔线/页眉元信息/主体区块/存档说明），
 * 由 SchemaDocRenderer 负责包成 `<div class="doc-page"><article class="doc">…</article></div>`。
 *
 * 同时支持 layoutMode: 'custom'（preset 手写结构）与 'auto'（Builder 自动成文）。
 *
 * @param {object} docSchema
 * @param {object} data
 * @returns {Array<object>} PlanNode[]
 */
export function buildDocPlan(docSchema = {}, data = {}) {
  const meta = docSchema.meta || {}
  const body = []
  const ctx = { headingCounter: 0 }

  // 抬头公司名
  if (meta.companyField && data && data[meta.companyField] != null && String(data[meta.companyField]).trim() !== '') {
    body.push(makeNode('company', DOC_CLASS.company, { value: String(data[meta.companyField]) }))
  }
  // 标题
  if (meta.docTitle) {
    body.push(makeNode('title', DOC_CLASS.title, { text: meta.docTitle }))
  }
  // 副标题
  if (meta.docSubtitle) {
    body.push(makeNode('subtitle', DOC_CLASS.subtitle, { text: meta.docSubtitle }))
  }
  // 分隔线
  body.push(makeNode('divider', DOC_CLASS.rule, {}))
  // 页眉元信息（左右两栏）
  if (meta.headerMeta) {
    const left = resolveSegments(meta.headerMeta.left || [], data)
    const right = resolveSegments(meta.headerMeta.right || [], data)
    body.push(makeNode('meta', DOC_CLASS.meta, { left, right }))
  }
  // 主体区块
  const layoutMode = docSchema.layoutMode || 'auto'
  const sections =
    layoutMode === 'custom' && docSchema.layout && Array.isArray(docSchema.layout.sections)
      ? docSchema.layout.sections
      : autoSections(docSchema)
  body.push(...buildSections(sections, data, ctx))
  // 存档说明（archiveNote）→ note 区块（设计 §3.2）
  if (meta.archiveNote && String(meta.archiveNote).trim() !== '') {
    body.push(makeNode('note', DOC_CLASS.note, { text: meta.archiveNote }))
  }
  return body
}

export default buildDocPlan
