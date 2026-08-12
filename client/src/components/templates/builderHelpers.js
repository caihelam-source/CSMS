/**
 * @file builderHelpers.js
 * @description 模板编辑器（Builder）的纯函数工具集。
 *              负责：字段的新建 / 改名 / 排序、docSchema 组装、草稿校验、
 *              以及 options 与多行文本之间的互转。
 *
 *              本文件**不含任何 JSX / DOM 依赖**，可在 node 环境下直接被 vitest 单测。
 */

import { deepClone } from '../../schemaDoc/schemaUtils'
import { TEMPLATE_CATEGORY_VALUES } from '../../constants/templateCategories'

/**
 * 合法字段 key 正则：必须以字母或下划线开头，其后只能是字母 / 数字 / 下划线。
 * @type {RegExp}
 */
export const FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 本期 Builder 开放的 9 类字段及其中文标签。
 * 顺序即「新增字段」下拉菜单中的展示顺序。
 * @type {Array<{ value: string, label: string }>}
 */
export const BUILDER_FIELD_TYPES = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '下拉选择' },
  { value: 'boolean', label: '勾选项' },
  { value: 'list', label: '普通列表' },
  { value: 'clauses', label: '条款列表' },
  { value: 'checklist', label: '核对清单' },
  { value: 'objectList', label: '对象表格' },
]

/**
 * objectList 字段的列类型（子集，比顶层字段类型少）。
 * @type {Array<{ value: string, label: string }>}
 */
export const OBJECT_COLUMN_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '下拉' },
  { value: 'boolean', label: '勾选' },
]

/**
 * 允许的模板分类值集合。单一真源来自 constants/templateCategories.js，
 * 此处做形状兼容（字符串数组 / 对象数组均可）。
 * @type {string[]}
 */
export const CATEGORY_VALUES = (Array.isArray(TEMPLATE_CATEGORY_VALUES) ? TEMPLATE_CATEGORY_VALUES : [])
  .map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return ''
    return String(item.value ?? item.id ?? item.key ?? item.name ?? '')
  })
  .filter(Boolean)

/**
 * 取字段类型的中文标签，未知类型原样返回。
 * @param {string} type 字段类型
 * @returns {string} 中文标签
 */
export function getFieldTypeLabel(type = '') {
  const hit = BUILDER_FIELD_TYPES.find((item) => item.value === type)
  return hit ? hit.label : String(type || '')
}

/**
 * 判断字段类型是否被本期 Builder 支持。
 * @param {string} type 字段类型
 * @returns {boolean} 是否支持
 */
export function isSupportedFieldType(type = '') {
  return BUILDER_FIELD_TYPES.some((item) => item.value === type)
}

/**
 * 创建一个新字段，并自动分配一个与现有 key 不冲突的 key（field1 / field2 / ...）。
 * @param {string} [type='text'] 字段类型，不支持的类型会回落到 'text'
 * @param {string[]} [existingKeys=[]] 已被占用的 key 列表
 * @returns {Object} 新字段对象
 */
export function createBlankField(type = 'text', existingKeys = []) {
  const safeType = isSupportedFieldType(type) ? type : 'text'
  const used = new Set((Array.isArray(existingKeys) ? existingKeys : []).filter(Boolean).map(String))

  let index = used.size + 1
  let key = `field${index}`
  while (used.has(key)) {
    index += 1
    key = `field${index}`
  }

  const typeLabel = getFieldTypeLabel(safeType)
  /** @type {Record<string, any>} */
  const field = {
    key,
    label: `${typeLabel}${index}`,
    type: safeType,
    required: false,
    placeholder: '',
    help: '',
  }

  switch (safeType) {
    case 'select':
      field.options = [
        { value: '选项一', label: '选项一' },
        { value: '选项二', label: '选项二' },
      ]
      break
    case 'boolean':
      field.checkboxLabel = field.label
      field.default = false
      break
    case 'checklist':
      field.items = []
      break
    case 'objectList':
      field.columns = [{ key: 'name', label: '名称', type: 'text' }]
      break
    case 'list':
    case 'clauses':
      field.default = []
      break
    default:
      break
  }

  return field
}

/**
 * 创建 objectList 的一个新列，key 自动去重（col1 / col2 / ...）。
 * @param {string[]} [existingKeys=[]] 已占用的列 key
 * @returns {{ key: string, label: string, type: string }} 新列
 */
export function createBlankColumn(existingKeys = []) {
  const used = new Set((Array.isArray(existingKeys) ? existingKeys : []).filter(Boolean).map(String))
  let index = used.size + 1
  let key = `col${index}`
  while (used.has(key)) {
    index += 1
    key = `col${index}`
  }
  return { key, label: `列${index}`, type: 'text' }
}

/**
 * 修改指定字段的 key，并做重名 / 非法字符校验。
 * 校验不通过时返回原数组（不做任何修改）与错误信息。
 * @param {Object[]} fields 字段数组
 * @param {number} index 目标字段下标
 * @param {string} nextKey 新的 key
 * @returns {{ fields: Object[], error: string }} 新数组与错误信息（无错误时为空串）
 */
export function renameFieldKey(fields = [], index = -1, nextKey = '') {
  const list = Array.isArray(fields) ? fields : []
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return { fields: list, error: '字段不存在' }
  }

  const key = String(nextKey ?? '').trim()
  if (!key) {
    return { fields: list, error: '字段 key 不能为空' }
  }
  if (!FIELD_KEY_PATTERN.test(key)) {
    return { fields: list, error: `字段 key「${key}」非法：只能用字母、数字、下划线，且不能以数字开头` }
  }
  const duplicated = list.some((item, i) => i !== index && String(item?.key || '') === key)
  if (duplicated) {
    return { fields: list, error: `字段 key「${key}」已被其它字段占用` }
  }

  const next = list.map((item, i) => (i === index ? { ...item, key } : item))
  return { fields: next, error: '' }
}

/**
 * 拖拽排序：把 from 位置的字段移动到 to 位置。
 * 越界的 to 会被夹紧到合法区间；from 越界则原样返回。
 * @param {Object[]} fields 字段数组
 * @param {number} from 源下标
 * @param {number} to 目标下标
 * @returns {Object[]} 新数组（始终是新引用，除非 from 越界或原地未动）
 */
export function moveField(fields = [], from = -1, to = -1) {
  const list = Array.isArray(fields) ? [...fields] : []
  if (!Number.isInteger(from) || from < 0 || from >= list.length) return list
  if (!Number.isInteger(to)) return list

  const target = Math.max(0, Math.min(to, list.length - 1))
  if (target === from) return list

  const [item] = list.splice(from, 1)
  list.splice(target, 0, item)
  return list
}

/**
 * 组装完整的 docSchema。
 * 本期固定 layoutMode: 'auto'，由 buildDocPlan 的 autoSections() 自动成文，
 * 因此 layout.sections 恒为空数组、rules 恒为空数组。
 * @param {Object} [meta={}] 顶部 meta 草稿（含 docTitle / docSubtitle 等）
 * @param {Object[]} [fields=[]] 字段数组
 * @returns {Object} 完整 docSchema
 */
export function buildDocSchema(meta = {}, fields = []) {
  const safeMeta = meta && typeof meta === 'object' ? meta : {}
  return {
    schemaVersion: 1,
    layoutMode: 'auto',
    meta: {
      docTitle: String(safeMeta.docTitle || safeMeta.name || ''),
      docSubtitle: String(safeMeta.docSubtitle || ''),
      companyField: String(safeMeta.companyField || ''),
      headerMeta: Array.isArray(safeMeta.headerMeta) ? deepClone(safeMeta.headerMeta) : [],
      fileNamePattern: String(safeMeta.fileNamePattern || ''),
      archiveNote: String(safeMeta.archiveNote || ''),
    },
    fields: Array.isArray(fields) ? deepClone(fields) : [],
    rules: [],
    layout: { sections: [] },
  }
}

/**
 * 校验草稿，返回可直接展示给用户的中文错误清单。
 * 覆盖 6 类错误：模板名、分类、字段数量、key 合法性/重复、select 选项、objectList 列。
 * @param {Object} [meta={}] 顶部 meta 草稿（含 name / category）
 * @param {Object[]} [fields=[]] 字段数组
 * @returns {string[]} 错误清单，长度为 0 表示通过
 */
export function validateDraft(meta = {}, fields = []) {
  /** @type {string[]} */
  const errors = []
  const safeMeta = meta && typeof meta === 'object' ? meta : {}
  const list = Array.isArray(fields) ? fields : []

  if (!String(safeMeta.name || '').trim()) {
    errors.push('模板名称必填')
  }

  const category = String(safeMeta.category || '').trim()
  if (!category) {
    errors.push('请选择模板分类')
  } else if (CATEGORY_VALUES.length > 0 && !CATEGORY_VALUES.includes(category)) {
    errors.push(`模板分类「${category}」不在允许的分类范围内`)
  }

  if (list.length === 0) {
    errors.push('至少需要 1 个字段')
  }

  const seen = new Set()
  list.forEach((field, i) => {
    const position = `第 ${i + 1} 个字段`
    const rawLabel = String(field?.label || '').trim()
    const name = rawLabel ? `${position}「${rawLabel}」` : position
    const key = String(field?.key || '').trim()

    if (!key) {
      errors.push(`${name}：字段 key 不能为空`)
    } else if (!FIELD_KEY_PATTERN.test(key)) {
      errors.push(`${name}：字段 key「${key}」非法，只能用字母、数字、下划线且不能以数字开头`)
    } else if (seen.has(key)) {
      errors.push(`${name}：字段 key「${key}」与前面的字段重复`)
    }
    if (key) seen.add(key)

    if (!rawLabel) {
      errors.push(`${position}：字段名称必填`)
    }
    if (!isSupportedFieldType(field?.type)) {
      errors.push(`${name}：不支持的字段类型「${String(field?.type || '')}」`)
    }
    if (field?.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) {
      errors.push(`${name}：下拉选择至少需要配置 1 个选项`)
    }
    if (field?.type === 'objectList' && (!Array.isArray(field.columns) || field.columns.length === 0)) {
      errors.push(`${name}：对象表格至少需要配置 1 列`)
    }
  })

  return errors
}

/**
 * 多行文本 → options 数组。
 * 每行一项；支持 `value|label` 形式；空行自动忽略。
 * @param {string} [text=''] 多行文本
 * @returns {Array<{ value: string, label: string }>} options 数组
 */
export function parseOptionsText(text = '') {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('|')
      if (idx === -1) return { value: line, label: line }
      const value = line.slice(0, idx).trim()
      const label = line.slice(idx + 1).trim()
      return { value: value || label, label: label || value }
    })
    .filter((opt) => Boolean(opt.value))
}

/**
 * options 数组 → 多行文本（parseOptionsText 的逆运算）。
 * label 与 value 相同时只输出一段，避免冗余的 `a|a`。
 * @param {Array<string|{ value?: string, label?: string }>} [options=[]] options 数组
 * @returns {string} 多行文本
 */
export function stringifyOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((opt) => {
      if (opt === null || opt === undefined) return ''
      if (typeof opt === 'string') return opt.trim()
      const value = String(opt.value ?? '').trim()
      const label = String(opt.label ?? '').trim()
      if (!value) return label
      if (!label || label === value) return value
      return `${value}|${label}`
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * 多行文本 → 字符串数组（用于 checklist 预置条目、list 默认值等）。
 * @param {string} [text=''] 多行文本
 * @returns {string[]} 去空后的字符串数组
 */
export function parseLinesText(text = '') {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 字符串 / 对象数组 → 多行文本（parseLinesText 的逆运算）。
 * 兼容 checklist 的 `{ text }` / `{ label }` 形状。
 * @param {Array<string|{ text?: string, label?: string }>} [lines=[]] 条目数组
 * @returns {string} 多行文本
 */
export function stringifyLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map((item) => {
      if (item === null || item === undefined) return ''
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'object') return String(item.text ?? item.label ?? '').trim()
      return String(item).trim()
    })
    .filter(Boolean)
    .join('\n')
}
