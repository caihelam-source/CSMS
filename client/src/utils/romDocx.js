// ROM (Register of Members) — 真正的 .docx 生成器
// 支持地区：HK（8列简洁表）/ BVI（19列嵌套 Shares Acquired/Transferred）
// 支持用途：standard（无签字栏）/ bank / audit（加银行/审计专用签字栏）
// 中文宋体（SimSun），按地区/用途自适应页脚与签字栏。

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Footer,
  PageNumber,
  PageOrientation,
} from 'docx';
import { Packer } from 'docx';
import {
  FONT, thin, fullBorders,
  run, headerCell, dataCell, fmtDate, inferRegion, buildSignatureBlock,
} from './docxCommon.js';

// ---- 列宽（twips，A4 横向可用约 15200）----
const COLS = {
  name: 1300,
  address: 1700,
  dateEntry: 700,
  dateCeasing: 700,
  acqDate: 600, acqCert: 800, acqFrom: 600, acqTo: 600, acqShares: 750, acqConsid: 850,
  trDeed: 850, trCert: 800, trFrom: 600, trTo: 600, trShares: 750, trConsid: 850,
  total: 750, remarks: 750, entryBy: 650,
};
const ACQ_W = COLS.acqDate + COLS.acqCert + COLS.acqFrom + COLS.acqTo + COLS.acqShares + COLS.acqConsid;
const TR_W = COLS.trDeed + COLS.trCert + COLS.trFrom + COLS.trTo + COLS.trShares + COLS.trConsid;
const COLUMN_WIDTHS = [
  COLS.name, COLS.address, COLS.dateEntry, COLS.dateCeasing,
  COLS.acqDate, COLS.acqCert, COLS.acqFrom, COLS.acqTo, COLS.acqShares, COLS.acqConsid,
  COLS.trDeed, COLS.trCert, COLS.trFrom, COLS.trTo, COLS.trShares, COLS.trConsid,
  COLS.total, COLS.remarks, COLS.entryBy,
];

// 简单解析成员显示信息
function resolveMember(l) {
  const ref = l.link || l.personnelRef || l.companyRef || {};
  const name = l.name || ref.name || '';
  const cnName = l.nameChinese || ref.nameChinese || '';
  const address =
    ref.address && (ref.address.street || ref.address.city || ref.address.country)
      ? [ref.address.street, ref.address.city, ref.address.country].filter(Boolean).join(', ')
      : l.address || ref.registeredAddress || '';
  return { name, cnName, address };
}

// 从 links 提取现任公司秘书（Registered Agent）
function resolveSecretary(company) {
  if (!company || !Array.isArray(company.links)) return null;
  const sec = company.links.find((l) => Array.isArray(l.roles) && l.roles.includes('secretary'));
  if (!sec) return null;
  const ref = sec.link || sec.personnelRef || {};
  const name = sec.name || ref.name || '';
  let addr = '';
  if (sec.address && (sec.address.street || sec.address.city || sec.address.country)) {
    addr = [sec.address.street, sec.address.city, sec.address.country].filter(Boolean).join(', ');
  } else if (ref.address && (ref.address.street || ref.address.city || ref.address.country)) {
    addr = [ref.address.street, ref.address.city, ref.address.country].filter(Boolean).join(', ');
  }
  addr = addr || sec.registeredAddress || ref.registeredAddress || '';
  return { name, address: addr };
}

// ===== 页头（地区相关）=====
function buildHeader(company, region, placeholderMode) {
  const titleParas = [
    new Paragraph({
      alignment: 'center',
      spacing: { after: 40 },
      children: [run((company.name || '[COMPANY_NAME_EN]').toUpperCase(), { bold: true, size: 28 })],
    }),
  ];
  if (company.nameChinese || placeholderMode) {
    titleParas.push(
      new Paragraph({
        alignment: 'center',
        spacing: { after: 20 },
        children: [run(company.nameChinese || '[COMPANY_NAME_CN]', { size: 24 })],
      })
    );
  }

  const sysName = company.systemName || 'Claw Company Secretary System';
  const genDate = company.generationDate || fmtDate(new Date()) || '[GENERATION_DATE]';

  if (region === 'HK') {
    const issued = placeholderMode ? '[TOTAL_ISSUED_SHARES]' : (company.shareCapital?.issued || '[TOTAL_ISSUED_SHARES]');
    const par = placeholderMode ? '[PAR_VALUE]' : ((company.shareCapital && company.shareCapital.currency) || company.shareCurrency?.currency || '[PAR_VALUE]');
    titleParas.push(
      new Paragraph({
        alignment: 'left',
        spacing: { after: 60 },
        children: [
          run('Company No.: ', { bold: true, size: 20 }),
          run(company.registrationNumber || '[COMPANY_NUMBER]', { bold: true, size: 20 }),
          run('   |   Jurisdiction: Hong Kong', { size: 20 }),
          run(`   |   Issued Shares: ${issued}`, { size: 20 }),
          run(`   |   Share Value: ${par} Per Share`, { size: 20 }),
          run(`   |   Date: ${genDate}`, { size: 20 }),
        ],
      })
    );
  } else {
    titleParas.push(
      new Paragraph({
        alignment: 'left',
        spacing: { after: 60 },
        children: [
          run('Company No.: ', { bold: true, size: 20 }),
          run(company.registrationNumber || '[COMPANY_NUMBER]', { bold: true, size: 20 }),
          run('   |   Jurisdiction: British Virgin Islands', { size: 20 }),
          run(`   |   Date: ${genDate}`, { size: 20 }),
        ],
      })
    );
  }
  return titleParas;
}

// ===== HK ROM 表格（8 列）=====
const HK_ROM_HEADERS = ['Date Entered', 'Member Name', 'Address', 'Jurisdiction', 'No. of Shares', 'Share Type', 'Shareholding %', 'Date Ceased'];
const HK_ROM_WIDTHS = [1100, 2200, 2600, 1300, 1300, 1300, 1300, 1300];

function buildHkRomTable(company, members, placeholderMode) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: HK_ROM_HEADERS.map((h, i) => headerCell(h, { width: HK_ROM_WIDTHS[i] })),
  });
  const rows = members.map((l) => {
    const m = l._placeholder ? l : resolveMember(l);
    const entered = l._placeholder ? l.appointedDate : fmtDate(l.appointedDate);
    const ceased = l._placeholder ? '' : fmtDate(l.ceasedDate);
    const shares = l._placeholder ? l.shares : String(l.shares || 0);
    const shareType = l._placeholder ? '[SHARE_TYPE]' : (l.shareType || 'Ordinary');
    const juris = l._placeholder ? '[JURISDICTION]' : (m.address?.split(',').pop()?.trim() || company.jurisdiction || 'Hong Kong');
    const pct = l._placeholder ? '[%]' : (company.shareCapital?.paidUp && l.shares ? ((l.shares / company.shareCapital.paidUp) * 100).toFixed(2) + '%' : '-');
    const nameText = m.cnName ? `${m.name}\n${m.cnName}` : m.name;
    return new TableRow({
      children: [
        dataCell(entered, { width: HK_ROM_WIDTHS[0], align: 'center' }),
        dataCell(nameText, { width: HK_ROM_WIDTHS[1] }),
        dataCell(m.address, { width: HK_ROM_WIDTHS[2] }),
        dataCell(juris, { width: HK_ROM_WIDTHS[3], align: 'center' }),
        dataCell(shares, { width: HK_ROM_WIDTHS[4], align: 'center' }),
        dataCell(shareType, { width: HK_ROM_WIDTHS[5], align: 'center' }),
        dataCell(pct, { width: HK_ROM_WIDTHS[6], align: 'center' }),
        dataCell(ceased, { width: HK_ROM_WIDTHS[7], align: 'center' }),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: 'pct' },
    columnWidths: HK_ROM_WIDTHS,
    borders: fullBorders(thin),
    rows: [headerRow, ...rows],
  });
}

// ===== BVI ROM 表格（19 列嵌套）=====
function buildBviRomTable(company, members, placeholderMode) {
  const headerRow1 = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Date Entered', { width: COLS.dateEntry, rowSpan: 2 }),
      headerCell('Member Name', { width: COLS.name, rowSpan: 2 }),
      headerCell('Address', { width: COLS.address, rowSpan: 2 }),
      headerCell('Jurisdiction', { width: COLS.dateCeasing, rowSpan: 2 }),
      headerCell('Shares Acquired', { width: ACQ_W, columnSpan: 6 }),
      headerCell('Shares Transferred', { width: TR_W, columnSpan: 6 }),
      headerCell('Date Ceased', { width: COLS.total, rowSpan: 2 }),
      headerCell('Entry Made By', { width: COLS.entryBy, rowSpan: 2 }),
    ],
  });
  const headerRow2 = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Date', { width: COLS.acqDate }),
      headerCell('Certificate No.', { width: COLS.acqCert }),
      headerCell('Distinctive Nos.', { width: COLS.acqFrom + COLS.acqTo, columnSpan: 2 }),
      headerCell('Consideration Paid', { width: COLS.acqShares }),
      headerCell('Date of Payment', { width: COLS.acqConsid }),
      headerCell('Total Shares Held', { width: COLS.trDeed }),
      headerCell('Certificate No.', { width: COLS.trCert }),
      headerCell('Distinctive Nos.', { width: COLS.trFrom + COLS.trTo, columnSpan: 2 }),
      headerCell('Date of Transfer', { width: COLS.trShares }),
    ],
  });
  const rows = members.map((l) => {
    const m = l._placeholder ? l : resolveMember(l);
    const entered = l._placeholder ? l.appointedDate : fmtDate(l.appointedDate);
    const ceased = l._placeholder ? '' : fmtDate(l.ceasedDate);
    const cert = l._placeholder ? l.certNo : (l.certificateNumber || l.certNo || '');
    const shares = l._placeholder ? l.shares : String(l.shares || 0);
    const consid = l._placeholder ? l.consideration : (l.consideration || '');
    const nameText = m.cnName ? `${m.name}\n${m.cnName}` : m.name;
    return new TableRow({
      children: [
        dataCell(entered, { width: COLS.dateEntry, align: 'center' }),
        dataCell(nameText, { width: COLS.name }),
        dataCell(m.address, { width: COLS.address }),
        dataCell(l._placeholder ? '[JURISDICTION]' : (m.address?.split(',').pop()?.trim() || company.jurisdiction || 'BVI'), { width: COLS.dateCeasing, align: 'center' }),
        dataCell(entered, { width: COLS.acqDate, align: 'center' }),
        dataCell(cert, { width: COLS.acqCert, align: 'center' }),
        dataCell(l._placeholder ? '1' : '1', { width: COLS.acqFrom, align: 'center' }),
        dataCell(l._placeholder ? '[DIST_FROM]' : shares, { width: COLS.acqTo, align: 'center' }),
        dataCell(l._placeholder ? l.shares : shares, { width: COLS.acqShares, align: 'center' }),
        dataCell(consid, { width: COLS.acqConsid, align: 'center' }),
        dataCell(l._placeholder ? l.shares : shares, { width: COLS.trDeed, align: 'center' }),
        dataCell('', { width: COLS.trCert, align: 'center' }),
        dataCell('', { width: COLS.trFrom, align: 'center' }),
        dataCell('', { width: COLS.trTo, align: 'center' }),
        dataCell('', { width: COLS.trShares, align: 'center' }),
        dataCell(ceased, { width: COLS.total, align: 'center' }),
        dataCell(l._placeholder ? 'Secretary' : (l.entryMadeBy || ''), { width: COLS.entryBy, align: 'center' }),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: 'pct' },
    columnWidths: COLUMN_WIDTHS,
    borders: fullBorders(thin),
    rows: [headerRow1, headerRow2, ...rows],
  });
}

// ===== 页脚（地区相关）=====
function buildFooter(company, region) {
  const sysName = company.systemName || 'Claw Company Secretary System';
  const genDate = company.generationDate || fmtDate(new Date()) || '[GENERATION_DATE]';
  const currency = (company.shareCapital && company.shareCapital.currency) || company.shareCurrency?.currency || 'USD';

  if (region === 'HK') {
    return new Footer({
      children: [
        new Paragraph({
          alignment: 'right',
          spacing: { before: 80 },
          border: { top: thin },
          children: [run(`Generated by ${sysName} on ${genDate}`, { size: 14, color: '808080' })],
        }),
      ],
    });
  }
  // BVI
  return new Footer({
    children: [
      new Paragraph({
        alignment: 'left',
        spacing: { before: 80 },
        border: { top: thin },
        children: [run('[BVI_LEGAL_NOTE: insert BVI Business Companies Act 2018 statutory note verbatim from ROD.xlsx reference]', { size: 14, color: '808080' })],
      }),
      new Paragraph({
        alignment: 'right',
        spacing: { before: 20 },
        children: [
          run('Page No.: ', { size: 14 }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, font: FONT }),
          run(`   |   Class of Share: Ordinary   |   Par Value Per Share: ${currency} 1.00   |   BVI 2018`, { size: 14 }),
        ],
      }),
    ],
  });
}

// ===== 主构造 =====
export function buildRomDocument(company = {}, shareholdersLinks = [], opts = {}) {
  const region = opts.region || inferRegion(company);
  const purpose = opts.purpose || 'standard';
  const placeholderMode = !!opts.placeholder;
  const withSignature = purpose === 'bank' || purpose === 'audit';

  let members = shareholdersLinks;
  if (placeholderMode || !members || members.length === 0) {
    const sample = {
      name: '[MEMBER_NAME_EN]', cnName: '[MEMBER_NAME_CN]', address: '[ADDRESS]',
      appointedDate: '[DATE_ENTERED]', certNo: '[CERT_NO]', shares: '[SHARES_HELD]',
      consideration: '[CONSIDERATION]', _placeholder: true,
    };
    members = [sample];
  }

  const headerParas = buildHeader(company, region, placeholderMode);
  const table = region === 'HK'
    ? buildHkRomTable(company, members, placeholderMode)
    : buildBviRomTable(company, members, placeholderMode);

  const children = [...headerParas, table];
  if (withSignature) children.push(buildSignatureBlock(region, 'ROM'));

  return new Document({
    creator: 'Claw Company Secretary System',
    title: `Register of Members - ${company.name || ''}`,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 16 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: region === 'BVI' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 907, right: 907 },
          },
        },
        footers: { default: buildFooter(company, region) },
        children,
      },
    ],
  });
}

export async function buildRomDocxBlob(company, shareholdersLinks, opts) {
  return Packer.toBlob(buildRomDocument(company, shareholdersLinks, opts));
}
export async function buildRomBuffer(company, shareholdersLinks, opts) {
  return Packer.toBuffer(buildRomDocument(company, shareholdersLinks, opts));
}
