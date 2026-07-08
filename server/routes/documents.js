const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Document = require('../models/Document');
const Company = require('../models/Company');
const Director = require('../models/Director');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 文件存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    const { type, company, companyId, director, signStatus, search } = req.query;
    const query = {};
    if (type) query.type = type;
    if (company) query.company = company;
    if (companyId) query.company = companyId;
    if (director) query.director = director;
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
      .populate('director', 'name nameChinese')
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
      .populate('company').populate('director').populate('uploadedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents — 上传文件
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, name, type, company, director, description, category, note, tags, keywords, isConfidential } = req.body;

    // 兼容前端自动归档：company / director 可能是 { _id, name } 对象，也可能直接是 ObjectId
    const companyVal = (company && typeof company === 'object' && company._id) ? company._id : company;
    const directorVal = (director && typeof director === 'object' && director._id) ? director._id : director;

    // 文档标题：优先 title，其次 name（前端自动归档使用 name 字段）
    const docTitle = title || name || req.file?.originalname || 'Untitled';

    // 生成文档编号
    let companyObj = null;
    let directorName = null;
    if (companyVal) companyObj = await Company.findById(companyVal);
    if (directorVal) {
      const d = await Director.findById(directorVal);
      if (d) directorName = d.name;
    }

    const docNumber = await Document.generateDocNumber(companyObj, directorName, type);

    const docData = {
      docNumber,
      name: docTitle,
      type: type || 'other',
      category: category || 'other',
      company: companyVal || undefined,
      director: directorVal || undefined,
      description: description || note || undefined,
      note: note || undefined,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [],
      isConfidential: isConfidential === 'true' || isConfidential === true,
      uploadedBy: req.user._id,
    };

    if (req.file) {
      docData.filename = req.file.filename;
      docData.originalName = req.file.originalname;
      docData.filepath = req.file.path;
      docData.mimetype = req.file.mimetype;
      docData.size = req.file.size;
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
    // 删除物理文件
    if (doc.filepath && fs.existsSync(doc.filepath)) {
      fs.unlinkSync(doc.filepath);
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
    res.download(doc.filepath, doc.originalName || doc.filename);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
