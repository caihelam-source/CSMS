import { inputClass } from '../UIHelpers'

/**
 * fieldEditors.jsx — Schema 驱动填写视图的 9 类字段编辑器。
 *
 * 每个编辑器统一接收 { field, value, onChange, highlight }：
 *  - field:     docSchema.fields 中的字段定义
 *  - value:     当前值
 *  - onChange:  (nextValue) => void
 *  - highlight: 是否为「已自动预填」高亮态（选择公司后由 resolve 返回的字段）
 *
 * 安全红线：本文件不出现 eval / new Function / dangerouslySetInnerHTML。
 * 样式红线：不发明 doc-* 类名（文档渲染由 SchemaDocRenderer 负责），此处只写表单外壳。
 */

/** 「已自动预填」高亮态额外样式（绿底 + 绿框）。 */
export const HIGHLIGHT_CLASS = 'bg-green-50 border-green-300'

/**
 * 组合输入框 className。
 * @param {boolean} highlight 是否高亮
 * @param {string} extra 额外类名
 * @returns {string}
 */
export function fieldInputClass(highlight = false, extra = '') {
  return [inputClass, highlight ? HIGHLIGHT_CLASS : '', extra].filter(Boolean).join(' ')
}

/** 行内删除按钮。 */
const RemoveButton = ({ onClick, title = '删除该项' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-hairline text-ink-3 hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-colors"
  >
    ×
  </button>
)

/** 虚线「添加」按钮。 */
const AddButton = ({ onClick, label = '+ 添加一项' }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-1 px-3 py-1.5 text-sm rounded-lg border border-dashed border-hairline text-ink-2 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
  >
    {label}
  </button>
)

/** 空集合提示。 */
const EmptyHint = ({ text }) => <p className="text-xs text-ink-3">{text}</p>

/**
 * 归一化 select 选项，兼容字符串数组与 {value,label} 数组两种写法。
 * @param {Array<string|{value:*,label:*}>} options
 * @returns {Array<{value:string,label:string}>}
 */
export function normalizeFieldOptions(options) {
  if (!Array.isArray(options)) return []
  return options.map((opt) => {
    if (opt && typeof opt === 'object') {
      const value = opt.value != null ? String(opt.value) : String(opt.label ?? '')
      return { value, label: opt.label != null ? String(opt.label) : value }
    }
    const text = opt == null ? '' : String(opt)
    return { value: text, label: text }
  })
}

/** 任意值安全转数组。 */
function toArray(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === '') return []
  return [value]
}

/* =========================================================
 * 标量编辑器
 * ========================================================= */

/** 单行文本。 */
export const TextEditor = ({ field = {}, value, onChange, highlight = false }) => (
  <input
    type="text"
    className={fieldInputClass(highlight)}
    value={value == null ? '' : String(value)}
    placeholder={field.placeholder || ''}
    onChange={(e) => onChange(e.target.value)}
  />
)

/** 多行文本。 */
export const TextareaEditor = ({ field = {}, value, onChange, highlight = false }) => (
  <textarea
    rows={field.rows || 3}
    className={fieldInputClass(highlight, 'resize-y')}
    value={value == null ? '' : String(value)}
    placeholder={field.placeholder || ''}
    onChange={(e) => onChange(e.target.value)}
  />
)

/** 日期（YYYY-MM-DD）。 */
export const DateEditor = ({ value, onChange, highlight = false }) => (
  <input
    type="date"
    className={fieldInputClass(highlight)}
    value={value == null ? '' : String(value)}
    onChange={(e) => onChange(e.target.value)}
  />
)

/** 数字（防御性支持，FIELD_TYPES 未开放但 Schema 可能出现）。 */
export const NumberEditor = ({ field = {}, value, onChange, highlight = false }) => (
  <input
    type="number"
    className={fieldInputClass(highlight)}
    value={value == null || value === '' ? '' : value}
    placeholder={field.placeholder || ''}
    min={field.min}
    max={field.max}
    step={field.step || 'any'}
    onChange={(e) => {
      const raw = e.target.value
      if (raw === '') return onChange('')
      const num = Number(raw)
      return onChange(Number.isNaN(num) ? raw : num)
    }}
  />
)

/** 单选下拉。 */
export const SelectEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const options = normalizeFieldOptions(field.options)
  return (
    <select
      className={fieldInputClass(highlight)}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{field.placeholder || '请选择…'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

/** 布尔复选框。 */
export const BooleanEditor = ({ field = {}, value, onChange, highlight = false }) => (
  <label
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none ${
      highlight ? HIGHLIGHT_CLASS : 'border-hairline bg-surface'
    }`}
  >
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-sm text-ink-2">{field.checkboxLabel || field.label || '是'}</span>
  </label>
)

/* =========================================================
 * 集合类编辑器
 * ========================================================= */

/** 动态字符串列表（每行单行输入 + 删除）。 */
export const ListEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const items = toArray(value)
  const update = (index, next) => {
    const copy = items.slice()
    copy[index] = next
    onChange(copy)
  }
  const remove = (index) => {
    const copy = items.slice()
    copy.splice(index, 1)
    onChange(copy)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            className={fieldInputClass(highlight, 'flex-1')}
            value={item == null ? '' : String(item)}
            placeholder={field.placeholder || `第 ${index + 1} 项`}
            onChange={(e) => update(index, e.target.value)}
          />
          <RemoveButton onClick={() => remove(index)} />
        </div>
      ))}
      {items.length === 0 && <EmptyHint text="暂无内容" />}
      <AddButton onClick={() => onChange(items.concat(''))} label={field.addLabel || '+ 添加一项'} />
    </div>
  )
}

/** 条款列表（多行 textarea，条款正文较长）。 */
export const ClausesEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const items = toArray(value)
  const update = (index, next) => {
    const copy = items.slice()
    copy[index] = next
    onChange(copy)
  }
  const remove = (index) => {
    const copy = items.slice()
    copy.splice(index, 1)
    onChange(copy)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="shrink-0 mt-2 w-6 text-xs text-ink-3 text-right">{index + 1}.</span>
          <textarea
            rows={2}
            className={fieldInputClass(highlight, 'flex-1 resize-y')}
            value={item == null ? '' : String(item)}
            placeholder={field.placeholder || '条款正文'}
            onChange={(e) => update(index, e.target.value)}
          />
          <RemoveButton onClick={() => remove(index)} />
        </div>
      ))}
      {items.length === 0 && <EmptyHint text="暂无条款" />}
      <AddButton onClick={() => onChange(items.concat(''))} label={field.addLabel || '+ 添加条款'} />
    </div>
  )
}

/** 勾选清单，值形如 [{ text, checked }]（兼容纯字符串条目）。 */
export const ChecklistEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const items = toArray(value).map((item) =>
    item && typeof item === 'object'
      ? { text: item.text == null ? '' : String(item.text), checked: Boolean(item.checked) }
      : { text: item == null ? '' : String(item), checked: false },
  )
  const update = (index, patch) => {
    const copy = items.slice()
    copy[index] = { ...copy[index], ...patch }
    onChange(copy)
  }
  const remove = (index) => {
    const copy = items.slice()
    copy.splice(index, 1)
    onChange(copy)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="checkbox"
            className="shrink-0 w-4 h-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
            checked={item.checked}
            onChange={(e) => update(index, { checked: e.target.checked })}
          />
          <input
            type="text"
            className={fieldInputClass(highlight, 'flex-1')}
            value={item.text}
            placeholder={field.placeholder || `检查项 ${index + 1}`}
            onChange={(e) => update(index, { text: e.target.value })}
          />
          <RemoveButton onClick={() => remove(index)} />
        </div>
      ))}
      {items.length === 0 && <EmptyHint text="暂无检查项" />}
      <AddButton
        onClick={() => onChange(items.concat({ text: '', checked: false }))}
        label={field.addLabel || '+ 添加'}
      />
    </div>
  )
}

/**
 * objectList 表格式编辑器。
 * 列定义取自 field.columns：[{ key, label, type, options? }]；值形如 [{ colKey: value }]。
 */
export const ObjectListEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const columns = Array.isArray(field.columns) ? field.columns.filter((c) => c && c.key) : []
  const rows = toArray(value).map((row) => (row && typeof row === 'object' ? row : {}))

  if (columns.length === 0) {
    return <p className="text-xs text-warning">该字段缺少 columns 定义，无法编辑。</p>
  }

  const blankRow = () => {
    const row = {}
    columns.forEach((col) => { row[col.key] = col.type === 'boolean' ? false : '' })
    return row
  }
  const update = (index, key, next) => {
    const copy = rows.slice()
    copy[index] = { ...copy[index], [key]: next }
    onChange(copy)
  }
  const remove = (index) => {
    const copy = rows.slice()
    copy.splice(index, 1)
    onChange(copy)
  }

  const cellClass = `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 ${
    highlight ? HIGHLIGHT_CLASS : 'border-hairline bg-surface'
  }`

  /**
   * 渲染单个单元格控件。
   * @param {object} col 列定义
   * @param {object} row 行数据
   * @param {number} index 行号
   * @returns {JSX.Element}
   */
  const renderCell = (col, row, index) => {
    const cellValue = row[col.key]
    switch (col.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
            checked={Boolean(cellValue)}
            onChange={(e) => update(index, col.key, e.target.checked)}
          />
        )
      case 'select': {
        const options = normalizeFieldOptions(col.options)
        return (
          <select
            className={cellClass}
            value={cellValue == null ? '' : String(cellValue)}
            onChange={(e) => update(index, col.key, e.target.value)}
          >
            <option value="">—</option>
            {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )
      }
      case 'textarea':
        return (
          <textarea
            rows={2}
            className={`${cellClass} resize-y`}
            value={cellValue == null ? '' : String(cellValue)}
            onChange={(e) => update(index, col.key, e.target.value)}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            className={cellClass}
            value={cellValue == null || cellValue === '' ? '' : cellValue}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') return update(index, col.key, '')
              const num = Number(raw)
              return update(index, col.key, Number.isNaN(num) ? raw : num)
            }}
          />
        )
      case 'date':
        return (
          <input
            type="date"
            className={cellClass}
            value={cellValue == null ? '' : String(cellValue)}
            onChange={(e) => update(index, col.key, e.target.value)}
          />
        )
      default:
        return (
          <input
            type="text"
            className={cellClass}
            value={cellValue == null ? '' : String(cellValue)}
            onChange={(e) => update(index, col.key, e.target.value)}
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-hairline rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-canvas">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-2 py-1.5 text-left text-xs font-medium text-ink-3 whitespace-nowrap">
                  {col.label || col.key}
                </th>
              ))}
              <th className="px-2 py-1.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row, index) => (
              <tr key={index} className="align-top">
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5">{renderCell(col, row, index)}</td>
                ))}
                <td className="px-2 py-1.5">
                  <RemoveButton onClick={() => remove(index)} title="删除该行" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-3 text-center text-xs text-ink-3">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AddButton onClick={() => onChange(rows.concat(blankRow()))} label={field.addLabel || '+ 添加一行'} />
    </div>
  )
}

/* =========================================================
 * 分发器
 * ========================================================= */

/** type → 编辑器组件映射表。 */
export const EDITOR_MAP = {
  text: TextEditor,
  textarea: TextareaEditor,
  date: DateEditor,
  number: NumberEditor,
  select: SelectEditor,
  boolean: BooleanEditor,
  list: ListEditor,
  checklist: ChecklistEditor,
  clauses: ClausesEditor,
  objectList: ObjectListEditor,
}

/**
 * 字段编辑器分发器：按 field.type 渲染对应控件，未知类型安全回退到单行文本。
 * @param {object} props
 * @param {object} props.field 字段定义
 * @param {*} props.value 当前值
 * @param {(next:*)=>void} props.onChange 变更回调
 * @param {boolean} [props.highlight] 是否为自动预填高亮态
 * @returns {JSX.Element}
 */
export const FieldEditor = ({ field = {}, value, onChange, highlight = false }) => {
  const Editor = EDITOR_MAP[field.type] || TextEditor
  return <Editor field={field} value={value} onChange={onChange} highlight={highlight} />
}

export default FieldEditor
