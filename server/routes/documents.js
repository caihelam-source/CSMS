const express = require('express');
const fs = require('fs');
const multer = require('multer');
const Document = require('../models/Document');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const { auth } = require('../middleware/auth');
const { scopeMiddleware, applyListScope, inScope } = require('../middleware/scope');
const { logAudit } = require('../utils/audit');
const { storage: fileStorage } = require('../storage/r2');

const router = express.Router();

// multer 仅负责解析 multipart，文件暂存内存（再转交存储适配器）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// GET /api/documents
router.get('/', auth, scopeMiddleware, async (req, res) => {
  try {
    const { type, company, companyId, personnelId, meetingId, signStatus, search } = req.query;
    const query = {};
    if (type) query.type = type;
    if (company) query.company = company;
    if (companyId) query.company = companyId;
    if (personnelId) query.personnel = personnelId;
    if (meetingId) query.meeting = meetingId;
    if (signStatus) query.signStatus = signStatus;
    // v5.2 模块1：公司文件库 / 全局列表默认排除"会议暂存"文件
    // （staged=true 的文件仅停留在会议子目录，归档后才进入公司库）。
    // 仅当显式请求 meetingId（会议视图自身）或 includeStaged 时才包含。
    if (!meetingId && req.query.includeStaged !== 'true') {
      query.staged = { $ne: true };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { docNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { keywords: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Wave 0 rev2 — 行级权限：非 admin/auditor 仅见 accessibleCompanies 内的公司文档
    applyListScope(query, req, 'company');

    const documents = await Document.find(query)
      .populate('company', 'name nameChinese stockCode')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/:id
router.get('/:id', auth, scopeMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('company').populate('uploadedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    // Wave 0 rev2 — 行级权限：越权访问返回 403
    if (!inScope(req, doc.company?._id || doc.company)) {
      return res.status(403).json({ message: 'Access denied: document not in your accessible scope' });
    }
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents — 上传文件
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, name, type, company, personnel, meeting, description, category, note, tags, keywords, isConfidential, source, locked, staged } = req.body;

    // 兼容前端自动归档：company / personnel / meeting 可能是 { _id, name } 对象，也可能直接是 ObjectId
    const companyVal = (company && typeof company === 'object' && company._id) ? company._id : company;
    const personnelVal = (personnel && typeof personnel === 'object' && personnel._id) ? personnel._id : personnel;
    const meetingVal = (meeting && typeof meeting === 'object' && meeting._id) ? meeting._id : meeting;

    // 文档标题：优先 title，其次 name（前端自动归档使用 name 字段）
    const docTitle = title || name || req.file?.originalname || 'Untitled';

    // 生成文档编号
    let companyObj = null;
    let personnelObj = null;
    const docYear = req.body.documentYear ? Number(req.body.documentYear) : new Date().getFullYear();
    if (companyVal) companyObj = await Company.findById(companyVal);
    if (personnelVal) {
      const d = await Personnel.findById(personnelVal);
      if (d) personnelObj = d;
    }

    const docData = {
      name: docTitle,
      type: type || 'other',
      category: category || 'other',
      company: companyVal || undefined,
      personnel: personnelVal || undefined,
      meeting: meetingVal || undefined,
      description: description || note || undefined,
      note: note || undefined,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [],
      isConfidential: isConfidential === 'true' || isConfidential === true,
      // v5.1 来源追溯 + 归档锁定：前端自动归集（纪要/签署扫描）或手动补充上传时携带
      source: (source && typeof source === 'object') ? {
        kind: source.kind || 'other',
        refId: source.refId || undefined,
        label: source.label || undefined,
      } : undefined,
      locked: locked === true || locked === 'true' || false,
      // v5.2 会议暂存（模块1）：会议视图上传时携带 staged=true，归档时由前端置 false
      staged: staged === true || staged === 'true' || false,
      // v6.x 归属维度：有 company 即为公司文件（即便关联 personnel，如董事任免）；仅 personnel 则为个人文件
      scope: companyVal ? 'company' : (personnelVal ? 'person' : 'company'),
      documentYear: docYear,
      uploadedBy: req.user._id,
    };

    if (req.file) {
      // 通过存储适配器持久化（local 磁盘 或 R2 对象存储）
      const saved = await fileStorage.upload(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      docData.filename = saved.key;
      docData.originalName = req.file.originalname;
      docData.filepath = saved.url;       // R2: 公开 URL; local: /uploads/... 路径
      docData.fileUrl = saved.url;
      docData.mimetype = req.file.mimetype;
      docData.size = saved.size;
    }

    // 生成文档编号并创建（重试 3 次防 unique 索引冲突 — DB-AUDIT P1-8）
    let doc = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      docData.docNumber = await Document.generateDocNumber({ company: companyObj, personnel: personnelObj, type: docData.type, year: docYear });
      try {
        doc = await Document.create(docData);
        break;
      } catch (createErr) {
        if (createErr.code === 11000 && attempt < 2) continue; // docNumber 冲突，重试
        throw createErr;
      }
    }

    const populated = await Document.findById(doc._id)
      .populate('company', 'name').populate('uploadedBy', 'name email');

    res.status(201).json({ success: true, document: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/documents/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const existing = await Document.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Document not found' });

    const upd = { ...req.body };
    // v6.x 动态编号：编辑归属公司/人员/类型/年份 → 重算 docNumber 并同步 scope
    const needsRenumber = ['company', 'personnel', 'type', 'documentYear'].some((k) => k in upd);
    if (needsRenumber) {
      const c = upd.company ? await Company.findById(upd.company)
        : (existing.company ? await Company.findById(existing.company) : null);
      const p = upd.personnel ? await Personnel.findById(upd.personnel)
        : (existing.personnel ? await Personnel.findById(existing.personnel) : null);
      const yr = upd.documentYear ? Number(upd.documentYear) : (existing.documentYear || new Date().getFullYear());
      upd.docNumber = await Document.generateDocNumber({
        company: c, personnel: p, type: upd.type || existing.type, year: yr,
      });
      upd.scope = upd.company ? 'company' : (upd.personnel ? 'person' : 'company');
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { ...upd, $inc: { version: 1 } },
      { new: true }
    ).populate('company', 'name');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    // Wave 0 rev2 — 审计：归档 / 锁定 动作留痕
    if (req.body.signStatus === 'archived') {
      logAudit(req, { action: 'archive', entityType: 'Document', entityId: doc._id, detail: `归档文档「${doc.name}」${doc.company ? ' · ' + doc.company.name : ''}` });
    }
    if (req.body.locked === true || req.body.locked === 'true') {
      logAudit(req, { action: 'lock', entityType: 'Document', entityId: doc._id, detail: `锁定文档「${doc.name}」${doc.company ? ' · ' + doc.company.name : ''}` });
    }
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    // 删除物理文件（R2 或本地磁盘）
    if (doc.filename) {
      try { await fileStorage.delete(doc.filename); } catch (e) { console.error('删除文件失败:', e.message); }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/:id/download
router.get('/:id/download', auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.filepath) return res.status(404).json({ message: 'File not found' });

    // R2 模式：直接重定向到公开 URL（前端可用此 URL 预览/下载）
    if ((process.env.STORAGE_DRIVER || 'local') === 'r2') {
      return res.redirect(doc.filepath);
    }

    // 本地磁盘：直接发送文件
    if (fs.existsSync(doc.filepath)) {
      return res.download(doc.filepath, doc.originalName || doc.filename);
    }
    res.status(404).json({ message: 'File not found on disk' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/export — FILE_MANIFEST（CSV，Excel 可直接打开）
router.get('/export', auth, scopeMiddleware, async (req, res) => {
  try {
    const { company, companyId, personnelId, type, year, signStatus } = req.query;
    const query = {};
    if (company) query.company = company;
    if (companyId) query.company = companyId;
    if (personnelId) query.personnel = personnelId;
    if (type) query.type = type;
    if (year) query.documentYear = Number(year);
    if (signStatus) query.signStatus = signStatus;
    if (req.query.includeStaged !== 'true') query.staged = { $ne: true };
    // 行级权限：非 admin/auditor 仅见 accessibleCompanies 内公司文档
    applyListScope(query, req, 'company');

    const docs = await Document.find(query)
      .populate('company', 'name registrationNumber')
      .populate('personnel', 'name')
      .sort({ createdAt: -1 });

    const headers = ['编号', '名称', '类型', '分类', '归属', '关联公司', '关联人员', '年份', '创建日期', '到期日', '来源', '文件URL'];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = docs.map((d) => [
      d.docNumber, d.name, d.type, d.category,
      d.scope || (d.company ? 'company' : 'person'),
      d.company?.name || '', d.personnel?.name || '', d.documentYear || '',
      d.createdAt ? d.createdAt.toISOString().split('T')[0] : '',
      d.expiresAt ? d.expiresAt.toISOString().split('T')[0] : '',
      d.source?.label || '', d.fileUrl || '',
    ].map(esc).join(','));

    // BOM 头确保 Excel 正确识别中文
    const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="FILE_MANIFEST_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/export-zip — 选中/范围文件打包下载（需实体文件）
router.get('/export-zip', auth, scopeMiddleware, async (req, res) => {
  try {
    const ids = req.query.ids ? String(req.query.ids).split(',') : [];
    const query = {};
    if (ids.length) {
      query._id = { $in: ids };
    } else {
      const { company, companyId, personnelId, type, year } = req.query;
      if (company) query.company = company;
      if (companyId) query.company = companyId;
      if (personnelId) query.personnel = personnelId;
      if (type) query.type = type;
      if (year) query.documentYear = Number(year);
    }
    if (req.query.includeStaged !== 'true') query.staged = { $ne: true };
    applyListScope(query, req, 'company');

    const docs = await Document.find(query).populate('company', 'name');
    const JSZip = require('jszip');
    const zip = new JSZip();
    let added = 0;
    for (const d of docs) {
      if (!d.filename) continue;
      const buf = await fileStorage.get(d.filename).catch(() => null);
      if (!buf) continue;
      const safeName = `${(d.docNumber || d._id).replace(/[^\w.-]/g, '_')}_${d.fileName || d.filename}`;
      zip.file(safeName, buf);
      added += 1;
    }
    if (added === 0) return res.status(404).json({ message: '没有可打包的实体文件' });
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documents_${Date.now()}.zip"`);
    res.send(content);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
