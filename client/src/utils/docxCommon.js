// docxCommon.js — ROM / ROD 生成器共享工具
// 字体：英文 Times New Roman，中文宋体（SimSun）
// 含：边框/单元格/日期格式化/银行审计专用签字栏（三行结构）

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
  AlignmentType,
  ShadingType,
} from 'docx';

// 字体：拉丁用 Times New Roman，中文用宋体（SimSun）
export const FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' };

export const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
export const thick = { style: BorderStyle.SINGLE, size: 12, color: '000000' };

export const allBorders = (b) => ({ top: b, left: b, bottom: b, right: b });
export const fullBorders = (b) => ({
  top: b, left: b, bottom: b, right: b, insideHorizontal: b, insideVertical: b,
});

export function run(text, { bold = false, size = 16, font } = {}) {
  return new TextRun({ text: text ?? '', bold, size, font: font || FONT });
}

export function headerCell(text, { width, columnSpan, rowSpan, align = AlignmentType.CENTER, size = 16 } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan,
    rowSpan,
    borders: allBorders(thin),
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 20, after: 20, line: 200 },
        children: [run(text, { bold: true, size })],
      }),
    ],
  });
}

export function dataCell(text, { width, columnSpan, align = AlignmentType.LEFT, size = 16, bold = false } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan,
    borders: allBorders(thin),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 10, after: 10, line: 200 },
        children: [run(text, { size, bold })],
      }),
    ],
  });
}

export function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// 从公司对象推断地区：BVI / 默认 HK
// inferRegion 已提取到 regionHelpers.js（轻量，无 docx 依赖）
// 此处 re-export 保持 romDocx/rodDocx 的既有导入路径不变
export { inferRegion } from './regionHelpers';

// 无边框常量（用于签字栏等不需要框线的区域）
const noBorder = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' };
const noBorders = () => ({ top: noBorder, left: noBorder, bottom: noBorder, right: noBorder });

// 银行 / 审计专用签字栏（位于表格下方，无边框、与主表等宽）
// region: 'HK' | 'BVI'；docType: 'ROM' | 'ROD'
export function buildSignatureBlock(region, docType) {
  const declarMap = {
    HK_ROM: 'Declaration: I confirm that the shareholding information set out above is true and accurate. / 声明：本人确认上述股权信息真实准确。',
    BVI_ROM: 'Declaration: I confirm that the shareholding information complies with the BVI Business Companies Act 2018. / 声明：本人确认上述股权信息符合《2018年BVI商业公司法》。',
    HK_ROD: 'Declaration: I confirm that the above register of directors is true and accurate. / 声明：本人确认上述董事名册真实准确。',
    BVI_ROD: 'Declaration: I confirm that the above register of directors complies with the BVI Business Companies Act 2018. / 声明：本人确认上述董事名册符合《2018年BVI商业公司法》。',
  };
  const declaration = declarMap[`${region}_${docType}`] || declarMap[`${region}_ROM`] || '';
  // 签字横线（足够长，留足手写空间）
  const sigLine = '________________________________________';

  // 第 1 行：声明（无边框，全宽）
  const row1 = new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        borders: noBorders(),
        children: [
          new Paragraph({
            spacing: { before: 200, after: 60, line: 240 },
            children: [run(declaration, { size: 15 })],
          }),
        ],
      }),
    ],
  });

  // 签字行工厂（左边标签+长横线，右边日期+横线，均无边框）
  const signRow = (leftLabel) => new TableRow({
    children: [
      new TableCell({
        borders: noBorders(),
        children: [
          new Paragraph({
            spacing: { before: 120, after: 40, line: 280 },
            children: [run(`${leftLabel} `, { size: 15 }), run(sigLine, { size: 15 })],
          }),
        ],
      }),
      new TableCell({
        borders: noBorders(),
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120, after: 40, line: 280 },
            children: [run('Date / 日期： ', { size: 15 }), run(sigLine, { size: 15 })],
          }),
        ],
      }),
    ],
  });

  // 第 2 行：董事签字 + 日期
  const row2 = signRow("Director's Signature / 董事签字");

  // 第 3 行：根据地区/类型不同
  let row3;
  if (region === 'BVI' && docType === 'ROM') {
    row3 = new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          borders: noBorders(),
          children: [
            new Paragraph({
              spacing: { before: 80, after: 160, line: 280 },
              children: [run('Registered Agent Confirmation / 注册代理人确认： ', { size: 15 }), run(sigLine, { size: 15 })],
            }),
          ],
        }),
      ],
    });
  } else {
    row3 = new TableRow({
      children: [
        new TableCell({
          borders: noBorders(),
          children: [
            new Paragraph({
              spacing: { before: 80, after: 160, line: 280 },
              children: [run('Witness Signature / 见证人签字： ', { size: 15 }), run(sigLine, { size: 15 })],
            }),
          ],
        }),
        new TableCell({
          borders: noBorders(),
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 80, after: 160, line: 280 },
              children: [run('Company Chop / 公司盖章位：（预留盖章位）', { size: 14, color: '888888' })],
            }),
          ],
        }),
      ],
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5000, 5000],     // 左右均分，等宽于主表
    borders: noBorders(),           // 表格外框也去掉
    rows: [row1, row2, row3],
  });
}
