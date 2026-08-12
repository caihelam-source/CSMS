/**
 * DocAtoms.jsx — 文书排版原子组件（10 类 + renderRuns 辅助）。
 *
 * 这些组件只接收「已解析的纯数据 / runs」，不读 schema、不读 data，
 * 因此可被 SchemaDocRenderer（计划树 → JSX 机械映射）与 T03 表单复用。
 * 所有 class 一律取自 DOC_CLASS（禁止内联字符串字面量，设计 §7.6）。
 *
 * ⚠️ 安全：用户输入只作为文本节点渲染，绝不使用 dangerouslySetInnerHTML / innerHTML。
 */
import { BLANK, DOC_CLASS, normalizeStringList } from './schemaUtils.js'

/**
 * 把 segments 解析后的 runs 数组渲染为 JSX 片段。
 *   blank → <span class="doc-blank">{text}</span>
 *   bold  → <strong>{text}</strong>
 *   其它  → <span>{text}</span>
 * @param {Array<{text:string, bold?:boolean, blank?:boolean}>} runs
 * @returns {Array<JSX.Element>}
 */
export function renderRuns(runs = []) {
  return runs.map((run, i) => {
    if (run.blank) return <span key={i} className={DOC_CLASS.blank}>{run.text}</span>
    if (run.bold) return <strong key={i}>{run.text}</strong>
    return <span key={i}>{run.text}</span>
  })
}

/**
 * 单值展示：空值显示下划线占位。
 */
export function Val({ value, blank = BLANK }) {
  const text = value == null ? '' : String(value).trim()
  if (!text) return <span className={DOC_CLASS.blank}>{blank}</span>
  return <span>{text}</span>
}

/**
 * 多行文本 → 段落。value 可为字符串（按换行拆段）或 string[]。
 */
export function MultiLine({ value, indent = true, placeholder = '（未填写）' }) {
  const lines = normalizeStringList(value)
    .map((line) => String(line).trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) {
    const cls = indent ? `${DOC_CLASS.p} ${DOC_CLASS.blank}` : `${DOC_CLASS.p} ${DOC_CLASS.pFlat} ${DOC_CLASS.blank}`
    return <p className={cls}>{placeholder}</p>
  }
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={indent ? DOC_CLASS.p : `${DOC_CLASS.p} ${DOC_CLASS.pFlat}`}>
          {line}
        </p>
      ))}
    </>
  )
}

/**
 * 有序列表（里程碑 / 决议等）。
 */
export function NumberedList({ items = [], placeholder = '（未填写）' }) {
  const list = normalizeStringList(items)
    .map((line) => String(line).trim())
    .filter((line) => line.length > 0)
  if (list.length === 0) return <p className={`${DOC_CLASS.p} ${DOC_CLASS.blank}`}>{placeholder}</p>
  return (
    <ol className={DOC_CLASS.ol}>
      {list.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

/**
 * 勾选清单：固定选项({options,value}) 或 可编辑条目({items:[{text,checked}]})。
 */
export function CheckList({ items = [], placeholder = '（暂无条目）' }) {
  if (!items.length) return <p className={`${DOC_CLASS.p} ${DOC_CLASS.blank}`}>{placeholder}</p>
  return (
    <ul className={DOC_CLASS.list}>
      {items.map((item, i) => (
        <li key={i}>
          <span className={DOC_CLASS.box}>{item.checked ? '☑' : '☐'}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * 条款清单：checked→ ul（带（序号）+ ☑）；ordered→ ol；plain→ 多个 p（quote 外包 doc-quote）。
 */
export function ClauseList({ items = [], variant = 'checked', marker = '☑', quote = false, placeholder = '（暂无条款）' }) {
  if (!items.length) return <p className={`${DOC_CLASS.p} ${DOC_CLASS.blank}`}>{placeholder}</p>
  if (variant === 'ordered') {
    return (
      <ol className={DOC_CLASS.ol}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    )
  }
  if (variant === 'plain') {
    const paras = items.map((item, i) => (
      <p key={i} className={DOC_CLASS.p}>
        {item}
      </p>
    ))
    return quote ? <div className={DOC_CLASS.quote}>{paras}</div> : <>{paras}</>
  }
  return (
    <ul className={DOC_CLASS.list}>
      {items.map((item, i) => (
        <li key={i}>
          <span className={DOC_CLASS.box}>{marker}</span>
          <span>
            （{i + 1}）{item}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * 键值信息表。
 */
export function InfoTable({ rows = [] }) {
  return (
    <table className={DOC_CLASS.table}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <th className={DOC_CLASS.thKey}>{row.label}</th>
            <td>{row.runs && row.runs.length ? renderRuns(row.runs) : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * 对象表格（objectList 双层字段渲染）。columns 经 objectTable blankWhen 三态预解析为 cells。
 */
export function ObjectTable({ columns = [], rows = [], emptyText = '（暂无条目）' }) {
  if (!rows.length) return <p className={`${DOC_CLASS.p} ${DOC_CLASS.blank}`}>{emptyText}</p>
  return (
    <table className={DOC_CLASS.table}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th
              key={i}
              className={col.align === 'center' ? DOC_CLASS.center : ''}
              style={col.width ? { width: `${col.width}%` } : undefined}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.cells.map((cell, ci) => (
              <td
                key={ci}
                className={
                  cell.blank
                    ? DOC_CLASS.blank
                    : columns[ci] && columns[ci].align === 'center'
                      ? DOC_CLASS.center
                      : ''
                }
              >
                {cell.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * 签署区。
 */
export function SignBlock({ items = [], note = '' }) {
  return (
    <div className={DOC_CLASS.sign}>
      <div className={DOC_CLASS.signGrid}>
        {items.map((item, i) => (
          <div className={DOC_CLASS.signRow} key={i}>
            <span className={DOC_CLASS.signLabel}>{item.label}：</span>
            <span className={DOC_CLASS.line}>{item.runs && item.runs.length ? renderRuns(item.runs) : ''}</span>
          </div>
        ))}
      </div>
      {note ? <p className={DOC_CLASS.note}>{note}</p> : null}
    </div>
  )
}

/**
 * 注释段（存档说明等）。
 */
export function DocNote({ text = '' }) {
  return <p className={DOC_CLASS.note}>{text}</p>
}

/**
 * 文书根容器（.doc article）。SchemaDocRenderer 用其包裹计划树。
 */
export function DocShell({ children }) {
  return <article className={DOC_CLASS.root}>{children}</article>
}

export default DocShell
