/**
 * SchemaDocRenderer.jsx — 计划树 → JSX 的机械映射层。
 *
 * 设计 §1.1 / §3.5：引擎拆为「纯函数 buildDocPlan 产出带 className 的计划树」
 * + 「React 层机械映射成 JSX」。本组件只做映射，不含任何业务逻辑。
 * 所有 class 取自 DOC_CLASS；用户输入仅作文本节点（安全红线 §7.10）。
 *
 * 支持两种模式：
 *   - 'preview'：用于屏幕实时预览（外层 .doc-page + 内层 .doc article）
 *   - 'print'：同结构（打印样式由 document.css 的 @media print 控制）
 */
import { Fragment, useMemo } from 'react'
import { BLANK, DOC_CLASS, buildDocPlan } from './schemaUtils.js'
import {
  renderRuns,
  CheckList,
  ClauseList,
  InfoTable,
  ObjectTable,
  SignBlock,
  DocNote,
  DocShell,
} from './DocAtoms.jsx'

/**
 * 单值渲染：空值显示下划线占位。
 * @param {*} value
 * @returns {JSX.Element}
 */
function renderValue(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) return <span className={DOC_CLASS.blank}>{BLANK}</span>
  return <span>{text}</span>
}

/**
 * 将一个计划节点机械映射为 JSX。
 * @param {object} node PlanNode
 * @returns {JSX.Element|null}
 */
function renderNode(node) {
  if (!node) return null
  const { type, className, props } = node
  switch (type) {
    case 'company':
      return (
        <p className={className}>
          {renderValue(props.value)}
        </p>
      )
    case 'title':
      return (
        <h1 className={className}>{props.text}</h1>
      )
    case 'subtitle':
      return (
        <p className={className}>{props.text}</p>
      )
    case 'divider':
      return <hr className={className} />
    case 'meta':
      return (
        <div className={className}>
          <span>{renderRuns(props.left)}</span>
          <span>{renderRuns(props.right)}</span>
        </div>
      )
    case 'heading':
      return (
        <p className={className}>{props.text}</p>
      )
    case 'paragraph':
      return (
        <p className={className}>{renderRuns(props.runs)}</p>
      )
    case 'infoTable':
      return <InfoTable rows={props.rows} />
    case 'checkList':
      if (props.mode === 'single') {
        return (
          <ul className={className}>
            <li>
              <span className={DOC_CLASS.box}>{props.checked ? '☑' : '☐'}</span>
              <span>{props.text}</span>
            </li>
          </ul>
        )
      }
      return <CheckList items={props.items} placeholder={props.placeholder} />
    case 'clauseList':
      return (
        <ClauseList
          items={props.items}
          variant={props.variant}
          marker={props.marker}
          quote={props.quote}
          placeholder={props.placeholder}
        />
      )
    case 'objectTable':
      return <ObjectTable columns={props.columns} rows={props.rows} emptyText={props.emptyText} />
    case 'signBlock':
      return <SignBlock items={props.items} note={props.note} />
    case 'note':
      return <DocNote text={props.text} />
    default:
      return null
  }
}

/**
 * 合规文书渲染器。
 * @param {{docSchema:object, data?:object, mode?:'preview'|'print'}} props
 * @returns {JSX.Element}
 */
export default function SchemaDocRenderer({ docSchema = {}, data = {}, mode = 'preview' }) {
  const plan = useMemo(() => buildDocPlan(docSchema, data), [docSchema, data])
  if (!plan || plan.length === 0) {
    return (
      <div className={DOC_CLASS.page} data-mode={mode}>
        <div className={DOC_CLASS.empty}>（暂无内容）</div>
      </div>
    )
  }
  return (
    <div className={DOC_CLASS.page} data-mode={mode}>
      <DocShell>
        {plan.map((node, i) => (
          <Fragment key={i}>{renderNode(node)}</Fragment>
        ))}
      </DocShell>
    </div>
  )
}
