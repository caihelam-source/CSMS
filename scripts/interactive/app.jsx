/**
 * app.jsx — Claw 合规文书「可交互编辑预览器」前端入口（浏览器端 React 应用）。
 *
 * 目标：把只读静态 HTML 预览升级为「左侧按 docSchema 填表 → 右侧实时出正式文书」的
 * 交互体验，与 Claw 真实 Builder 一致；全程纯前端，不依赖 MongoDB / 后端接口。
 *
 * 约束（红线）：
 *   - 只读引用产品代码：SchemaDocRenderer.jsx / schemaUtils.js / 9 个 preset，
 *     一行都不修改（本文件不属于产品代码，不被前端或后端引用）。
 *   - 用户输入只作为受控组件的值与文本节点，绝不 eval / innerHTML。
 *
 * 数据形状（已核对产品代码，勿改）：
 *   - checklist 值为 `{text:string, checked:boolean}[]`（见 _shared.js#toCheckItems
 *     与 schemaUtils#normalizeCheckItems，渲染器读的是 `text` 而非 `label`）。
 *   - list / clauses 值为 `string[]`。
 *   - objectList 值为 `object[]`，列定义 = itemDefFields ++ itemDataFields（兜底 columns）。
 */
import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import SchemaDocRenderer from '../../client/src/schemaDoc/SchemaDocRenderer.jsx'
import {
  createInitialData,
  createSampleData,
  isFieldVisible,
  normalizeCheckItems,
  normalizeOptions,
  validateSchemaData,
} from '../../client/src/schemaDoc/schemaUtils.js'

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
 * 一、预设装载与通用工具
 * ========================================================= */

/**
 * 兼容 CJS/ESM 互操作：优先取 module.exports 本体，其次取 .default。
 * @param {object} mod 导入结果
 * @returns {object} 预设对象
 */
function unwrap(mod) {
  if (mod && typeof mod === 'object' && !mod.presetKey && mod.default) return mod.default
  return mod || {}
}

/** 原始预设列表，顺序即左栏 tab 顺序。 @type {Array<object>} */
const RAW_PRESETS = [
  directorConfirmation,
  du004gUndertaking,
  departmentSelfAssessment,
  internalControlReport,
  boardResolution,
  projectCharter,
  directorResignation,
  directorConsentToAct,
  directorCodeComplianceConfirmation,
]

/**
 * 归一化预设：{ key, name, description, docSchema, sampleData }。
 * @type {Array<{key:string,name:string,description:string,docSchema:object,sampleData:object}>}
 */
const PRESETS = RAW_PRESETS.map((raw) => {
  const preset = unwrap(raw)
  return {
    key: preset.presetKey || 'unknown-preset',
    name: preset.name || preset.presetKey || '未命名模板',
    description: preset.description || '',
    docSchema: preset.docSchema || {},
    sampleData: preset.sampleData || {},
  }
})

/**
 * 深拷贝纯数据（优先 structuredClone，回退 JSON）。
 * @template T
 * @param {T} value 任意可序列化值
 * @returns {T} 拷贝结果
 */
function cloneData(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

/**
 * 生成某预设的「示例数据」（空白初值叠加 sampleData，且已深拷贝）。
 * @param {{docSchema:object, sampleData:object}} preset 预设
 * @returns {object} 表单数据
 */
function sampleDataFor(preset) {
  return createSampleData(preset.docSchema, preset.sampleData)
}

/**
 * 生成某预设的「空白表单数据」（按字段类型取空默认值）。
 * @param {{docSchema:object}} preset 预设
 * @returns {object} 表单数据
 */
function blankDataFor(preset) {
  return createInitialData(preset.docSchema)
}

/**
 * string[] ⇄ 多行文本互转：数组 → 文本。
 * @param {*} value 字段值
 * @returns {string} 多行文本
 */
function linesToText(value) {
  if (Array.isArray(value)) return value.map((item) => String(item == null ? '' : item)).join('\n')
  return String(value == null ? '' : value)
}

/**
 * string[] ⇄ 多行文本互转：文本 → 数组（逐行 trim 并过滤空行）。
 * @param {string} text 多行文本
 * @returns {string[]} 条目数组
 */
function textToLines(text) {
  return String(text == null ? '' : text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * 转义 HTML 文本（仅用于导出文件的 <title>）。
 * @param {string} text 原文
 * @returns {string} 转义结果
 */
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 清洗文件名中的非法字符。
 * @param {string} name 原始名
 * @returns {string} 安全文件名片段
 */
function safeFileName(name) {
  return String(name == null ? '' : name)
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .trim()
    .slice(0, 60)
}

/**
 * 生成 YYYYMMDD 紧凑日期串（导出文件名兜底）。
 * @returns {string} 日期串
 */
function todayCompact() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

/**
 * 生成子字段（objectList 行内字段）的空值。
 * @param {{type?:string}} def 子字段定义
 * @returns {*} 空值
 */
function emptySubValue(def) {
  if (def && def.type === 'boolean') return false
  return ''
}

/* =========================================================
 * 二、基础输入原子
 * ========================================================= */

/**
 * 下拉选择（自动补齐「请选择」空项与不在选项内的历史值）。
 * @param {{value:*, options:Array, placeholder?:string, onChange:Function, className?:string}} props 属性
 * @returns {JSX.Element} 控件
 */
function SelectInput({ value, options = [], placeholder = '（请选择）', onChange, className = 'ctl' }) {
  const normalized = normalizeOptions(Array.isArray(options) ? options : [])
  const current = value == null ? '' : String(value)
  const known = normalized.some((opt) => String(opt.value) === current)
  return (
    <select className={className} value={current} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {!known && current !== '' ? <option value={current}>{current}（自定义）</option> : null}
      {normalized.map((opt, i) => (
        <option key={i} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

/**
 * 多行文本 ⇄ string[] 编辑器。
 *
 * 内部持有「原始文本」局部状态，避免边打字边过滤空行导致无法换行；
 * 外部重置（切模板 / 空白 / 示例）通过父层 key 重挂载同步。
 * @param {{value:*, rows?:number, placeholder?:string, onChange:Function}} props 属性
 * @returns {JSX.Element} 控件
 */
function LinesEditor({ value, rows = 4, placeholder = '每行一条', onChange }) {
  const [text, setText] = useState(() => linesToText(value))
  /**
   * 输入回调：本地存原文，向上抛出解析后的数组。
   * @param {object} event 输入事件
   * @returns {void}
   */
  const handleChange = (event) => {
    const next = event.target.value
    setText(next)
    onChange(textToLines(next))
  }
  return <textarea className="ctl" rows={rows} value={text} placeholder={placeholder} onChange={handleChange} />
}

/**
 * checklist 编辑器：勾选 / 改文案 / 删除 / 新增（含 options 快捷添加）。
 * 值形状固定为 `{text, checked}[]`，与 schemaUtils#normalizeCheckItems 一致。
 * @param {{field:object, value:*, onChange:Function}} props 属性
 * @returns {JSX.Element} 控件
 */
function ChecklistEditor({ field, value, onChange }) {
  const items = normalizeCheckItems(value)
  const options = normalizeOptions(Array.isArray(field.options) ? field.options : [])
  const missing = options.filter((opt) => !items.some((item) => item.text === opt.label))

  /**
   * 以「不可变更新」方式替换某条目。
   * @param {number} index 条目下标
   * @param {object} patch 局部补丁
   * @returns {void}
   */
  const patchItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : { ...item })))
  }

  return (
    <div className="chk">
      {items.length === 0 ? <p className="fld-empty">{field.emptyHint || '暂无条目，请点击「添加」新增。'}</p> : null}
      {items.map((item, i) => (
        <div className="chk-row" key={i}>
          <input
            type="checkbox"
            className="chk-box"
            checked={Boolean(item.checked)}
            onChange={(e) => patchItem(i, { checked: e.target.checked })}
          />
          <input
            type="text"
            className="ctl chk-text"
            value={item.text}
            onChange={(e) => patchItem(i, { text: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-mini btn-danger"
            onClick={() => onChange(items.filter((_, k) => k !== i).map((it) => ({ ...it })))}
          >
            删除
          </button>
        </div>
      ))}
      <div className="chk-actions">
        <button
          type="button"
          className="btn btn-mini"
          onClick={() => onChange([...items.map((it) => ({ ...it })), { text: field.newItemText || '', checked: true }])}
        >
          + {field.addLabel || '添加条目'}
        </button>
        {missing.map((opt, i) => (
          <button
            type="button"
            className="btn btn-mini btn-ghost"
            key={i}
            onClick={() => onChange([...items.map((it) => ({ ...it })), { text: opt.label, checked: true }])}
          >
            + {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * objectList 行内子字段控件（text / textarea / date / select / boolean）。
 * @param {{def:object, value:*, onChange:Function}} props 属性
 * @returns {JSX.Element} 控件
 */
function SubFieldControl({ def, value, onChange }) {
  switch (def.type) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          className="chk-box"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'select':
      return <SelectInput className="ctl ctl-sm" value={value} options={def.options || []} onChange={onChange} />
    case 'date':
      return (
        <input
          type="date"
          className="ctl ctl-sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'textarea':
      return (
        <textarea
          className="ctl ctl-sm"
          rows={2}
          value={value == null ? '' : String(value)}
          placeholder={def.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return (
        <input
          type="text"
          className="ctl ctl-sm"
          value={value == null ? '' : String(value)}
          placeholder={def.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

/**
 * objectList 编辑器：可增删行的表格，列 = itemDefFields ++ itemDataFields（兜底 columns）。
 * @param {{field:object, value:*, onChange:Function}} props 属性
 * @returns {JSX.Element} 控件
 */
function ObjectListEditor({ field, value, onChange }) {
  const defs = useMemo(() => {
    const head = Array.isArray(field.itemDefFields) ? field.itemDefFields : []
    const tail = Array.isArray(field.itemDataFields) ? field.itemDataFields : []
    const merged = [...head, ...tail]
    if (merged.length > 0) return merged
    return Array.isArray(field.columns) ? field.columns : []
  }, [field])

  const rows = Array.isArray(value) ? value : []

  /**
   * 更新某行某列的值（不可变更新，保证 React 重渲染）。
   * @param {number} rowIndex 行下标
   * @param {string} key 子字段 key
   * @param {*} next 新值
   * @returns {void}
   */
  const updateCell = (rowIndex, key, next) => {
    onChange(rows.map((row, i) => (i === rowIndex ? { ...row, [key]: next } : row)))
  }

  /**
   * 新增一行：优先用 field.newItem 深拷贝，否则按子字段定义生成空对象。
   * @returns {void}
   */
  const addRow = () => {
    const base =
      field.newItem && typeof field.newItem === 'object'
        ? cloneData(field.newItem)
        : defs.reduce((acc, def) => {
            acc[def.key] = emptySubValue(def)
            return acc
          }, {})
    onChange([...rows, base])
  }

  return (
    <div className="objlist">
      {rows.length === 0 ? <p className="fld-empty">{field.emptyHint || '暂无条目，请点击「添加行」新增。'}</p> : null}
      {rows.length > 0 ? (
        <div className="objlist-scroll">
          <table className="objlist-table">
            <thead>
              <tr>
                <th className="objlist-idx">#</th>
                {defs.map((def, i) => (
                  <th key={i}>{def.label || def.key}</th>
                ))}
                <th className="objlist-op">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="objlist-idx">{ri + 1}</td>
                  {defs.map((def, ci) => (
                    <td key={ci}>
                      <SubFieldControl
                        def={def}
                        value={row ? row[def.key] : undefined}
                        onChange={(next) => updateCell(ri, def.key, next)}
                      />
                    </td>
                  ))}
                  <td className="objlist-op">
                    <button
                      type="button"
                      className="btn btn-mini btn-danger"
                      onClick={() => onChange(rows.filter((_, k) => k !== ri))}
                    >
                      删除本行
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="chk-actions">
        <button type="button" className="btn btn-mini" onClick={addRow}>
          + {field.addLabel || '添加行'}
        </button>
      </div>
    </div>
  )
}

/* =========================================================
 * 三、字段分派（9 类 FIELD_TYPES）
 * ========================================================= */

/**
 * 按字段 type 生成对应受控控件。
 * @param {{field:object, value:*, onChange:Function}} props 属性
 * @returns {JSX.Element} 控件
 */
function FieldControl({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className="ctl"
          rows={3}
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          className="ctl"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'select':
      return <SelectInput value={value} options={field.options || []} onChange={onChange} />
    case 'boolean':
      return (
        <label className="bool">
          <input type="checkbox" className="chk-box" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{field.checkboxLabel || field.label || field.key}</span>
        </label>
      )
    case 'list':
    case 'clauses':
      return (
        <LinesEditor
          value={value}
          rows={field.type === 'clauses' ? 5 : 4}
          placeholder={field.placeholder || '每行一条'}
          onChange={onChange}
        />
      )
    case 'checklist':
      return <ChecklistEditor field={field} value={value} onChange={onChange} />
    case 'objectList':
      return <ObjectListEditor field={field} value={value} onChange={onChange} />
    default:
      return (
        <input
          type="text"
          className="ctl"
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

/* =========================================================
 * 四、主应用
 * ========================================================= */

/**
 * 交互式预览器主组件：左栏表单，右栏实时文书预览。
 * @returns {JSX.Element} 应用
 */
function App() {
  const [idx, setIdx] = useState(0)
  const [data, setData] = useState(() => sampleDataFor(PRESETS[0]))
  const [resetToken, setResetToken] = useState(0)
  const previewRef = useRef(null)

  const preset = PRESETS[idx] || PRESETS[0]
  const docSchema = preset.docSchema
  const fields = Array.isArray(docSchema.fields) ? docSchema.fields : []
  const visibleFields = fields.filter((field) => field && field.key != null && isFieldVisible(field, data))
  const errors = useMemo(() => validateSchemaData(docSchema, data), [docSchema, data])

  /**
   * 切换模板：重置数据为该预设 sampleData 深拷贝，并重挂载多行编辑器。
   * @param {number} nextIdx 目标下标
   * @returns {void}
   */
  const selectPreset = (nextIdx) => {
    setIdx(nextIdx)
    setData(sampleDataFor(PRESETS[nextIdx]))
    setResetToken((token) => token + 1)
  }

  /**
   * 重置为空白表单（各字段按类型取空默认值）。
   * @returns {void}
   */
  const applyBlank = () => {
    setData(blankDataFor(preset))
    setResetToken((token) => token + 1)
  }

  /**
   * 重置为示例数据。
   * @returns {void}
   */
  const applySample = () => {
    setData(sampleDataFor(preset))
    setResetToken((token) => token + 1)
  }

  /**
   * 更新单个字段值（不可变更新，触发 SchemaDocRenderer 重算 buildDocPlan）。
   * @param {string} key 字段 key
   * @param {*} next 新值
   * @returns {void}
   */
  const setFieldValue = (key, next) => {
    setData((prev) => ({ ...prev, [key]: next }))
  }

  /**
   * 导出当前预览为独立 HTML（内联 document.css，Blob 下载）。
   * @returns {void}
   */
  const exportHtml = () => {
    const host = previewRef.current
    if (!host) return
    const node = host.querySelector('.doc-page') || host.querySelector('.doc')
    if (!node) return
    const styleNode = document.getElementById('doc-css')
    const css = styleNode ? styleNode.textContent : ''
    const html = [
      '<!doctype html>',
      '<html lang="zh">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(preset.name)}</title>`,
      '<style>',
      css,
      '</style>',
      '</head>',
      '<body>',
      node.outerHTML,
      '</body>',
      '</html>',
      '',
    ].join('\n')

    const suffix = safeFileName(data && data.companyName ? String(data.companyName) : '') || todayCompact()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${preset.key}-${suffix}.html`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ix-app">
      <header className="ix-header no-print">
        <div className="ix-brand">
          <strong>Claw 合规文书 · 交互预览器</strong>
          <span className="ix-sub">左侧填表 → 右侧实时成文（纯前端，无需后端）</span>
        </div>
        <div className="ix-actions">
          <button type="button" className="btn" onClick={applyBlank}>
            空白表单
          </button>
          <button type="button" className="btn" onClick={applySample}>
            示例数据
          </button>
          <button type="button" className="btn btn-primary" onClick={exportHtml}>
            导出 HTML
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            打印
          </button>
        </div>
      </header>

      <main className="ix-body">
        <aside className="ix-form no-print">
          <div className="tabs">
            {PRESETS.map((item, i) => (
              <button
                type="button"
                key={item.key}
                className={i === idx ? 'tab tab-on' : 'tab'}
                onClick={() => selectPreset(i)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="form-head">
            <h2 className="form-title">{preset.name}</h2>
            {preset.description ? <p className="form-desc">{preset.description}</p> : null}
            <p className="form-meta">
              presetKey：<code>{preset.key}</code> · 字段 {fields.length} 个 · 当前可见 {visibleFields.length} 个
            </p>
            {errors.length > 0 ? (
              <div className="errors">
                <p className="errors-title">待完善（{errors.length}）</p>
                <ul>
                  {errors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="ok">校验通过：必填项与交叉规则均已满足。</p>
            )}
          </div>

          <div className="form-body">
            {visibleFields.map((field) => (
              <div className="fld" key={field.key}>
                <div className="fld-label">
                  <span>{field.label || field.key}</span>
                  {field.required ? <span className="req">必填</span> : null}
                  <span className="fld-type">{field.type}</span>
                </div>
                <FieldControl
                  key={`${preset.key}:${field.key}:${resetToken}`}
                  field={field}
                  value={data ? data[field.key] : undefined}
                  onChange={(next) => setFieldValue(field.key, next)}
                />
                {field.hint ? <p className="fld-hint">{field.hint}</p> : null}
              </div>
            ))}
          </div>
        </aside>

        <section className="ix-preview" ref={previewRef}>
          <SchemaDocRenderer docSchema={docSchema} data={data} mode="preview" />
        </section>
      </main>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}

export default App
