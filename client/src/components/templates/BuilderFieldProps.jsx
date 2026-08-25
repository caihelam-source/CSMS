import { useEffect, useState } from 'react'
import { Trash2, ArrowUp, ArrowDown, Plus, X } from 'lucide-react'
import { inputClass, labelClass } from '../UIHelpers'
import {
  BUILDER_FIELD_TYPES,
  OBJECT_COLUMN_TYPES,
  FIELD_KEY_PATTERN,
  createBlankColumn,
  parseOptionsText,
  stringifyOptions,
  parseLinesText,
  stringifyLines,
} from './builderHelpers'

/**
 * BuilderFieldProps.jsx — 模板编辑器右侧「单个字段属性」表单。
 *
 * 安全红线：不出现 eval / new Function / dangerouslySetInnerHTML。
 * 样式红线：不发明 doc-* 类名（文档渲染由 SchemaDocRenderer 负责）。
 */

/** 小节标题。 */
const SubTitle = ({ children }) => (
  <p className="text-xs font-semibold text-ink-2 pt-1">{children}</p>
)

/**
 * 校验 key 草稿是否可用。
 * @param {string} draft 待校验的 key
 * @param {string} currentKey 字段当前 key（允许与自身相同）
 * @param {string[]} allKeys 全部字段 key
 * @returns {string} 错误信息，空串表示通过
 */
function checkKeyDraft(draft, currentKey, allKeys) {
  const key = String(draft || '').trim()
  if (!key) return '字段 key 不能为空'
  if (!FIELD_KEY_PATTERN.test(key)) return '只能用字母、数字、下划线，且不能以数字开头'
  const others = (Array.isArray(allKeys) ? allKeys : []).filter((k) => k !== currentKey)
  if (others.includes(key)) return `「${key}」已被其它字段占用`
  return ''
}

/**
 * 单个字段的属性编辑面板。
 *
 * @param {object} props
 * @param {object|null} props.field 当前选中的字段定义（null 表示未选中）
 * @param {string[]} props.allKeys 全部字段 key（用于重名即时校验）
 * @param {(next: object) => void} props.onChange 字段变更回调
 * @param {() => void} [props.onDelete] 删除当前字段回调
 * @returns {JSX.Element}
 */
const BuilderFieldProps = ({ field = null, allKeys = [], onChange, onDelete }) => {
  const currentKey = field?.key || ''
  const currentType = field?.type || ''

  const [keyDraft, setKeyDraft] = useState(currentKey)
  const [keyError, setKeyError] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [itemsText, setItemsText] = useState('')

  // 外部 key 变化（切换字段 / 重命名成功）时同步草稿
  useEffect(() => {
    setKeyDraft(currentKey)
    setKeyError('')
  }, [currentKey])

  // 仅在「切换字段」或「切换类型」时重置多行文本草稿。
  // 依赖刻意不含 field.options / field.items —— 用户逐字输入时不能把草稿重新格式化掉。
  useEffect(() => {
    setOptionsText(stringifyOptions(field?.options))
    setItemsText(stringifyLines(field?.items))
  }, [currentKey, currentType])

  if (!field) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-6 text-center">
        <p className="text-sm text-ink-2">从左侧选择一个字段来编辑它的属性</p>
        <p className="mt-1 text-xs text-ink-3">还没有字段？点击左栏的「+ 新增字段」开始。</p>
      </div>
    )
  }

  /**
   * 局部更新字段。
   * @param {object} patch 待合并的属性
   */
  const patchField = (patch) => {
    if (typeof onChange === 'function') onChange({ ...field, ...patch })
  }

  /**
   * key 输入变更：先本地校验，通过后才向上提交。
   * @param {string} raw 输入值
   */
  const handleKeyInput = (raw) => {
    setKeyDraft(raw)
    const err = checkKeyDraft(raw, currentKey, allKeys)
    setKeyError(err)
    if (!err) patchField({ key: String(raw).trim() })
  }

  /**
   * 类型变更：清理与旧类型强绑定的属性，补齐新类型必需的属性。
   * @param {string} nextType 新类型
   */
  const handleTypeChange = (nextType) => {
    const next = { ...field, type: nextType }
    delete next.options
    delete next.checkboxLabel
    delete next.items
    delete next.columns
    if (nextType === 'select') next.options = [{ value: '选项一', label: '选项一' }]
    if (nextType === 'boolean') next.checkboxLabel = field.label || field.key
    if (nextType === 'checklist') next.items = []
    if (nextType === 'objectList') next.columns = [{ key: 'name', label: '名称', type: 'text' }]
    if (typeof onChange === 'function') onChange(next)
  }

  const columns = Array.isArray(field.columns) ? field.columns : []

  /**
   * 更新 objectList 的某一列。
   * @param {number} index 列下标
   * @param {object} patch 待合并属性
   */
  const patchColumn = (index, patch) => {
    const next = columns.map((col, i) => (i === index ? { ...col, ...patch } : col))
    patchField({ columns: next })
  }

  /**
   * 移动 objectList 的某一列。
   * @param {number} index 列下标
   * @param {number} delta 位移（-1 上移 / +1 下移）
   */
  const moveColumn = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= columns.length) return
    const next = columns.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    patchField({ columns: next })
  }

  /**
   * 删除 objectList 的某一列。
   * @param {number} index 列下标
   */
  const removeColumn = (index) => {
    patchField({ columns: columns.filter((_, i) => i !== index) })
  }

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-ink">字段属性</p>

      {/* ---------- 通用属性 ---------- */}
      <div>
        <label className={labelClass} htmlFor="builder-field-key">字段 key（变量名）</label>
        <input
          id="builder-field-key"
          type="text"
          className={`${inputClass} font-mono ${keyError ? 'border-danger' : ''}`}
          value={keyDraft}
          onChange={(e) => handleKeyInput(e.target.value)}
          placeholder="companyName"
        />
        {keyError
          ? <p className="mt-1 text-xs text-danger">{keyError}</p>
          : <p className="mt-1 text-xs text-ink-3">用于文档中的变量引用，保存后请谨慎修改。</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="builder-field-label">字段名称</label>
        <input
          id="builder-field-label"
          type="text"
          className={inputClass}
          value={field.label || ''}
          onChange={(e) => patchField({ label: e.target.value })}
          placeholder="公司名称"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="builder-field-type">字段类型</label>
        <select
          id="builder-field-type"
          className={inputClass}
          value={field.type || 'text'}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {BUILDER_FIELD_TYPES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
          checked={Boolean(field.required)}
          onChange={(e) => patchField({ required: e.target.checked })}
        />
        <span className="text-sm text-ink-2">必填字段</span>
      </label>

      <div>
        <label className={labelClass} htmlFor="builder-field-placeholder">占位提示（placeholder）</label>
        <input
          id="builder-field-placeholder"
          type="text"
          className={inputClass}
          value={field.placeholder || ''}
          onChange={(e) => patchField({ placeholder: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="builder-field-help">填写说明（help）</label>
        <input
          id="builder-field-help"
          type="text"
          className={inputClass}
          value={field.help || ''}
          onChange={(e) => patchField({ help: e.target.value })}
        />
      </div>

      {/* ---------- select ---------- */}
      {field.type === 'select' && (
        <div>
          <SubTitle>下拉选项</SubTitle>
          <label className={labelClass} htmlFor="builder-field-options">每行一项，可写成 value|显示文字</label>
          <textarea
            id="builder-field-options"
            rows={5}
            className={`${inputClass} resize-y font-mono text-xs`}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value)
              patchField({ options: parseOptionsText(e.target.value) })
            }}
            placeholder={'yes|同意\nno|反对\nabstain|弃权'}
          />
          <p className="mt-1 text-xs text-ink-3">当前 {Array.isArray(field.options) ? field.options.length : 0} 个选项。</p>
        </div>
      )}

      {/* ---------- boolean ---------- */}
      {field.type === 'boolean' && (
        <div>
          <SubTitle>勾选项文案</SubTitle>
          <label className={labelClass} htmlFor="builder-field-checkbox-label">复选框旁的说明文字</label>
          <input
            id="builder-field-checkbox-label"
            type="text"
            className={inputClass}
            value={field.checkboxLabel || ''}
            onChange={(e) => patchField({ checkboxLabel: e.target.value })}
            placeholder="本决议以书面方式通过"
          />
        </div>
      )}

      {/* ---------- checklist ---------- */}
      {field.type === 'checklist' && (
        <div>
          <SubTitle>预置核对条目</SubTitle>
          <label className={labelClass} htmlFor="builder-field-items">每行一条，填写时可再增删</label>
          <textarea
            id="builder-field-items"
            rows={5}
            className={`${inputClass} resize-y text-xs`}
            value={itemsText}
            onChange={(e) => {
              setItemsText(e.target.value)
              patchField({ items: parseLinesText(e.target.value) })
            }}
            placeholder={'已核对董事名册\n已取得书面同意\n已完成备案'}
          />
        </div>
      )}

      {/* ---------- objectList ---------- */}
      {field.type === 'objectList' && (
        <div className="space-y-2">
          <SubTitle>表格列定义</SubTitle>
          {columns.length === 0 && (
            <p className="text-xs text-warning">至少需要 1 列，否则无法预览与填写。</p>
          )}
          {columns.map((col, index) => (
            <div key={index} className="border border-hairline rounded-lg p-2 space-y-2 bg-canvas">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`${inputClass} font-mono text-xs`}
                  value={col.key || ''}
                  onChange={(e) => patchColumn(index, { key: e.target.value.trim() })}
                  placeholder="列 key"
                />
                <input
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={col.label || ''}
                  onChange={(e) => patchColumn(index, { label: e.target.value })}
                  placeholder="列标题"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClass} text-xs`}
                  value={col.type || 'text'}
                  onChange={(e) => patchColumn(index, { type: e.target.value })}
                >
                  {OBJECT_COLUMN_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  title="上移"
                  aria-label="上移该列"
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-hairline text-ink-2 hover:bg-surface disabled:opacity-40"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  title="下移"
                  aria-label="下移该列"
                  disabled={index === columns.length - 1}
                  onClick={() => moveColumn(index, 1)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-hairline text-ink-2 hover:bg-surface disabled:opacity-40"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  title="删除该列"
                  aria-label="删除该列"
                  onClick={() => removeColumn(index)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-hairline text-ink-3 hover:text-danger hover:border-danger/40"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patchField({ columns: columns.concat(createBlankColumn(columns.map((c) => c.key))) })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-dashed border-hairline text-ink-2 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Plus size={14} /> 添加一列
          </button>
        </div>
      )}

      {/* ---------- 危险操作 ---------- */}
      <div className="pt-3 border-t border-hairline">
        <button
          type="button"
          onClick={() => { if (typeof onDelete === 'function') onDelete() }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
        >
          <Trash2 size={14} /> 删除此字段
        </button>
      </div>
    </div>
  )
}

export default BuilderFieldProps
