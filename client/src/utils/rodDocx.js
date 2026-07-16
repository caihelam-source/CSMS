// ROD (Register of Directors) — 真正的 .docx 生成器
// 支持地区：HK（7列简洁表）/ BVI（4表：个人董事ORIGINAL/COPY + 公司董事ORIGINAL/COPY，每表独立分页）
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
  Header,
  PageNumber,
  PageOrientation,
} from 'docx';
import { Packer } from 'docx';
import {
  FONT, thin, fullBorders,
  run, headerCell, dataCell, fmtDate, inferRegion, buildSignatureBlock,
} from './docxCommon.js';

const HK_ROD_HEADERS = ['Date Appointed', 'Full Name', 'NRIC/Passport No.', 'Nationality', 'Address for Service', 'Role', 'Date Ceased'];
const HK_ROD_WIDTHS = [1100, 2000, 1500, 1200, 2000, 1200, 1100];

const BVI_IND_HEADERS = [
  'Date of Appointment', 'Full Name', 'Former Name (if any)', 'Date and Place of Birth',
  'Nationality and ID/PPT No.', 'Address for the service of documents',
  'Usual residential address (if different)', 'Occupation', 'Date of Cessation', 'Entry Made By',
];
const BVI_IND_WIDTHS = [800, 1300, 900, 1200, 1100, 1400, 1100, 800, 800, 700];

const BVI_CORP_HEADERS = [
  'Date of Appointment', 'Corporate Name', 'Corporate Number', 'Date of Incorporation/Registration',
  'Place of Incorporation/Registration', 'Registered Office or Principal Office Address',
  'Address (if BVI-incorporated, state corp number only)', 'Date of Cessation', 'Entry Made By',
];
const BVI_CORP_WIDTHS = [800, 1400, 1000, 1100, 1200, 1500, 1200, 800, 700];

// 解析董事 link → 字段
function resolveDirector(l) {
  const ref = l.link || l.personnelRef || l.companyRef || {};
  const name = l.name || ref.name || '';
  const nric = l.nric || ref.nric || '';
  const nationality = l.nationality || ref.nationality || '';
  const address =
    ref.address && (ref.address.street || ref.address.city || ref.address.country)
      ? [ref.address.street, ref.address.city, ref.address.country].filter(Boolean).join(', ')
      : l.address || ref.registeredAddress || '';
  return { name, nric, nationality, address, ref };
}

function roleLabel(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'Director';
  return roles
    .map((r) => ({ director: 'Director', alternate_director: 'Alternate Director', shadow_director: 'Shadow Director' }[r] || r))
    .join(', ');
}

// ===== HK ROD =====
function buildHkRod(company, directors, placeholderMode, withSignature) {
  const sysName = company.systemName || 'Claw Company Secretary System';
  const genDate = company.generationDate || fmtDate(new Date()) || '[GENERATION_DATE]';

  const headerParas = [
    new Paragraph({ alignment: 'center', spacing: { after: 40 }, children: [run((company.name || '[COMPANY_NAME_EN]').toUpperCase(), { bold: true, size: 28 })] }),
  ];
  if (company.nameChinese || placeholderMode) {
    headerParas.push(new Paragraph({ alignment: 'center', spacing: { after: 20 }, children: [run(company.nameChinese || '[COMPANY_NAME_CN]', { size: 24 })] }));
  }
  headerParas.push(
    new Paragraph({
      alignment: 'left', spacing: { after: 60 },
      children: [
        run('Company No.: ', { bold: true, size: 20 }), run(company.registrationNumber || '[COMPANY_NUMBER]', { bold: true, size: 20 }),
        run('   |   Jurisdiction: Hong Kong', { size: 20 }), run(`   |   Date: ${genDate}`, { size: 20 }),
      ],
    })
  );
  headerParas.push(new Paragraph({ alignment: 'center', spacing: { before: 40, after: 40 }, border: { top: thin, bottom: thin }, children: [run('REGISTER OF DIRECTORS', { bold: true, size: 26 })] }));

  const headerRow = new TableRow({ tableHeader: true, children: HK_ROD_HEADERS.map((h, i) => headerCell(h, { width: HK_ROD_WIDTHS[i] })) });
  const rows = directors.map((l) => {
    const d = l._placeholder ? l : resolveDirector(l);
    const appointed = l._placeholder ? l.appointedDate : fmtDate(l.appointedDate);
    const ceased = l._placeholder ? '' : fmtDate(l.ceasedDate) || 'Present';
    const nric = l._placeholder ? '[NRIC/PASSPORT]' : d.nric;
    const nationality = l._placeholder ? '[NATIONALITY]' : d.nationality;
    const address = l._placeholder ? '[ADDRESS_FOR_SERVICE]' : d.address;
    const role = l._placeholder ? 'Director' : roleLabel(l.roles);
    const name = l._placeholder ? '[FULL_NAME]' : d.name;
    return new TableRow({
      children: [
        dataCell(appointed, { width: HK_ROD_WIDTHS[0], align: 'center' }),
        dataCell(name, { width: HK_ROD_WIDTHS[1] }),
        dataCell(nric, { width: HK_ROD_WIDTHS[2], align: 'center' }),
        dataCell(nationality, { width: HK_ROD_WIDTHS[3], align: 'center' }),
        dataCell(address, { width: HK_ROD_WIDTHS[4] }),
        dataCell(role, { width: HK_ROD_WIDTHS[5], align: 'center' }),
        dataCell(ceased, { width: HK_ROD_WIDTHS[6], align: 'center' }),
      ],
    });
  });

  const table = new Table({ width: { size: 100, type: 'pct' }, columnWidths: HK_ROD_WIDTHS, borders: fullBorders(thin), rows: [headerRow, ...rows] });

  const footer = new Footer({
    children: [
      new Paragraph({ alignment: 'right', spacing: { before: 80 }, border: { top: thin }, children: [run('This register complies with the Companies Ordinance (Cap. 622) of Hong Kong', { size: 14, color: '808080' })] }),
      new Paragraph({ alignment: 'right', spacing: { before: 10 }, children: [run(`Generated by ${sysName}`, { size: 14, color: '808080' }), run('     Page ', { size: 14 }), new TextRun({ children: [PageNumber.CURRENT], size: 14, font: FONT })] }),
    ],
  });

  const children = [...headerParas, table];
  if (withSignature) children.push(buildSignatureBlock('HK', 'ROD'));

  return {
    properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 720, bottom: 720, left: 907, right: 907 } } },
    footers: { default: footer },
    children,
  };
}

// ===== BVI ROD（4 表）=====
function buildBviRodTable(title, headers, widths, rows) {
  const titlePara = new Paragraph({ alignment: 'center', spacing: { before: 40, after: 20 }, border: { bottom: thin }, children: [run(title, { bold: true, size: 22 })] });
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, { width: widths[i], size: 14 })) });
  const dataRows = rows.map((cells) => new TableRow({ children: cells.map((c, i) => dataCell(c, { width: widths[i], align: 'center', size: 14 })) }));
  const table = new Table({ width: { size: 100, type: 'pct' }, columnWidths: widths, borders: fullBorders(thin), rows: [headerRow, ...dataRows] });
  return [titlePara, table];
}

function buildBviRod(company, directors, placeholderMode, withSignature) {
  const sysName = company.systemName || 'Claw Company Secretary System';
  const individuals = placeholderMode ? [{ _placeholder: true, kind: 'ind' }] : directors.filter((l) => (l.linkModel || l.link?.linkModel) !== 'Company' && !l.corporateNumber);
  const corporates = placeholderMode ? [{ _placeholder: true, kind: 'corp' }] : directors.filter((l) => (l.linkModel || l.link?.linkModel) === 'Company' || l.corporateNumber);

  const indRows = individuals.map((l) => {
    if (l._placeholder) return ['[DATE_APPOINTED]', '[FULL_NAME]', '[FORMER_NAME]', '[DATE & PLACE OF BIRTH]', '[NATIONALITY & ID/PPT]', '[ADDRESS_FOR_SERVICE]', '[RESIDENTIAL_ADDR]', '[OCCUPATION]', '[DATE_CEASED]', '[ENTRY_MADE_BY]'];
    const d = resolveDirector(l);
    const dob = [l.dateOfBirth, l.placeOfBirth].filter(Boolean).join(' ');
    return [
      fmtDate(l.appointedDate), d.name, l.formerName || '', dob,
      [d.nationality, d.nric].filter(Boolean).join(' '), d.address,
      l.residentialAddress || '', l.occupation || '', fmtDate(l.ceasedDate) || '', l.entryMadeBy || '',
    ];
  });
  const corpRows = corporates.map((l) => {
    if (l._placeholder) return ['[DATE_APPOINTED]', '[CORPORATE_NAME]', '[CORP_NO]', '[DATE_INCORP]', '[PLACE_INCORP]', '[REG_OFFICE]', '[ADDRESS]', '[DATE_CEASED]', '[ENTRY_MADE_BY]'];
    const d = resolveDirector(l);
    return [
      fmtDate(l.appointedDate), d.name, l.corporateNumber || d.ref.registrationNumber || '',
      l.incorporatedDate || '', l.incorporationPlace || '', l.registeredOffice || d.address,
      d.address || '', fmtDate(l.ceasedDate) || '', l.entryMadeBy || '',
    ];
  });

  const headerText = `${company.name || '[COMPANY_NAME_EN]'} (${company.nameChinese || '[COMPANY_NAME_CN]'})   |   Company No.: ${company.registrationNumber || '[COMPANY_NUMBER]'}`;
  const makeHeader = (pageNo) => new Header({ children: [new Paragraph({ alignment: 'center', spacing: { after: 40 }, children: [run(headerText + `   |   Page No.: `, { size: 16, bold: true }), new TextRun({ children: [pageNo], size: 16, bold: true, font: FONT })] })] });

  const makeFooter = () => new Footer({
    children: [
      new Paragraph({ alignment: 'left', spacing: { before: 80 }, border: { top: thin }, children: [run('[BVI_LEGAL_NOTE: insert BVI Business Companies Act 2018 statutory note verbatim from ROD.xlsx reference]', { size: 14, color: '808080' })] }),
      new Paragraph({ alignment: 'right', spacing: { before: 10 }, children: [run('BVI 2018   |   Page No.: ', { size: 14 }), new TextRun({ children: [PageNumber.CURRENT], size: 14, font: FONT })] }),
    ],
  });

  const sections = [
    { headers: { default: makeHeader(PageNumber.CURRENT) }, footers: { default: makeFooter() }, children: buildBviRodTable('ORIGINAL – REGISTER OF DIRECTORS (For Individual Director)', BVI_IND_HEADERS, BVI_IND_WIDTHS, indRows) },
    { headers: { default: makeHeader(PageNumber.CURRENT) }, footers: { default: makeFooter() }, children: buildBviRodTable('COPY – REGISTER OF DIRECTORS (For Individual Director)', BVI_IND_HEADERS, BVI_IND_WIDTHS, indRows) },
    { headers: { default: makeHeader(PageNumber.CURRENT) }, footers: { default: makeFooter() }, children: buildBviRodTable('ORIGINAL – REGISTER OF DIRECTORS (For Corporate Director)', BVI_CORP_HEADERS, BVI_CORP_WIDTHS, corpRows) },
  ];
  const lastChildren = buildBviRodTable('COPY – REGISTER OF DIRECTORS (For Corporate Director)', BVI_CORP_HEADERS, BVI_CORP_WIDTHS, corpRows);
  if (withSignature) lastChildren.push(buildSignatureBlock('BVI', 'ROD'));
  sections.push({ headers: { default: makeHeader(PageNumber.CURRENT) }, footers: { default: makeFooter() }, children: lastChildren });

  return sections;
}

// ===== 主构造 =====
export function buildRodDocument(company = {}, directorsLinks = [], opts = {}) {
  const region = opts.region || inferRegion(company);
  const purpose = opts.purpose || 'standard';
  const placeholderMode = !!opts.placeholder;
  const withSignature = purpose === 'bank' || purpose === 'audit';

  let directors = directorsLinks;
  if (placeholderMode || !directors || directors.length === 0) {
    directors = [{ _placeholder: true }];
  }

  if (region === 'HK') {
    const section = buildHkRod(company, directors, placeholderMode, withSignature);
    return new Document({
      creator: 'Claw Company Secretary System',
      title: `Register of Directors - ${company.name || ''}`,
      styles: { default: { document: { run: { font: 'Times New Roman', size: 16 } } } },
      sections: [section],
    });
  }

  // BVI — 多 section
  const sections = buildBviRod(company, directors, placeholderMode, withSignature);
  return new Document({
    creator: 'Claw Company Secretary System',
    title: `Register of Directors - ${company.name || ''}`,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 14 } } } },
    sections,
  });
}

export async function buildRodDocxBlob(company, directorsLinks, opts) {
  return Packer.toBlob(buildRodDocument(company, directorsLinks, opts));
}
export async function buildRodBuffer(company, directorsLinks, opts) {
  return Packer.toBuffer(buildRodDocument(company, directorsLinks, opts));
}
