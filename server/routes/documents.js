const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Document = require('../models/Document');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const { auth } = require('../middleware/auth');
const { storage: fileStorage } = require('../storage/r2');

const router = express.Router();

// multer 仅负责解析 multipart，文件暂存内存（再转交存储适配器）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    const { type, company, companyId, personnelId, signStatus, search } = req.query;
    const query = {};
    if (type) query.type = type;
    if (company) query.company = company;
    if (companyId) query.company = companyId;
    if (personnelId) query.personnel = personnelId;
    if (signStatus) query.signStatus = signStatus;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { docNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { keywords: { $in: [new RegExp(search, 'i')] } },
      ];
    }

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
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('company').populate('uploadedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents — 上传文件
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, name, type, company, personnel, description, category, note, tags, keywords, isConfidential } = req.body;

    // 兼容前端自动归档：company / personnel 可能是 { _id, name } 对象，也可能直接是 ObjectId
    const companyVal = (company && typeof company === 'object' && company._id) ? company._id : company;
    const personnelVal = (personnel && typeof personnel === 'object' && personnel._id) ? personnel._id : personnel;

    // 文档标题：优先 title，其次 name（前端自动归档使用 name 字段）
    const docTitle = title || name || req.file?.originalname || 'Untitled';

    // 生成文档编号
    let companyObj = null;
    let directorName = null;
    if (companyVal) companyObj = await Company.findById(companyVal);
    if (personnelVal) {
      const d = await Personnel.findById(personnelVal);
      if (d) directorName = d.name;
    }

    const docNumber = await Document.generateDocNumber(companyObj, directorName, type);

    const docData = {
      docNumber,
      name: docTitle,
      type: type || 'other',
      category: category || 'other',
      company: companyVal || undefined,
      personnel: personnelVal || undefined,
      description: description || note || undefined,
      note: note || undefined,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [],
      isConfidential: isConfidential === 'true' || isConfidential === true,
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

    const doc = await Document.create(docData);
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
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { ...req.body, $inc: { version: 1 } },
      { new: true }
    ).populate('company', 'name');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
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

module.exports = router;
