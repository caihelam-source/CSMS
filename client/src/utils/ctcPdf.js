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

  // 只在最后一页右下角加盖声明
  const page = pages[pages.length - 1]
  const { width } = page.getSize()

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const boxWidth = 320
  const boxHeight = 140
  const margin = 24
  const x = width - boxWidth - margin
  const y = margin

  // 白色半透明背景 + 黑色边框
  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })

  let cursorY = y + boxHeight - 14
  const lineHeight = 14
  const leftPad = 10

  const drawText = (text, opts = {}) => {
    const size = opts.size || 8
    const f = opts.bold ? fontBold : font
    page.drawText(text, { x: x + leftPad, y: cursorY, size, font: f, color: rgb(0, 0, 0) })
    cursorY -= lineHeight
  }

  drawText('CERTIFIED TRUE COPY', { bold: true, size: 10 })
  cursorY -= 2
  drawText('I, the undersigned, do hereby certify that I have examined')
  drawText('this document with its original and that the same is a true')
  drawText('and complete copy of the original.')
  cursorY -= 4
  drawText('Dated this _____ day of __________, 20____')
  cursorY -= 4
  drawText('_________________________________')
  drawText('Signature')
  cursorY -= 4

  if (fullName) drawText(fullName)
  if (professionalTitle) drawText(professionalTitle)
  if (membershipNo) drawText(membershipNo)

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
