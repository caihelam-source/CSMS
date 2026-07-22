import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * 在 PDF 右下角生成 CTC（Certified True Copy）声明区块。
 * @param {ArrayBuffer} pdfBytes - 原始 PDF 文件内容
 * @param {Object} meta
 * @param {string} meta.fullName
 * @param {string} meta.professionalTitle
 * @param {string} meta.membershipNo
 * @returns {Promise<Uint8Array>} 新的 PDF bytes
 */
export async function generateCtcPdf(pdfBytes, { fullName, professionalTitle, membershipNo } = {}) {
  const doc = await PDFDocument.load(pdfBytes)
  const pages = doc.getPages()
  if (pages.length === 0) throw new Error('PDF has no pages')

  // 在第一页右下角加盖声明
  const page = pages[0]
  const { width } = page.getSize()

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const boxWidth = 340
  const boxHeight = 200
  const margin = 24
  const x = width - boxWidth - margin
  const y = margin

  // 白色不透明背景 + 黑色边框，确保盖住底层正文
  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })

  const leftPad = 10
  // 从顶部内衬开始往下绘制
  let cursorY = y + boxHeight - 12

  const drawText = (text, opts = {}) => {
    const size = opts.size || 8
    const f = opts.bold ? fontBold : font
    const dy = opts.dy || (opts.size || 8) + 2
    page.drawText(text, { x: x + leftPad, y: cursorY, size, font: f, color: rgb(0, 0, 0) })
    cursorY -= dy
  }

  drawText('CERTIFIED TRUE COPY', { bold: true, size: 10, dy: 16 })
  drawText('I, the undersigned, do hereby certify that I have examined')
  drawText('this document with its original and that the same is a true')
  drawText('and complete copy of the original.')
  cursorY -= 6
  drawText('Dated this _____ day of __________, 20____')
  cursorY -= 14 // 签名预留空间
  drawText('________________________________________')
  drawText('Signature')
  cursorY -= 22 // 加大签字留白

  if (fullName) drawText(fullName)
  if (professionalTitle || membershipNo) {
    const combined = [professionalTitle, membershipNo].filter(Boolean).join(' / ')
    drawText(combined)
  }

  return await doc.save()
}

/**
 * 从 file 对象读取 ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
