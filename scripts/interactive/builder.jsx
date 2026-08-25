/**
 * builder.jsx — Claw 轻量 Schema 编辑器（Builder）
 *
 * 让用户在不写代码的情况下，可视化地组合「字段 + 区块」生成合规模板，
 * 并导出为可直接挂载进 Claw 的 JSON / CommonJS 预设。纯前端，无后端依赖。
 *
 * 设计约束（红线）：
 *   - 只读引用产品引擎：SchemaDocRenderer / schemaUtils / 9 个 preset，
 *     一行都不修改（本文件不属于产品代码）。
 *   - 用户输入只作为受控组件的值与文本节点，绝不 eval / innerHTML。
 *   - 复用既有契约：段落/信息表/签署区块里的 {{var:字段key}} / {{blank}}
 *     语法与 schemaUtils#resolveSegments 完全一致；签署留白只产出 {blank:true}，
 *     绝不允许 {text:'', blank:...} 这种历史伪留白写法。
 *
 * 挂载点：builder.html 的 <div id="builder-root">（不使用 #root，避免任何副作用冲突）。
 */

import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import SchemaDocRenderer from '../../client/src/schemaDoc/SchemaDocRenderer.jsx'
import {
  BLANK,
  FIELD_TYPES,
  SECTION_TYPES,
  createInitialData,
  normalizeOptions,
} from '../../client/src/schemaDoc/schemaUtils.js'

import templateCategories from '../../shared/templateCategories.json'

// 9 个内置预设（只读引用，与 app.jsx 完全一致，不修改 viewer）
import directorConfirmation from '../../server/data/presets/directorConfirmation.js'
import du004gUndertaking from '../../server/data/presets/du004gUndertaking.js'
import departmentSelfAssessment from '../../server/data/presets/departmentSelfAssessment.js'
import internalControlReport from '../../server/data/presets/internalControlReport.js'
import boardResolution from '../../server/data/presets/boardResolution.js'
import projectCharter from '../../server/data/presets/projectCharter.js'
import directorResignation from '../../server/data/presets/directorResignation.js'
import directorConsentToAct from '../../server/data/presets/directorConsentToAct.js'
import directorCodeComplianceConfirmation from '../../server/data/presets/directorCodeComplianceConfirmation.js'

/* =========================================================
 * 一、常量与注册表
 * ========================================================= */

/** 段落 / 签署变量留白约定：6 个全角下划线（与产品代码 _shared.js 的 BLANK_MD 一致）。 */
const BLANK_MD = '＿＿＿＿＿＿'

/** 12 个合法 category 值。 */
const CATEGORIES = Array.isArray(templateCategories.values) ? templateCategories.values : []

/** category key → 中文显示名。 */
const CATEGORY_LABELS = templateCategories.labels && typeof templateCategories.labels === 'object' ? templateCategories.labels : {}

/** 9 类字段的中文名。 */
const FIELD_LABELS = {
  text: '单行文本',
  textarea: '多行文本',
  date: '日期',
  select: '下拉选择',
  boolean: '布尔/勾选',
  list: '条目列表',
  clauses: '条款列表',
  checklist: '勾选清单',
  objectList: '对象列表',
}

/** 10 类区块的中文名。 */
const SECTION_LABELS = {
  heading: '标题',
  paragraph: '段落',
  infoTable: '信息表',
  checkList: '勾选清单',
  clauseList: '条款清单',
  objectTable: '对象表格',
  signBlock: '签署区块',
  note: '注释',
  divider: '分隔线',
  group: '分组(条件)',
}

/** 预设来源可选值。 */
const SOURCE_OPTIONS = [
  { value: 'manual', label: '手动填写' },
  { value: 'company', label: '取自公司信息' },
  { value: 'system', label: '系统生成' },
]

/* =========================================================
 * 二、通用工具
 * ========================================================= */

/** 简易唯一 id（React key 用）。 */
let _seq = 0
function uid(prefix) {
  _seq += 1
  return `${prefix}-${_seq}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 深拷贝纯数据（优先 structuredClone，回退 JSON）。
 * @template T
 * @param {T} value
 * @returns {T}
 */
function cloneData(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch (e) {
      /* fallthrough */
    }
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * 兼容 CJS/ESM 互操作：优先取 module.exports 本体，其次取 .default。
 * @param {object} mod 导入结果
 * @returns {object}
 */
function unwrap(mod) {
  if (mod && typeof mod === 'object' && !mod.presetKey && mod.default) return mod.default
  return mod || {}
}

/** 归一化预设：{ key, name, description, category, docSchema, sampleData }。 */
const PRESETS = [
  directorConfirmation,
  du004gUndertaking,
  departmentSelfAssessment,
  internalControlReport,
  boardResolution,
  projectCharter,
  directorResignation,
  directorConsentToAct,
  directorCodeComplianceConfirmation,
].map((raw) => {
  const preset = unwrap(raw)
  return {
    key: preset.presetKey || 'unknown-preset',
    name: preset.name || preset.presetKey || '未命名模板',
    description: preset.description || '',
    category: preset.category || 'compliance_filing',
    docSchema: preset.docSchema || {},
    sampleData: preset.sampleData || {},
  }
})

/* =========================================================
 * 三、解析器：{{var:x}} / {{blank}} 与字段/选项/列 文本互转
 * ========================================================= */

/**
 * 将含 {{var:字段key}} / {{blank}} 语法的文本解析为 segments[]。
 * 日期类型字段的变量会自动带上 format:'date'（与渲染器一致）。
 * @param {string} text 原文
 * @param {Array<object>} fields 字段列表（用于识别日期类型）
 * @returns {Array<object>}
 */
function parseSegments(text, fields) {
  const out = []
  if (typeof text !== 'string' || text === '') return out
  const fieldMap = {}
  ;(fields || []).forEach((f) => {
    if (f && f.key) fieldMap[f.key] = f
  })
  const re = /(\{\{var:([A-Za-z0-9_]+)\}\}|\{\{blank\}\})/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      const chunk = text.slice(last, m.index)
      if (chunk) out.push({ text: chunk })
    }
    if (m[2] !== undefined) {
      const key = m[2]
      const fld = fieldMap[key]
      out.push(fld && fld.type === 'date' ? { var: key, format: 'date', blank: BLANK_MD } : { var: key, blank: BLANK_MD })
    } else {
      out.push({ blank: true })
    }
    last = re.lastIndex
  }
  if (last < text.length) {
    const chunk = text.slice(last)
    if (chunk) out.push({ text: chunk })
  }
  return out
}

/**
 * 将 segments[] 反解为可编辑文本（用于「基于现有模板复制」回填）。
 * @param {Array<object>} segments
 * @returns {string}
 */
function segmentsToText(segments) {
  if (!Array.isArray(segments)) return ''
  return segments
    .map((s) => {
      if (s && s.var !== undefined && s.var !== '') return `{{var:${s.var}}}`
      if (s && s.blank !== undefined && s.blank !== null && s.blank !== false && s.var === undefined) return '{{blank}}'
      if (s && typeof s.text === 'string') return s.text
      return ''
    })
    .join('')
}

/**
 * 选项文本（每行 `值|显示名`）→ [{value,label}]。
 * @param {string} text
 * @returns {Array<{value:string,label:string}>}
 */
function parseOptions(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('|')
      if (idx >= 0) {
        const value = line.slice(0, idx).trim()
        const label = line.slice(idx + 1).trim()
        return { value, label: label || value }
      }
      return { value: line, label: line }
    })
}

/** [{value,label}] → 选项文本。 */
function optionsToText(options) {
  if (!Array.isArray(options)) return ''
  return options.map((o) => `${o.value}|${o.label}`).join('\n')
}

/**
 * 子字段 / 列 文本（每行 `key|显示名|类型`）→ [{key,label,type}]。
 * @param {string} text
 * @returns {Array<object>}
 */
function parseColumns(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((s) => s.trim())
      const key = parts[0]
      const label = parts[1] || parts[0]
      const type = parts[2] || 'value'
      const col = { key, label, type }
      if (type === 'index') {
        col.width = 6
        col.align = 'center'
      }
      return col
    })
}

/* =========================================================
 * 四、骨架工厂
 * ========================================================= */

/** 空白模板骨架。 */
function skeletonDoc() {
  return {
    presetKey: '',
    name: '',
    description: '',
    category: 'compliance_filing',
    schemaVersion: '1.0.0',
    meta: {
      docTitle: '',
      companyField: '',
      docSubtitle: '',
      archiveNote: '',
      headerMetaLeft: '',
      headerMetaRight: '',
    },
    fields: [],
    sections: [],
  }
}

/** 新建一个字段（默认 text 类型）。 */
function newField(type) {
  const t = FIELD_TYPES.includes(type) ? type : 'text'
  const f = {
    _id: uid('fld'),
    key: '',
    label: '',
    type: t,
    required: false,
    placeholder: '',
    source: 'manual',
  }
  if (t === 'select' || t === 'checklist') f.optionsText = ''
  if (t === 'checklist') {
    f.newItemText = ''
    f.addLabel = ''
    f.emptyHint = ''
  }
  if (t === 'objectList') f.subFieldsText = ''
  return f
}

/** 新建一个区块（默认 paragraph 类型）。 */
function newSection(type) {
  const t = SECTION_TYPES.includes(type) ? type : 'paragraph'
  const base = { _id: uid('sec'), type: t }
  switch (t) {
    case 'heading':
      return { ...base, text: '', autoNumber: false }
    case 'paragraph':
      return { ...base, text: '', flat: false, bold: false }
    case 'note':
      return { ...base, text: '' }
    case 'divider':
      return { ...base }
    case 'signBlock':
      return { ...base, items: [{ _id: uid('it'), label: '', kind: 'blank' }], note: '' }
    case 'infoTable':
      return { ...base, rows: [{ _id: uid('row'), label: '', value: '' }] }
    case 'checkList':
      return { ...base, field: '', variant: 'checked', quote: false }
    case 'clauseList':
      return { ...base, field: '', variant: 'checked', quote: false }
    case 'objectTable':
      return { ...base, field: '', columnsText: '', emptyText: '' }
    case 'group':
      return { ...base, visibleWhenText: '', children: [] }
    default:
      return base
  }
}

/* =========================================================
 * 五、schema ↔ 编辑器状态 互转
 * ========================================================= */

/**
 * 把字段 / 区块 / meta（编辑器态）编译为 Claw 认识的 docSchema。
 * @param {object} doc 编辑器态文档
 * @returns {object} docSchema
 */
function buildDocSchema(doc) {
  const fields = doc.fields || []

  const outFields = fields
    .map((f) => {
      if (!f || !f.key) return null
      const o = { key: f.key, label: f.label || f.key, type: f.type }
      if (f.required) o.required = true
      if (f.placeholder) o.placeholder = f.placeholder
      if (f.source && f.source !== 'manual') o.source = f.source
      if (f.type === 'select' || f.type === 'checklist') {
        const opts = parseOptions(f.optionsText)
        if (opts.length) o.options = opts
      }
      if (f.type === 'checklist') {
        if (f.newItemText) o.newItemText = f.newItemText
        if (f.addLabel) o.addLabel = f.addLabel
        if (f.emptyHint) o.emptyHint = f.emptyHint
      }
      if (f.type === 'objectList') {
        const defs = parseColumns(f.subFieldsText).map((c) => ({ key: c.key, label: c.label, type: c.type === 'value' ? 'text' : c.type }))
        if (defs.length) o.itemDefFields = defs
      }
      if (f.visibleWhenText && f.visibleWhenText.trim()) {
        try {
          const v = JSON.parse(f.visibleWhenText)
          if (v && typeof v === 'object') o.visibleWhen = v
        } catch (e) {
          /* 忽略非法 JSON */
        }
      }
      return o
    })
    .filter(Boolean)

  const meta = { docTitle: (doc.meta && doc.meta.docTitle) || '' }
  if (doc.meta && doc.meta.companyField) meta.companyField = doc.meta.companyField
  if (doc.meta && doc.meta.docSubtitle) meta.docSubtitle = doc.meta.docSubtitle
  if (doc.meta && doc.meta.archiveNote) meta.archiveNote = doc.meta.archiveNote
  const hLeft = parseSegments((doc.meta && doc.meta.headerMetaLeft) || '', fields)
  const hRight = parseSegments((doc.meta && doc.meta.headerMetaRight) || '', fields)
  if (hLeft.length || hRight.length) meta.headerMeta = { left: hLeft, right: hRight }

  const outSections = (doc.sections || []).map((s) => buildSection(s, fields)).filter(Boolean)

  return {
    schemaVersion: doc.schemaVersion || '1.0.0',
    layoutMode: 'custom',
    meta,
    fields: outFields,
    rules: [],
    layout: { sections: outSections },
  }
}

/** 单个区块 → schema 区块。 */
function buildSection(sec, fields) {
  if (!sec) return null
  switch (sec.type) {
    case 'heading':
      return { type: 'heading', text: sec.text || '', autoNumber: !!sec.autoNumber }
    case 'paragraph':
      return { type: 'paragraph', segments: parseSegments(sec.text || '', fields), flat: !!sec.flat, bold: !!sec.bold }
    case 'note':
      return { type: 'note', text: sec.text || '' }
    case 'divider':
      return { type: 'divider' }
    case 'signBlock': {
      const items = (sec.items || []).map((it) => {
        let value = []
        if (it.kind === 'var') {
          const fld = (fields || []).find((f) => f.key === it.varKey)
          value = fld && fld.type === 'date' ? [{ var: it.varKey, format: 'date', blank: BLANK_MD }] : [{ var: it.varKey, blank: BLANK_MD }]
        } else if (it.kind === 'blank') {
          value = [{ blank: true }]
        } else {
          value = [{ text: it.text || '' }]
        }
        return { label: it.label || '', value }
      })
      const obj = { type: 'signBlock', items }
      if (sec.note) obj.note = sec.note
      return obj
    }
    case 'infoTable': {
      const rows = (sec.rows || []).map((r) => ({ label: r.label || '', value: parseSegments(r.value || '', fields) }))
      return { type: 'infoTable', rows }
    }
    case 'checkList':
      return { type: 'checkList', field: sec.field || '', variant: sec.variant || 'checked', quote: !!sec.quote }
    case 'clauseList':
      return { type: 'clauseList', field: sec.field || '', variant: sec.variant || 'checked', quote: !!sec.quote }
    case 'objectTable': {
      const obj = { type: 'objectTable', field: sec.field || '', columns: parseColumns(sec.columnsText || '') }
      if (sec.emptyText) obj.emptyText = sec.emptyText
      return obj
    }
    case 'group': {
      const obj = { type: 'group', children: (sec.children || []).map((c) => buildSection(c, fields)).filter(Boolean) }
      if (sec.visibleWhenText && sec.visibleWhenText.trim()) {
        try {
          const v = JSON.parse(sec.visibleWhenText)
          if (v && typeof v === 'object') obj.visibleWhen = v
        } catch (e) {
          /* 忽略 */
        }
      }
      return obj
    }
    default:
      return null
  }
}

/** 编辑器态 → 完整预设对象（导出用）。 */
function buildPreset(doc) {
  return {
    presetKey: doc.presetKey,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    engine: 'schema',
    schemaVersion: doc.schemaVersion || '1.0.0',
    docSchema: buildDocSchema(doc),
  }
}

/**
 * 生成有意义的示例数据（空白初值之上叠加），让右侧预览更像正式文书。
 * 绝不在出错时抛异常。
 * @param {object} docSchema
 * @returns {object}
 */
function buildSampleData(docSchema) {
  let data = {}
  try {
    data = createInitialData(docSchema)
  } catch (e) {
    data = {}
  }
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  fields.forEach((f) => {
    if (!f || f.key == null) return
    try {
      switch (f.type) {
        case 'date':
          data[f.key] = '2024-12-31'
          break
        case 'boolean':
          data[f.key] = true
          break
        case 'select': {
          const o = normalizeOptions(f.options || [])
          data[f.key] = o.length ? o[0].value : '示例'
          break
        }
        case 'list':
          data[f.key] = ['示例条目一', '示例条目二']
          break
        case 'clauses':
          data[f.key] = ['第一条条款示例', '第二条条款示例']
          break
        case 'checklist': {
          const o = normalizeOptions(f.options || [])
          const src = o.length ? o : [{ value: '示例项', label: '示例项' }]
          data[f.key] = src.map((x, i) => ({ text: x.label, checked: i === 0 }))
          break
        }
        case 'objectList': {
          const defs = f.itemDefFields || f.columns || []
          if (defs.length) {
            const row = {}
            defs.forEach((d) => {
              row[d.key] = d.type === 'boolean' ? true : `示例${d.label || d.key}`
            })
            data[f.key] = [row]
          } else {
            data[f.key] = []
          }
          break
        }
        default:
          data[f.key] = `示例${f.label || f.key}`
      }
    } catch (e) {
      /* 保留默认值 */
    }
  })
  return data
}

/* =========================================================
 * 六、校验（轻量）
 * ========================================================= */

/**
 * 递归收集区块里出现的所有 {{var:KEY}} 引用。
 * @param {object} sec
 * @returns {string[]}
 */
function collectVarRefs(sec) {
  const refs = []
  const re = /\{\{var:([A-Za-z0-9_]+)\}\}/g
  const scan = (txt) => {
    if (typeof txt === 'string') {
      let m
      while ((m = re.exec(txt)) !== null) refs.push(m[1])
    }
  }
  if (!sec) return refs
  if (sec.type === 'paragraph' || sec.type === 'note') scan(sec.text)
  if (sec.type === 'infoTable') (sec.rows || []).forEach((r) => scan(r.value))
  if (sec.type === 'signBlock') (sec.items || []).forEach((it) => {
    if (it.kind === 'var') refs.push(it.varKey)
    scan(it.text)
  })
  if (sec.type === 'group') (sec.children || []).forEach((c) => refs.push(...collectVarRefs(c)))
  return refs
}

/**
 * 轻量校验，返回中文警告数组（空数组表示通过）。
 * @param {object} doc 编辑器态
 * @param {object} built 已编译 docSchema（用于扫描伪留白）
 * @returns {string[]}
 */
function validateDoc(doc, built) {
  const warnings = []
  const key = (doc.presetKey || '').trim()
  if (!key) warnings.push('presetKey 不能为空。')
  else if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(key)) warnings.push('presetKey 必须是 kebab-case，例如 director-code-confirmation。')

  const fieldKeys = (doc.fields || []).filter((f) => f && f.key).map((f) => f.key)
  if (new Set(fieldKeys).size !== fieldKeys.length) warnings.push('字段 key 存在重复，请修正。')

  if (!CATEGORIES.includes(doc.category)) warnings.push('category 不在 12 个合法值内。')
  if (!doc.meta || !doc.meta.docTitle) warnings.push('建议填写「文档标题」（meta.docTitle），否则成文物无标题。')

  const keySet = new Set(fieldKeys)

  // 伪留白扫描：签署区块里出现 {text:'', blank:...} 即报红
  ;(built.layout.sections || []).forEach((sec, i) => {
    if (sec && sec.type === 'signBlock') {
      ;(sec.items || []).forEach((it, j) => {
        ;(it.value || []).forEach((seg) => {
          if (seg && typeof seg.text === 'string' && seg.text === '' && seg.blank) {
            warnings.push(`签署区块 #${i + 1} 第 ${j + 1} 项使用了伪留白 {text:'', blank}；必须用 {blank:true}。`)
          }
        })
      })
    }
  })

  ;(doc.sections || []).forEach((sec, i) => {
    if (!SECTION_TYPES.includes(sec.type)) {
      warnings.push(`区块 #${i + 1} 类型非法：${sec.type}`)
      return
    }
    collectVarRefs(sec).forEach((r) => {
      if (!keySet.has(r)) warnings.push(`区块 #${i + 1} 引用了不存在的字段「${r}」。`)
    })
    if ((sec.type === 'checkList' || sec.type === 'clauseList' || sec.type === 'objectTable') && sec.field && !keySet.has(sec.field)) {
      warnings.push(`区块 #${i + 1}（${sec.type}）绑定的字段「${sec.field}」不存在。`)
    }
  })

  const hRe = /\{\{var:([A-Za-z0-9_]+)\}\}/g
  const scanH = (txt) => {
    if (typeof txt === 'string') {
      let m
      while ((m = hRe.exec(txt)) !== null) {
        if (!keySet.has(m[1])) warnings.push(`页眉引用了不存在的字段「${m[1]}」。`)
      }
    }
  }
  scanH(doc.meta && doc.meta.headerMetaLeft)
  scanH(doc.meta && doc.meta.headerMetaRight)

  return warnings
}

/* =========================================================
 * 七、schema → 编辑器态（用于「基于现有模板复制」回填）
 * ========================================================= */

/** schema 字段 → 编辑器态字段。 */
function fieldFromSchema(f) {
  const out = {
    _id: uid('fld'),
    key: f.key || '',
    label: f.label || f.key || '',
    type: FIELD_TYPES.includes(f.type) ? f.type : 'text',
    required: !!f.required,
    placeholder: f.placeholder || '',
    source: f.source || 'manual',
  }
  if (out.type === 'select' || out.type === 'checklist') out.optionsText = optionsToText(f.options || [])
  if (out.type === 'checklist') {
    out.newItemText = f.newItemText || ''
    out.addLabel = f.addLabel || ''
    out.emptyHint = f.emptyHint || ''
  }
  if (out.type === 'objectList') {
    out.subFieldsText = (f.itemDefFields || [])
      .map((c) => `${c.key}|${c.label || c.key}|${c.type || 'text'}`)
      .join('\n')
  }
  if (f.visibleWhen) out.visibleWhenText = JSON.stringify(f.visibleWhen)
  return out
}

/** schema 区块 → 编辑器态区块。 */
function sectionFromSchema(sec) {
  if (!sec) return newSection('paragraph')
  const base = { _id: uid('sec'), type: sec.type }
  switch (sec.type) {
    case 'heading':
      return { ...base, text: sec.text || '', autoNumber: !!sec.autoNumber }
    case 'paragraph':
      return { ...base, text: segmentsToText(sec.segments), flat: !!sec.flat, bold: !!sec.bold }
    case 'note':
      return { ...base, text: sec.text || '' }
    case 'divider':
      return { ...base }
    case 'signBlock':
      return { ...base, items: (sec.items || []).map(signItemFromSchema), note: sec.note || '' }
    case 'infoTable':
      return { ...base, rows: (sec.rows || []).map((r) => ({ _id: uid('row'), label: r.label || '', value: segmentsToText(r.value) })) }
    case 'checkList':
      return { ...base, field: sec.field || '', variant: sec.variant || 'checked', quote: !!sec.quote }
    case 'clauseList':
      return { ...base, field: sec.field || '', variant: sec.variant || 'checked', quote: !!sec.quote }
    case 'objectTable':
      return {
        ...base,
        field: sec.field || '',
        columnsText: (sec.columns || []).map((c) => `${c.key}|${c.label || c.key}|${c.type || 'value'}`).join('\n'),
        emptyText: sec.emptyText || '',
      }
    case 'group':
      return { ...base, visibleWhenText: sec.visibleWhen ? JSON.stringify(sec.visibleWhen) : '', children: (sec.children || []).map(sectionFromSchema) }
    default:
      return base
  }
}

/** schema 签署项（value segments）→ 编辑器态签署项。 */
function signItemFromSchema(it) {
  const segs = Array.isArray(it.value) ? it.value : []
  const blankSeg = segs.find((s) => s && s.blank && s.var === undefined)
  if (blankSeg && !('text' in blankSeg)) {
    return { _id: uid('it'), label: it.label || '', kind: 'blank' }
  }
  const varSeg = segs.find((s) => s && s.var !== undefined && s.var !== '')
  if (varSeg) {
    return { _id: uid('it'), label: it.label || '', kind: 'var', varKey: varSeg.var }
  }
  const textSeg = segs.find((s) => s && typeof s.text === 'string' && !s.blank)
  return { _id: uid('it'), label: it.label || '', kind: 'text', text: textSeg ? textSeg.text : '' }
}

/* =========================================================
 * 八、不可变更新助手（含递归 group 子区块）
 * ========================================================= */

/** 在区块树（含 group.children）中按 _id 打补丁。 */
function updateSectionById(sections, id, patch) {
  return sections.map((s) => {
    if (s._id === id) return { ...s, ...patch }
    if (s.type === 'group' && Array.isArray(s.children)) {
      return { ...s, children: updateSectionById(s.children, id, patch) }
    }
    return s
  })
}

/** 在区块树中按 _id 删除。 */
function removeSectionById(sections, id) {
  const out = []
  sections.forEach((s) => {
    if (s._id === id) return
    if (s.type === 'group' && Array.isArray(s.children)) {
      out.push({ ...s, children: removeSectionById(s.children, id) })
    } else {
      out.push(s)
    }
  })
  return out
}

/** 在数组中按 _id 上移/下移（dir: -1 上, +1 下）。 */
function moveInArray(arr, id, dir) {
  const idx = arr.findIndex((x) => x._id === id)
  if (idx < 0) return arr
  const to = idx + (dir > 0 ? 1 : -1)
  if (to < 0 || to >= arr.length) return arr
  const copy = arr.slice()
  const [item] = copy.splice(idx, 1)
  copy.splice(to, 0, item)
  return copy
}

/* =========================================================
 * 九、小组件
 * ========================================================= */

/**
 * 插入变量下拉（向文本追加 {{var:KEY}}）。
 * @param {{fields:Array, onInsert:Function}} props
 */
function InsertVar({ fields, onInsert }) {
  const [key, setKey] = useState('')
  return (
    <div className="ins-var">
      <select className="ctl ctl-sm" value={key} onChange={(e) => setKey(e.target.value)}>
        <option value="">插入变量…</option>
        {(fields || []).filter((f) => f && f.key).map((f) => (
          <option key={f._id} value={f.key}>
            {f.label || f.key}（{f.key}）
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-mini"
        disabled={!key}
        onClick={() => {
          if (key) {
            onInsert(key)
            setKey('')
          }
        }}
      >
        插入
      </button>
    </div>
  )
}

/* =========================================================
 * 十、字段编辑器
 * ========================================================= */

/**
 * 单个字段编辑行（9 类）。
 * @param {{field:object, onChange:Function, onDelete:Function, onMove:Function, fields:Array}} props
 */
function FieldRow({ field, onChange, onDelete, onMove }) {
  const patch = (p) => onChange(p)
  return (
    <div className="fld-card">
      <div className="fld-card-head">
        <span className="fld-type">{FIELD_LABELS[field.type] || field.type}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-mini" onClick={() => onMove(-1)} title="上移">
          ↑
        </button>
        <button type="button" className="btn btn-mini" onClick={() => onMove(1)} title="下移">
          ↓
        </button>
        <button type="button" className="btn btn-mini btn-danger" onClick={onDelete}>
          删除
        </button>
      </div>

      <label className="lbl">字段 key（变量名，如 companyName）</label>
      <input className="ctl" value={field.key} placeholder="companyName" onChange={(e) => patch({ key: e.target.value })} />

      <label className="lbl">显示标签</label>
      <input className="ctl" value={field.label} placeholder="公司名称" onChange={(e) => patch({ label: e.target.value })} />

      <div className="two">
        <div>
          <label className="lbl">必填</label>
          <label className="bool">
            <input type="checkbox" className="chk-box" checked={field.required} onChange={(e) => patch({ required: e.target.checked })} />
            <span>是</span>
          </label>
        </div>
        <div>
          <label className="lbl">来源</label>
          <select className="ctl" value={field.source} onChange={(e) => patch({ source: e.target.value })}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {field.type !== 'boolean' && field.type !== 'objectList' ? (
        <>
          <label className="lbl">占位提示 placeholder</label>
          <input className="ctl" value={field.placeholder || ''} onChange={(e) => patch({ placeholder: e.target.value })} />
        </>
      ) : null}

      {field.type === 'select' || field.type === 'checklist' ? (
        <>
          <label className="lbl">选项（每行一个，格式：值|显示名）</label>
          <textarea className="ctl" rows={3} value={field.optionsText || ''} placeholder={'男|男\n女|女'} onChange={(e) => patch({ optionsText: e.target.value })} />
        </>
      ) : null}

      {field.type === 'checklist' ? (
        <div className="two">
          <div>
            <label className="lbl">新增文案</label>
            <input className="ctl" value={field.newItemText || ''} onChange={(e) => patch({ newItemText: e.target.value })} />
          </div>
          <div>
            <label className="lbl">添加按钮</label>
            <input className="ctl" value={field.addLabel || ''} onChange={(e) => patch({ addLabel: e.target.value })} />
          </div>
        </div>
      ) : null}

      {field.type === 'objectList' ? (
        <>
          <label className="lbl">子字段（每行：key|显示名|类型）</label>
          <textarea
            className="ctl"
            rows={3}
            value={field.subFieldsText || ''}
            placeholder={'role|职务|text\nname|姓名|text'}
            onChange={(e) => patch({ subFieldsText: e.target.value })}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * 字段列表编辑器。
 * @param {{fields:Array, onChange:Function}} props
 */
function FieldsEditor({ fields, onChange }) {
  const add = (type) => onChange([...fields, newField(type)])
  const update = (f, p) => onChange(fields.map((x) => (x._id === f._id ? { ...x, ...p } : x)))
  const remove = (f) => onChange(fields.filter((x) => x._id !== f._id))
  const move = (f, dir) => onChange(moveInArray(fields, f._id, dir))
  return (
    <div className="bld-block">
      <div className="bld-block-head">
        <h3>字段（{fields.length}）</h3>
        <select className="ctl ctl-sm" value="" onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">+ 新增字段</option>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {FIELD_LABELS[t] || t}
            </option>
          ))}
        </select>
      </div>
      {fields.length === 0 ? <p className="fld-empty">还没有字段。先在「元信息」里填标题，再点「+ 新增字段」。</p> : null}
      {fields.map((f) => (
        <FieldRow key={f._id} field={f} onChange={(p) => update(f, p)} onDelete={() => remove(f)} onMove={(d) => move(f, d)} />
      ))}
    </div>
  )
}

/* =========================================================
 * 十一、区块编辑器（10 类，含递归 group）
 * ========================================================= */

/**
 * 单个区块编辑行。
 * @param {{section:object, onChange:Function, onDelete:Function, onMove:Function, fields:Array, nested:boolean}} props
 */
function SectionRow({ section, onChange, onDelete, onMove, fields, nested }) {
  const patch = (p) => onChange(p)
  if (section.type === 'divider') {
    return (
      <div className="sec-card">
        <SecHead section={section} onDelete={onDelete} onMove={onMove} nested={nested} />
        <p className="fld-empty">分隔线：仅一条水平线，无参数。</p>
      </div>
    )
  }
  return (
    <div className="sec-card">
      <SecHead section={section} onDelete={onDelete} onMove={onMove} nested={nested} />

      {section.type === 'heading' ? (
        <>
          <label className="lbl">标题文字</label>
          <input className="ctl" value={section.text || ''} onChange={(e) => patch({ text: e.target.value })} />
          <label className="bool">
            <input type="checkbox" className="chk-box" checked={!!section.autoNumber} onChange={(e) => patch({ autoNumber: e.target.checked })} />
            <span>自动加中文序号（一、二、…）</span>
          </label>
        </>
      ) : null}

      {section.type === 'paragraph' ? (
        <>
          <label className="lbl">正文（支持 {'{{var:字段key}}'} 与 {'{{blank}}'}）</label>
          <textarea className="ctl" rows={3} value={section.text || ''} placeholder={'致：{{var:companyName}}\n本函确认{{blank}}。'} onChange={(e) => patch({ text: e.target.value })} />
          <InsertVar fields={fields} onInsert={(k) => patch({ text: (section.text || '') + `{{var:${k}}}` })} />
          <div className="two">
            <label className="bool">
              <input type="checkbox" className="chk-box" checked={!!section.flat} onChange={(e) => patch({ flat: e.target.checked })} />
              <span>不缩进（flat）</span>
            </label>
            <label className="bool">
              <input type="checkbox" className="chk-box" checked={!!section.bold} onChange={(e) => patch({ bold: e.target.checked })} />
              <span>加粗</span>
            </label>
          </div>
        </>
      ) : null}

      {section.type === 'note' ? (
        <>
          <label className="lbl">注释文字</label>
          <textarea className="ctl" rows={2} value={section.text || ''} onChange={(e) => patch({ text: e.target.value })} />
        </>
      ) : null}

      {section.type === 'infoTable' ? (
        <InfoTableEditor section={section} fields={fields} onChange={onChange} />
      ) : null}

      {section.type === 'signBlock' ? (
        <SignBlockEditor section={section} fields={fields} onChange={onChange} />
      ) : null}

      {section.type === 'checkList' || section.type === 'clauseList' ? (
        <>
          <label className="lbl">绑定字段（{section.type === 'checkList' ? '勾选清单' : '条款列表'} 类型）</label>
          <select className="ctl" value={section.field || ''} onChange={(e) => patch({ field: e.target.value })}>
            <option value="">（请选择字段）</option>
            {fields
              .filter((f) => f && f.key && (section.type === 'checkList' ? f.type === 'checklist' : f.type === 'list' || f.type === 'clauses'))
              .map((f) => (
                <option key={f._id} value={f.key}>
                  {f.label || f.key}
                </option>
              ))}
          </select>
          <div className="two">
            <div>
              <label className="lbl">样式 variant</label>
              <select className="ctl" value={section.variant || 'checked'} onChange={(e) => patch({ variant: e.target.value })}>
                <option value="checked">checked（☑ 勾选）</option>
                <option value="ordered">ordered（数字序号）</option>
                <option value="plain">plain（纯文本）</option>
              </select>
            </div>
            <label className="bool">
              <input type="checkbox" className="chk-box" checked={!!section.quote} onChange={(e) => patch({ quote: e.target.checked })} />
              <span>引用块样式</span>
            </label>
          </div>
        </>
      ) : null}

      {section.type === 'objectTable' ? (
        <>
          <label className="lbl">绑定字段（objectList 类型）</label>
          <select className="ctl" value={section.field || ''} onChange={(e) => patch({ field: e.target.value })}>
            <option value="">（请选择字段）</option>
            {fields.filter((f) => f && f.key && f.type === 'objectList').map((f) => (
              <option key={f._id} value={f.key}>
                {f.label || f.key}
              </option>
            ))}
          </select>
          <label className="lbl">列定义（每行：key|显示名|类型；用 index 表示序号列）</label>
          <textarea
            className="ctl"
            rows={3}
            value={section.columnsText || ''}
            placeholder={'index|序号|index\nrole|职务|text'}
            onChange={(e) => patch({ columnsText: e.target.value })}
          />
          <label className="lbl">空表提示 emptyText</label>
          <input className="ctl" value={section.emptyText || ''} onChange={(e) => patch({ emptyText: e.target.value })} />
        </>
      ) : null}

      {section.type === 'group' ? (
        <div className="grp">
          <label className="lbl">显示条件 visibleWhen（JSON DSL，留空=始终显示）</label>
          <textarea className="ctl" rows={2} value={section.visibleWhenText || ''} placeholder={'{"field":"showDetail","op":"truthy"}'} onChange={(e) => patch({ visibleWhenText: e.target.value })} />
          <p className="fld-hint">分组本身不渲染容器，仅按条件展开其子区块。</p>
          <SectionsEditor sections={section.children || []} setSections={(children) => patch({ children })} fields={fields} nested />
        </div>
      ) : null}
    </div>
  )
}

/** 区块卡片头部：类型 + 上移/下移/删除。 */
function SecHead({ section, onDelete, onMove, nested }) {
  return (
    <div className="sec-card-head">
      <span className="sec-type">{SECTION_LABELS[section.type] || section.type}</span>
      <span className="spacer" />
      <button type="button" className="btn btn-mini" onClick={() => onMove(-1)} title="上移">
        ↑
      </button>
      <button type="button" className="btn btn-mini" onClick={() => onMove(1)} title="下移">
        ↓
      </button>
      <button type="button" className="btn btn-mini btn-danger" onClick={onDelete}>
        删除
      </button>
    </div>
  )
}

/** infoTable 区块编辑器。 */
function InfoTableEditor({ section, fields, onChange }) {
  const patch = (p) => onChange(p)
  const addRow = () => patch({ rows: [...(section.rows || []), { _id: uid('row'), label: '', value: '' }] })
  const updateRow = (row, p) => patch({ rows: (section.rows || []).map((r) => (r._id === row._id ? { ...r, ...p } : r)) })
  const removeRow = (row) => patch({ rows: (section.rows || []).filter((r) => r._id !== row._id) })
  return (
    <>
      <label className="lbl">信息表行（label + value，value 支持 {'{{var:x}}'}/{'{{blank}}'}）</label>
      {(section.rows || []).map((row) => (
        <div className="row-edit" key={row._id}>
          <input className="ctl ctl-sm" value={row.label || ''} placeholder="标签" onChange={(e) => updateRow(row, { label: e.target.value })} />
          <textarea className="ctl ctl-sm" rows={1} value={row.value || ''} placeholder={'{{var:companyName}}'} onChange={(e) => updateRow(row, { value: e.target.value })} />
          <InsertVar fields={fields} onInsert={(k) => updateRow(row, { value: (row.value || '') + `{{var:${k}}}` })} />
          <button type="button" className="btn btn-mini btn-danger" onClick={() => removeRow(row)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-mini" onClick={addRow}>
        + 行
      </button>
    </>
  )
}

/** signBlock 区块编辑器。 */
function SignBlockEditor({ section, fields, onChange }) {
  const patch = (p) => onChange(p)
  const addItem = () => patch({ items: [...(section.items || []), { _id: uid('it'), label: '', kind: 'blank' }] })
  const updateItem = (it, p) => patch({ items: (section.items || []).map((x) => (x._id === it._id ? { ...x, ...p } : x)) })
  const removeItem = (it) => patch({ items: (section.items || []).filter((x) => x._id !== it._id) })
  return (
    <>
      <label className="lbl">签署项（每项：标签 + 值来源）</label>
      {(section.items || []).map((it) => (
        <div className="sign-edit" key={it._id}>
          <input className="ctl ctl-sm" value={it.label || ''} placeholder="董事（签署）" onChange={(e) => updateItem(it, { label: e.target.value })} />
          <select className="ctl ctl-sm" value={it.kind || 'blank'} onChange={(e) => updateItem(it, { kind: e.target.value })}>
            <option value="blank">留白（手写）</option>
            <option value="var">变量</option>
            <option value="text">固定文字</option>
          </select>
          {it.kind === 'var' ? (
            <select className="ctl ctl-sm" value={it.varKey || ''} onChange={(e) => updateItem(it, { varKey: e.target.value })}>
              <option value="">（字段）</option>
              {fields.filter((f) => f && f.key).map((f) => (
                <option key={f._id} value={f.key}>
                  {f.label || f.key}
                </option>
              ))}
            </select>
          ) : null}
          {it.kind === 'text' ? (
            <input className="ctl ctl-sm" value={it.text || ''} placeholder="固定文字" onChange={(e) => updateItem(it, { text: e.target.value })} />
          ) : null}
          <button type="button" className="btn btn-mini btn-danger" onClick={() => removeItem(it)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-mini" onClick={addItem}>
        + 签署项
      </button>
      <label className="lbl">存档说明 note（可选）</label>
      <input className="ctl" value={section.note || ''} onChange={(e) => patch({ note: e.target.value })} />
    </>
  )
}

/**
 * 区块列表编辑器（支持嵌套 group.children）。
 * @param {{sections:Array, setSections:Function, fields:Array, nested?:boolean}} props
 */
function SectionsEditor({ sections, setSections, fields, nested }) {
  const add = (type) => setSections([...sections, newSection(type)])
  const update = (id, p) => setSections(updateSectionById(sections, id, p))
  const remove = (id) => setSections(removeSectionById(sections, id))
  const move = (id, dir) => setSections(moveInArray(sections, id, dir))
  return (
    <div className={nested ? 'bld-secs bld-secs-nested' : 'bld-secs'}>
      {sections.map((sec) => (
        <SectionRow
          key={sec._id}
          section={sec}
          fields={fields}
          nested={!!nested}
          onChange={(p) => update(sec._id, p)}
          onDelete={() => remove(sec._id)}
          onMove={(d) => move(sec._id, d)}
        />
      ))}
      <div className="add-sec">
        <span className="lbl">+ 新增区块</span>
        <select className="ctl ctl-sm" value="" onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">选择类型…</option>
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SECTION_LABELS[t] || t}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* =========================================================
 * 十二、元信息表单
 * ========================================================= */

/**
 * 元信息表单（presetKey / name / description / category / schemaVersion / meta）。
 * @param {{doc:object, onChange:Function, fields:Array}} props
 */
function MetaForm({ doc, onChange, fields }) {
  const patch = (p) => onChange(p)
  const patchMeta = (p) => onChange({ meta: { ...doc.meta, ...p } })
  return (
    <div className="bld-block">
      <div className="bld-block-head">
        <h3>元信息</h3>
      </div>
      <label className="lbl">presetKey（必填，kebab-case）</label>
      <input className="ctl" value={doc.presetKey} placeholder="my-compliance-letter" onChange={(e) => patch({ presetKey: e.target.value })} />

      <label className="lbl">名称 name</label>
      <input className="ctl" value={doc.name} placeholder="董事遵守标准守则之确认函" onChange={(e) => patch({ name: e.target.value })} />

      <label className="lbl">描述 description</label>
      <textarea className="ctl" rows={2} value={doc.description} onChange={(e) => patch({ description: e.target.value })} />

      <div className="two">
        <div>
          <label className="lbl">category</label>
          <select className="ctl" value={doc.category} onChange={(e) => patch({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">schemaVersion</label>
          <input className="ctl" value={doc.schemaVersion} onChange={(e) => patch({ schemaVersion: e.target.value })} />
        </div>
      </div>

      <h4 className="sub">文档抬头 meta</h4>
      <label className="lbl">文档标题 docTitle</label>
      <input className="ctl" value={doc.meta.docTitle} placeholder="董事遵守标准守则之年度确认函" onChange={(e) => patchMeta({ docTitle: e.target.value })} />

      <label className="lbl">公司名来源字段 companyField（可选）</label>
      <select className="ctl" value={doc.meta.companyField} onChange={(e) => patchMeta({ companyField: e.target.value })}>
        <option value="">（不使用公司名抬头）</option>
        {fields.filter((f) => f && f.key).map((f) => (
          <option key={f._id} value={f.key}>
            {f.label || f.key}
          </option>
        ))}
      </select>

      <label className="lbl">副标题 docSubtitle（可选）</label>
      <input className="ctl" value={doc.meta.docSubtitle} onChange={(e) => patchMeta({ docSubtitle: e.target.value })} />

      <label className="lbl">页眉左（支持 {'{{var:x}}'}/{'{{blank}}'}）</label>
      <textarea className="ctl" rows={1} value={doc.meta.headerMetaLeft} onChange={(e) => patchMeta({ headerMetaLeft: e.target.value })} />

      <label className="lbl">页眉右</label>
      <textarea className="ctl" rows={1} value={doc.meta.headerMetaRight} onChange={(e) => patchMeta({ headerMetaRight: e.target.value })} />

      <label className="lbl">存档说明 archiveNote（可选）</label>
      <textarea className="ctl" rows={2} value={doc.meta.archiveNote} onChange={(e) => patchMeta({ archiveNote: e.target.value })} />
    </div>
  )
}

/* =========================================================
 * 十三、主组件
 * ========================================================= */

/**
 * Builder 主应用：三栏（字段 / 区块 / 实时预览）。
 * @returns {JSX.Element}
 */
function BuilderApp() {
  const [doc, setDoc] = useState(() => skeletonDoc())
  const [previewMode, setPreviewMode] = useState('sample')
  const [toast, setToast] = useState('')
  const [copyKey, setCopyKey] = useState('')
  const previewRef = useRef(null)

  const docSchema = useMemo(() => buildDocSchema(doc), [doc])
  const previewData = useMemo(
    () => (previewMode === 'sample' ? buildSampleData(docSchema) : createInitialData(docSchema)),
    [docSchema, previewMode],
  )
  const warnings = useMemo(() => validateDoc(doc, docSchema), [doc, docSchema])

  const hideToast = () => setTimeout(() => setToast(''), 2200)

  /** 局部更新 doc。 */
  const updateDoc = (p) => setDoc((prev) => ({ ...prev, ...p }))
  const updateMeta = (p) => setDoc((prev) => ({ ...prev, meta: { ...prev.meta, ...p } }))

  /** 导出 JSON 文件。 */
  const exportJson = () => {
    const preset = buildPreset(doc)
    const name = (doc.presetKey || 'template').trim() || 'template'
    const json = JSON.stringify(preset, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setToast(`已导出 ${name}.json`)
    hideToast()
  }

  /** 复制为 CommonJS 模块到剪贴板。 */
  const copyCjs = async () => {
    const preset = buildPreset(doc)
    const text = `module.exports = ${JSON.stringify(preset, null, 2)}`
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        throw new Error('no clipboard')
      }
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch (err) {
        /* ignore */
      }
      ta.remove()
    }
    setToast('已复制 CommonJS 模块到剪贴板')
    hideToast()
  }

  /** 清空为骨架。 */
  const clearAll = () => {
    if (window.confirm('确定清空当前模板，恢复到空白骨架？')) {
      setDoc(skeletonDoc())
      setToast('已清空')
      hideToast()
    }
  }

  /** 基于现有模板复制。 */
  const onCopySelect = (e) => {
    const key = e.target.value
    setCopyKey('')
    if (!key) return
    const p = PRESETS.find((x) => x.key === key)
    if (!p) return
    const src = cloneData(p.docSchema)
    const d = skeletonDoc()
    d.name = p.name || ''
    d.description = p.description || ''
    d.category = p.category || 'compliance_filing'
    d.meta = {
      docTitle: (src.meta && src.meta.docTitle) || '',
      companyField: (src.meta && src.meta.companyField) || '',
      docSubtitle: (src.meta && src.meta.docSubtitle) || '',
      archiveNote: (src.meta && src.meta.archiveNote) || '',
      headerMetaLeft: segmentsToText(src.meta && src.meta.headerMeta && src.meta.headerMeta.left),
      headerMetaRight: segmentsToText(src.meta && src.meta.headerMeta && src.meta.headerMeta.right),
    }
    d.fields = (src.fields || []).map(fieldFromSchema)
    d.sections = (src.layout && src.layout.sections ? src.layout.sections : []).map(sectionFromSchema)
    setDoc(d)
    setToast(`已载入模板：${p.name}`)
    hideToast()
  }

  return (
    <div className="bx-app">
      <header className="bx-header no-print">
        <div className="ix-brand">
          <strong>合规模板 Builder</strong>
          <span className="ix-sub">组合字段 + 区块 → 导出合规模板（纯前端，无需后端）</span>
        </div>
        <div className="ix-actions">
          <select className="ctl ctl-inline" value={copyKey} onChange={onCopySelect}>
            <option value="">基于现有模板复制…</option>
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={exportJson}>
            导出 JSON
          </button>
          <button type="button" className="btn" onClick={copyCjs}>
            复制为 CommonJS 模块
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearAll}>
            清空
          </button>
        </div>
      </header>

      <main className="bx-body">
        <aside className="bx-left no-print">
          <MetaForm doc={doc} onChange={updateDoc} fields={doc.fields} />
          <FieldsEditor fields={doc.fields} onChange={(fields) => updateDoc({ fields })} />
        </aside>

        <section className="bx-mid no-print">
          <div className="bld-block">
            <div className="bld-block-head">
              <h3>区块（{doc.sections.length}）</h3>
            </div>
            <SectionsEditor sections={doc.sections} setSections={(sections) => updateDoc({ sections })} fields={doc.fields} />
          </div>
        </section>

        <section className="bx-preview" ref={previewRef}>
          <div className="pv-head no-print">
            <div className="pv-toggle">
              <button type={`button`} className={previewMode === 'sample' ? 'btn btn-mini tab-on' : 'btn btn-mini'} onClick={() => setPreviewMode('sample')}>
                示例数据
              </button>
              <button type={`button`} className={previewMode === 'blank' ? 'btn btn-mini tab-on' : 'btn btn-mini'} onClick={() => setPreviewMode('blank')}>
                空白表单
              </button>
            </div>
            <span className="pv-count">{warnings.length > 0 ? `${warnings.length} 条提示` : '校验通过'}</span>
          </div>

          {warnings.length > 0 ? (
            <div className="bld-warn no-print">
              <p className="bld-warn-title">轻量校验提示（{warnings.length}）</p>
              <ul>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <SchemaDocRenderer docSchema={docSchema} data={previewData} mode="preview" />
        </section>
      </main>

      {toast ? <div className="bx-toast no-print">{toast}</div> : null}
    </div>
  )
}

/* =========================================================
 * 十四、挂载
 * ========================================================= */

const container = document.getElementById('builder-root')
if (container) {
  createRoot(container).render(<BuilderApp />)
}

export default BuilderApp
