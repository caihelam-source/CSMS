/**
 * docxFromDom.js — 纯前端 Word(.docx) 导出（DOM → docx）。
 *
 * 移植自 MVP hk-compliance-templates/src/docxExport.js（与 Claw 完全同版本 docx@^9.7.1）。
 *
 * 设计原则（§1.1 D6 / §4.4）：
 *  1. 以「预览区已渲染的 `.doc` DOM」为唯一输入，遍历 `.doc-*` 语义 class
 *     映射为 docx 元素；
 *  2. 新增模板只需改 schemaUtils + DocAtoms，导出自动与屏幕预览一致；
 *  3. 除 exportDocxFromElement 外的函数均为纯函数，便于测试。
 *
 * ⚠️ FONT 来自 client/src/utils/docxCommon.js（设计 §2.4 / §6.2），不重复定义。
 * ⚠️ 安全红线（§7.10）：本文件不出现 eval / new Function / dangerouslySetInnerHTML。
 *
 * 依赖：docx
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx'
import { FONT } from './docxCommon.js'

/* =========================================================
 * 一、排版常量
 * ========================================================= */

/** 字号（half-points）：21 = 10.5pt = 五号。 */
const SIZE_BODY = 21
const SIZE_SMALL = 18
const SIZE_NOTE = 17
const SIZE_H1 = 32
const SIZE_H2 = 24
const SIZE_COMPANY = 24

/** 首行缩进 2 字符（twips）。 */
const INDENT_FIRST_LINE = 420
/** 列表左缩进（twips）。 */
const INDENT_LIST = 420

const COLOR_TEXT = '000000'
const COLOR_MUTED = '404040'
const COLOR_BORDER = '333333'
const FILL_HEADER = 'F1F1F1'

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }
const TABLE_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
  insideHorizontal: CELL_BORDER,
  insideVertical: CELL_BORDER,
}

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = {
  top: NONE_BORDER,
  bottom: NONE_BORDER,
  left: NONE_BORDER,
  right: NONE_BORDER,
  insideHorizontal: NONE_BORDER,
  insideVertical: NONE_BORDER,
}

/* =========================================================
 * 二、纯工具函数
 * ========================================================= */

/**
 * 提取节点纯文本并压缩空白。
 * @param {Node|null} node
 * @returns {string}
 */
export function textOf(node) {
  if (!node) return ''
  const raw = typeof node.textContent === 'string' ? node.textContent : ''
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * 两位补零。
 * @param {number} value
 * @returns {string}
 */
function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * 去除文件名中的非法字符。
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFileName(name) {
  return String(name ?? '')
    /* eslint-disable-next-line no-control-regex */
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim()
}

/**
 * 生成导出文件名：{companyName}-{templateId}-{YYYYMMDD}.docx
 * companyName 为空时使用「未命名」。
 * @param {string} companyName 公司名称
 * @param {string} templateId 模板 id
 * @param {Date} date 日期（默认当天）
 * @returns {string}
 */
export function buildDocxFileName(companyName, templateId, date = new Date()) {
  const company = sanitizeFileName(companyName) || '未命名'
  const tpl = sanitizeFileName(templateId) || 'template'
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
  return `${company}-${tpl}-${stamp}.docx`
}

/**
 * 构造一个文本 run。
 * @param {string} text
 * @param {{bold?:boolean,size?:number,color?:string,underline?:object}} options
 * @returns {TextRun}
 */
function run(text, options = {}) {
  const config = {
    text: String(text ?? ''),
    font: FONT,
    size: options.size ?? SIZE_BODY,
    bold: Boolean(options.bold),
    color: options.color ?? COLOR_TEXT,
  }
  if (options.underline) config.underline = options.underline
  return new TextRun(config)
}

/**
 * 构造一个段落。
 * @param {string} text
 * @param {object} options
 * @returns {Paragraph}
 */
function paragraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    indent: options.indent,
    spacing: options.spacing ?? { before: 40, after: 40, line: 340 },
    children: [run(text, options)],
  })
}

/* =========================================================
 * 三、DOM → docx 元素转换
 * ========================================================= */

/**
 * 取 li 文本（保留 ☑ / ☐ 前缀并补空格）。
 * @param {Element} li
 * @returns {string}
 */
function listItemText(li) {
  const box = li.querySelector('.doc-box')
  if (!box) return textOf(li)
  const boxText = textOf(box)
  const rest = Array.from(li.childNodes)
    .filter((node) => node !== box)
    .map((node) => (typeof node.textContent === 'string' ? node.textContent : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return rest ? `${boxText} ${rest}` : boxText
}

/**
 * 解析表格列宽（百分比）。
 * @param {Element} tableEl
 * @returns {number[]}
 */
function columnWidths(tableEl) {
  const firstRow = tableEl.querySelector('tr')
  if (!firstRow) return []
  const cells = Array.from(firstRow.children)
  if (cells.length === 0) return []
  const declared = cells.map((cell) => {
    const styleAttr = cell.getAttribute('style') || ''
    const matched = /width:\s*([\d.]+)%/.exec(styleAttr)
    if (matched) return Number(matched[1])
    if (cell.classList.contains('doc-th-key')) return 30
    return 0
  })
  const declaredTotal = declared.reduce((sum, value) => sum + value, 0)
  const restCount = declared.filter((value) => !value).length
  if (restCount === 0) return declared
  const rest = Math.max(100 - declaredTotal, restCount * 5) / restCount
  return declared.map((value) => (value ? value : rest))
}

/**
 * 表格 → docx Table。
 * @param {Element} tableEl
 * @returns {Table|null}
 */
function convertTable(tableEl) {
  const rowEls = Array.from(tableEl.querySelectorAll('tr'))
  if (rowEls.length === 0) return null
  const widths = columnWidths(tableEl)

  const rows = rowEls.map((rowEl) => {
    const cellEls = Array.from(rowEl.children)
    const isHeaderRow = cellEls.length > 0 && cellEls.every((cell) => cell.tagName.toLowerCase() === 'th')
    const cells = cellEls.map((cellEl, index) => {
      const isTh = cellEl.tagName.toLowerCase() === 'th'
      const centered = cellEl.classList.contains('doc-center')
      const width = widths[index]
      return new TableCell({
        width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
        shading: isTh ? { fill: FILL_HEADER } : undefined,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({
            alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 20, after: 20, line: 300 },
            children: [run(textOf(cellEl), { bold: isTh, size: SIZE_SMALL })],
          }),
        ],
      })
    })
    return new TableRow({ children: cells, tableHeader: isHeaderRow })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows,
  })
}

/**
 * 签署区 → 无边框两列表格 + 存档说明。
 * @param {Element} el
 * @param {Array} out
 */
function convertSignBlock(el, out) {
  const rowEls = Array.from(el.querySelectorAll('.doc-sign-row'))
  if (rowEls.length > 0) {
    out.push(new Paragraph({ children: [run('')], spacing: { before: 320, after: 0 } }))
    const pairs = []
    for (let index = 0; index < rowEls.length; index += 2) {
      pairs.push([rowEls[index], rowEls[index + 1] || null])
    }
    const rows = pairs.map(
      (pair) =>
        new TableRow({
          children: pair.map((rowEl) => {
            if (!rowEl) {
              return new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [run('')] })],
              })
            }
            const label = textOf(rowEl.querySelector('.doc-sign-label')) || ''
            const value = textOf(rowEl.querySelector('.doc-line')) || ''
            const shown = value ? `${value}\u3000\u3000` : '\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000'
            return new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 0, right: 160 },
              children: [
                new Paragraph({
                  spacing: { before: 40, after: 40, line: 320 },
                  children: [
                    run(label, { bold: true, size: SIZE_SMALL }),
                    run(shown, { size: SIZE_SMALL, underline: { type: UnderlineType.SINGLE, color: COLOR_TEXT } }),
                  ],
                }),
              ],
            })
          }),
        }),
    )
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, rows }))
  }

  const note = el.querySelector('.doc-note')
  const noteText = textOf(note)
  if (noteText) {
    out.push(
      new Paragraph({
        spacing: { before: 320, after: 40, line: 300 },
        border: { top: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA', space: 6 } },
        children: [run(noteText, { size: SIZE_NOTE, color: COLOR_MUTED })],
      }),
    )
  }
}

/**
 * 单个 DOM 元素 → docx 元素（追加到 out）。
 * @param {Element} el
 * @param {Array} out
 */
function convertElement(el, out) {
  if (!el || el.nodeType !== 1) return
  const tag = el.tagName.toLowerCase()
  const has = (className) => el.classList.contains(className)

  if (tag === 'hr') {
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_TEXT, space: 2 } },
        children: [run('')],
      }),
    )
    return
  }

  if (has('doc-company')) {
    out.push(
      paragraph(textOf(el), {
        alignment: AlignmentType.CENTER,
        bold: true,
        size: SIZE_COMPANY,
        spacing: { before: 0, after: 60, line: 320 },
      }),
    )
    return
  }

  if (tag === 'h1' || has('doc-title')) {
    out.push(
      paragraph(textOf(el), {
        alignment: AlignmentType.CENTER,
        bold: true,
        size: SIZE_H1,
        spacing: { before: 160, after: 60, line: 360 },
      }),
    )
    return
  }

  if (has('doc-subtitle')) {
    out.push(
      paragraph(textOf(el), {
        alignment: AlignmentType.CENTER,
        size: SIZE_SMALL,
        color: COLOR_MUTED,
        spacing: { before: 0, after: 80, line: 300 },
      }),
    )
    return
  }

  if (has('doc-meta')) {
    const parts = Array.from(el.children).map(textOf).filter(Boolean)
    const texts = parts.length > 0 ? parts : [textOf(el)].filter(Boolean)
    if (texts.length === 0) return
    if (texts.length === 1) {
      out.push(paragraph(texts[0], { size: SIZE_SMALL, spacing: { before: 0, after: 140, line: 300 } }))
      return
    }
    out.push(
      new Paragraph({
        spacing: { before: 0, after: 140, line: 300 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          run(texts[0], { size: SIZE_SMALL }),
          new TextRun({ children: [new Tab()] }),
          run(texts.slice(1).join('　'), { size: SIZE_SMALL }),
        ],
      }),
    )
    return
  }

  if (has('doc-h2')) {
    out.push(
      paragraph(textOf(el), {
        bold: true,
        size: SIZE_H2,
        spacing: { before: 280, after: 100, line: 340 },
      }),
    )
    return
  }

  if (tag === 'ul') {
    Array.from(el.children).forEach((li) => {
      const text = listItemText(li)
      if (!text) return
      out.push(
        paragraph(text, {
          indent: { left: INDENT_LIST, hanging: 0 },
          spacing: { before: 40, after: 40, line: 340 },
        }),
      )
    })
    return
  }

  if (tag === 'ol') {
    Array.from(el.children).forEach((li, index) => {
      const text = textOf(li)
      if (!text) return
      out.push(
        paragraph(`${index + 1}. ${text}`, {
          indent: { left: INDENT_LIST + 120, hanging: 240 },
          spacing: { before: 40, after: 40, line: 340 },
        }),
      )
    })
    return
  }

  if (tag === 'table') {
    const table = convertTable(el)
    if (table) {
      out.push(new Paragraph({ children: [run('')], spacing: { before: 60, after: 0 } }))
      out.push(table)
      out.push(new Paragraph({ children: [run('')], spacing: { before: 0, after: 60 } }))
    }
    return
  }

  if (has('doc-quote')) {
    Array.from(el.children).forEach((child) => {
      const text = textOf(child)
      if (!text) return
      out.push(
        paragraph(text, {
          indent: { left: INDENT_LIST + 200 },
          spacing: { before: 40, after: 40, line: 340 },
        }),
      )
    })
    return
  }

  if (has('doc-sign')) {
    convertSignBlock(el, out)
    return
  }

  if (has('doc-note')) {
    const text = textOf(el)
    if (text) out.push(paragraph(text, { size: SIZE_NOTE, color: COLOR_MUTED }))
    return
  }

  if (tag === 'p' || has('doc-p') || has('doc-empty')) {
    const text = textOf(el)
    if (!text) return
    const flat = has('doc-p-flat') || has('doc-empty')
    out.push(
      paragraph(text, {
        alignment: has('doc-empty') ? AlignmentType.CENTER : AlignmentType.BOTH,
        indent: flat ? undefined : { firstLine: INDENT_FIRST_LINE },
        bold: has('doc-label'),
        spacing: { before: 60, after: 60, line: 340 },
      }),
    )
    return
  }

  // 兜底：容器元素递归，叶子元素输出为普通段落。
  if (el.children && el.children.length > 0) {
    Array.from(el.children).forEach((child) => convertElement(child, out))
    return
  }
  const text = textOf(el)
  if (text) out.push(paragraph(text))
}

/**
 * 将文档根元素转换为 docx 元素数组。
 * @param {Element} rootElement `.doc` 或其容器
 * @returns {Array}
 */
export function buildDocxBlocks(rootElement) {
  const out = []
  if (!rootElement) return out
  const root =
    typeof rootElement.querySelector === 'function' && !rootElement.classList?.contains('doc')
      ? rootElement.querySelector('.doc') || rootElement
      : rootElement
  Array.from(root.children || []).forEach((child) => convertElement(child, out))
  if (out.length === 0) out.push(paragraph('（文档内容为空）'))
  return out
}

/* =========================================================
 * 四、导出入口
 * ========================================================= */

/**
 * 触发浏览器自动下载（隐藏 `<a download>` + 程序化 click）。
 * @param {string} url
 * @param {string} fileName
 * @returns {boolean}
 */
function triggerDownload(url, fileName) {
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return true
  } catch {
    return false
  }
}

/**
 * 判断当前页面是否处于 iframe 中（WorkBuddy 内置预览面板即为 sandbox iframe）。
 * @returns {boolean}
 */
function isEmbeddedInIframe() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * 尝试在新标签页打开 blob URL（新标签为顶层窗口，用户可「另存为」）。
 * @param {string} url
 * @returns {boolean}
 */
function openInNewTab(url) {
  try {
    const opened = window.open(url, '_blank', 'noopener')
    return Boolean(opened)
  } catch {
    return false
  }
}

/**
 * 释放由 exportDocxFromElement 创建的 object URL。
 * 调用方应在「发起新一次导出前」与「组件卸载时」调用，避免内存泄漏。
 * @param {string} url
 * @returns {void}
 */
export function revokeBlobUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* 忽略：URL 可能已被释放 */
  }
}

/**
 * @typedef {object} DocxExportResult
 * @property {string} fileName 实际使用的文件名（含 .docx 后缀）
 * @property {string} blobUrl 生成文件的 object URL（**未** revoke，供页面渲染可见下载链接）
 * @property {number} blobSize 文件字节数
 * @property {boolean} autoDownloadTried 是否已尝试自动下载
 * @property {boolean} newTabOpened 新标签回退是否成功打开
 */

/**
 * 由已渲染的预览 DOM 生成 .docx 文件，并以「三重保险」方式交付给用户：
 *  1. 自动下载（triggerDownload）—— 普通浏览器直接落盘；
 *  2. 新标签回退（openInNewTab）—— 仅在 iframe 环境下尝试；
 *  3. 返回 blobUrl，由页面渲染成**可见的下载链接**（用户手势点击，不会被静默拦截）。
 *
 * @param {Element} rootElement 预览容器（`.doc-page` 或 `.doc`）
 * @param {string} fileName 输出文件名（含 .docx 后缀）
 * @returns {Promise<DocxExportResult>} 导出结果
 */
export async function exportDocxFromElement(rootElement, fileName) {
  if (!rootElement) {
    throw new Error('未找到文档预览内容，无法导出 Word。')
  }
  const safeName = sanitizeFileName(fileName) || '未命名.docx'
  const children = buildDocxBlocks(rootElement)

  const document_ = new Document({
    creator: 'Claw CSMS 合规文档模板库',
    description: '港股上市公司风险管理及内部监控合规文档',
    title: safeName.replace(/\.docx$/i, ''),
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE_BODY, color: COLOR_TEXT },
          paragraph: { spacing: { before: 40, after: 40, line: 340 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1021, bottom: 1134, left: 1021 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(document_)
  const blobUrl = URL.createObjectURL(blob)

  // 1) 自动下载：普通浏览器有效；sandbox iframe 下会被静默拦截（不抛错）
  const autoDownloadTried = triggerDownload(blobUrl, safeName)

  // 2) 新标签回退：仅在 iframe 内尝试，被弹窗策略拦截时静默失败
  const newTabOpened = isEmbeddedInIframe() ? openInNewTab(blobUrl) : false

  // 3) blobUrl 交回页面渲染可见下载链接；此处**刻意不 revoke**
  return {
    fileName: safeName,
    blobUrl,
    blobSize: typeof blob.size === 'number' ? blob.size : 0,
    autoDownloadTried,
    newTabOpened,
  }
}

export default exportDocxFromElement
