const express = require('express');
const PDFDocument = require('pdfkit');
const ShareholderEntry = require('../models/ShareholderEntry');
const DirectorEntry = require('../models/DirectorEntry');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const { auth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// ── 辅助函数 ────────────────────────────────────────────────────
// BVI 标准日期格式 DD/MM/YYYY
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtText = (s) => (s || '').trim();

// ── 通用 PDF 表格绘制工具（BVI标准）──────────────────────────────
function drawTable(doc, { headers, colWidths, rows, startX = 40, headerBgColor = '#1a365d', startY = null, pageBottom = 760 }) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  let y = startY || doc.y;
  const headerHeight = 22;
  const lineHeight = 11;

  // 绘制表头
  function drawHeader(currentY) {
    // 表头背景
    doc.rect(startX, currentY, tableWidth, headerHeight).fill(headerBgColor);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 2, currentY + 4, { width: colWidths[i] - 4, align: 'center' });
      x += colWidths[i];
    }
    doc.fillColor('#000000');
    // 底线
    doc.moveTo(startX, currentY + headerHeight).lineTo(startX + tableWidth, currentY + headerHeight).lineWidth(0.5).stroke(headerBgColor);
    return currentY + headerHeight;
  }

  y = drawHeader(y);
  doc.font('Helvetica').fontSize(7);

  // 绘制数据行
  for (const row of rows) {
    // 计算行高：找最长单元格的行数
    const maxCellLines = Math.max(...row.map(cell => String(cell).split('\n').length), 1);
    const rowHeight = Math.max(maxCellLines * lineHeight + 4, 18);

    // 检查翻页
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = 50;
      y = drawHeader(y);
      doc.font('Helvetica').fontSize(7);
    }

    // 白色背景行 + 黑色边框
    doc.rect(startX, y, tableWidth, rowHeight).fill('#ffffff').stroke('#000000');
    // 竖线分隔列
    let lx = startX;
    for (const w of colWidths) {
      doc.moveTo(lx, y).lineTo(lx, y + rowHeight).lineWidth(0.3).stroke('#000000');
      lx += w;
    }
    doc.moveTo(lx, y).lineTo(lx, y + rowHeight).lineWidth(0.3).stroke('#000000');
    // 上方水平线
    doc.moveTo(startX, y).lineTo(startX + tableWidth, y).lineWidth(0.3).stroke('#000000');

    // 写内容（左对齐）
    doc.fillColor('#000000');
    let x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(String(row[i]), x + 2, y + 2, { width: colWidths[i] - 4, align: 'left' });
      x += colWidths[i];
    }
    y += rowHeight;
  }

  // 底部封线
  doc.moveTo(startX, y).lineTo(startX + tableWidth, y).lineWidth(0.5).stroke(headerBgColor);
  return y;
}

// ── GET /api/companies/:id/rod — BVI标准 ROD ──────────────────
router.get('/rod', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // 只取董事（不含公司秘书，BVI标准ROD不含秘书）
    const entries = await DirectorEntry.find({
      company: req.params.id,
      positionType: { $ne: '公司秘书' }
    })
      .populate('personnelRef')
      .sort({ isCurrent: -1, dateOfAppointment: 1 });

    // Landscape A4 for 10-column table
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 30, right: 30 },
      info: {
        Title: `Register of Directors - ${company.name}`,
        Author: 'Claw Company Secretary System',
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    const rodName = `${company.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim()}_${company.registrationNumber || 'NA'}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_ROD.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${rodName}"`);
    doc.pipe(res);

    // ── 标题区 ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text('REGISTER OF DIRECTORS', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica')
      .text(`${company.name}${company.nameChinese ? ` / ${company.nameChinese}` : ''}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text(`No: ${fmtText(company.registrationNumber)}`, { align: 'center' });
    doc.moveDown(0.8);

    // ── BVI标准10列表格 ──
    // A4 landscape usable width: 297mm - 30mm - 30mm = 237mm
    // Convert to points: 237mm * 2.83 = 671pt
    const startX = 30 * 2.83; // ≈ 85pt
    const usableWidth = 237 * 2.83; // ≈ 671pt
    
    // Column widths in points (proportional to content)
    const colWidths = [55, 75, 50, 85, 70, 75, 65, 50, 55, 40]; // total = 630pt
    // Scale to fit usable width
    const scale = usableWidth / 630;
    const scaledColWidths = colWidths.map(w => w * scale);

    const headers = [
      'Appointed', 
      'Full Name', 
      'Former Name', 
      'Date and Place of Birth', 
      'Nationality and Identity Card Number', 
      'Service Address', 
      'Residential Address', 
      'Occupation', 
      'Cessation', 
      'Status'
    ];

    const rodRows = entries.map(entry => {
      const p = entry.personnelRef || {};
      
      // Date and Place of Birth: "DD/MM/YYYY, City, Country"
      const dobDate = fmtDate(entry.dateOfBirth) || fmtDate(p.dateOfBirth) || '';
      const dobPlace = fmtText(entry.placeOfBirth) || fmtText(p.placeOfBirth) || '';
      const dob = dobDate && dobPlace ? `${dobDate}, ${dobPlace}` : dobDate || dobPlace || '';
      
      // Nationality and Identity Card Number: "Nationality / IDNumber"
      const nationality = fmtText(entry.nationality) || fmtText(p.nationality) || '';
      const idNumber = fmtText(entry.idNumber) || fmtText(p.idNumber) || '';
      const natId = nationality && idNumber ? `${nationality} / ${idNumber}` : nationality || idNumber || '';
      
      // Cessation: leave blank if still in office
      const cessation = entry.dateOfCessation ? fmtDate(entry.dateOfCessation) : '';
      
      // Status: "Active" or "Resigned"
      const status = entry.isCurrent ? 'Active' : 'Resigned';

      return [
        fmtDate(entry.dateOfAppointment) || '',
        fmtText(entry.fullName) || fmtText(p.name) || '',
        fmtText(entry.formerNameOrAlias) || fmtText(p.formerName) || '',
        dob,
        natId,
        fmtText(entry.documentServiceAddress) || fmtText(p.documentServiceAddress) || fmtText(p.correspondenceAddress) || '',
        fmtText(entry.usualResidentialAddress) || fmtText(p.residentialAddress) || '',
        fmtText(entry.occupation) || fmtText(p.occupation) || '',
        cessation,
        status,
      ];
    });

    drawTable(doc, {
      headers,
      colWidths: scaledColWidths,
      rows: rodRows,
      startX: startX,
      headerBgColor: '#1a365d',
      pageBottom: 595 - 40 * 2.83, // A4 landscape height minus bottom margin
    });

    if (entries.length === 0) {
      doc.fontSize(10).font('Helvetica')
        .text('No director records found.', { align: 'center' });
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/companies/:id/rom — BVI标准 ROM ──────────────────
router.get('/rom', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const entries = await ShareholderEntry.find({ company: req.params.id })
      .populate('personnelRef')
      .populate('companyRef')
      .sort({ shareholderType: 1, isCurrentMember: -1, dateEnteredAsMember: 1 });

    const individualMembers = entries.filter(e => e.shareholderType === '个人');
    const corporateMembers = entries.filter(e => e.shareholderType === '公司');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 30, right: 30 },
      info: {
        Title: `Register of Members - ${company.name}`,
        Author: 'Claw Company Secretary System',
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    const romName = `${company.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim()}_${company.registrationNumber || 'NA'}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_ROM.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${romName}"`);
    doc.pipe(res);

    // ── 标题区 ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text('REGISTER OF MEMBERS', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica')
      .text(`${company.name}${company.nameChinese ? ` / ${company.nameChinese}` : ''}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text(`No: ${fmtText(company.registrationNumber)}`, { align: 'center' });
    doc.moveDown(0.8);

    const startX = 30 * 2.83; // ≈ 85pt
    const usableWidth = 237 * 2.83; // ≈ 671pt

    // ── Part A: Individual Members ──
    if (individualMembers.length > 0) {
      // Part A title
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Part A - Individual Members', startX, doc.y + 5);
      doc.moveDown(0.3);

      // 7 columns
      const headersA = ['Name', 'Address', 'Occupation', 'Date Entered', 'Date Ceased', 'Total Shares', 'Entry By'];
      
      // Column widths in points
      const colWidthsABase = [90, 130, 55, 60, 60, 60, 55]; // sum = 510pt
      const scaleA = usableWidth / 510;
      const colWidthsA = colWidthsABase.map(w => w * scaleA);

      const rowsA = individualMembers.map(entry => {
        const p = entry.personnelRef || {};
        
        // Date Ceased: leave blank if still a member
        const ceased = entry.dateCeasedAsMember
          ? fmtDate(entry.dateCeasedAsMember)
          : '';
          
        // Total Shares: no commas
        const totalShares = String(entry.totalSharesHeld || 0);

        return [
          fmtText(entry.shareholderName) || fmtText(p.name) || '',
          fmtText(entry.shareholderAddress) || fmtText(p.residentialAddress) || '',
          fmtText(entry.shareholderOccupation) || fmtText(p.occupation) || '',
          fmtDate(entry.dateEnteredAsMember) || '',
          ceased,
          totalShares,
          'Secretary',
        ];
      });

      drawTable(doc, {
        headers: headersA,
        colWidths: colWidthsA,
        rows: rowsA,
        startX: startX,
        headerBgColor: '#2d3748',
        pageBottom: 595 - 40 * 2.83,
      });
    }

    // ── Part B: Corporate Members ──
    if (corporateMembers.length > 0) {
      // Add some space between Part A and Part B
      if (individualMembers.length > 0) {
        doc.moveDown(1);
      }

      // Part B title
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Part B - Corporate Members', startX, doc.y + 5);
      doc.moveDown(0.3);

      // 6 columns
      const headersB = ['Company Name', 'Address', 'Date Entered', 'Date Ceased', 'Total Shares', 'Entry By'];
      
      // Column widths in points
      const colWidthsBBase = [110, 160, 70, 70, 70, 60]; // sum = 540pt
      const scaleB = usableWidth / 540;
      const colWidthsB = colWidthsBBase.map(w => w * scaleB);

      const rowsB = corporateMembers.map(entry => {
        const c = entry.companyRef || {};
        
        // Date Ceased: leave blank if still a member
        const ceased = entry.dateCeasedAsMember
          ? fmtDate(entry.dateCeasedAsMember)
          : '';
          
        // Total Shares: no commas
        const totalShares = String(entry.totalSharesHeld || 0);

        return [
          fmtText(entry.shareholderName) || fmtText(c.name) || '',
          fmtText(entry.shareholderAddress) || fmtText(c.registeredAddress) || '',
          fmtDate(entry.dateEnteredAsMember) || '',
          ceased,
          totalShares,
          'Secretary',
        ];
      });

      drawTable(doc, {
        headers: headersB,
        colWidths: colWidthsB,
        rows: rowsB,
        startX: startX,
        headerBgColor: '#4a5568',
        pageBottom: 595 - 40 * 2.83,
      });
    }

    if (individualMembers.length === 0 && corporateMembers.length === 0) {
      doc.fontSize(10).font('Helvetica')
        .text('No member records found.', { align: 'center' });
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
