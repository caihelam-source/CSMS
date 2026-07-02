const express = require('express');
const SignTask = require('../models/SignTask');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/sign-tasks
router.get('/', auth, async (req, res) => {
  try {
    const { status, company, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (company) query.company = company;
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }];

    const tasks = await SignTask.find(query)
      .populate('document', 'title docNumber type')
      .populate('company', 'name nameChinese')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sign-tasks/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await SignTask.findById(req.params.id)
      .populate('document')
      .populate('company')
      .populate('signers.signer', 'name email');
    if (!task) return res.status(404).json({ message: 'Sign task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sign-tasks — 创建签署任务
router.post('/', auth, async (req, res) => {
  try {
    const task = await SignTask.create({ ...req.body, createdBy: req.user._id });
    // 更新文档状态
    if (task.document) {
      await Document.findByIdAndUpdate(task.document, { signStatus: 'pending_sign' });
    }
    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/sign-tasks/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await SignTask.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('document', 'title').populate('company', 'name');
    if (!task) return res.status(404).json({ message: 'Sign task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sign-tasks/:id/sign — 提交签名
router.post('/:id/sign', async (req, res) => {
  try {
    const { signerId, signatureData, verificationCode } = req.body;
    const task = await SignTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Sign task not found' });
    if (task.status === 'completed' || task.status === 'cancelled') {
      return res.status(400).json({ message: '签署任务已结束' });
    }

    const record = task.signers.find(s => String(s._id) === signerId || String(s.signer) === signerId);
    if (!record) return res.status(404).json({ message: '签署人不在列表中' });

    record.status = 'signed';
    record.signedAt = new Date();
    record.signatureData = signatureData;
    record.ipAddress = req.ip;

    // 检查是否全部签完
    const allSigned = task.signers.every(s => s.status === 'signed');
    if (allSigned) {
      task.status = 'completed';
      task.completedAt = new Date();
      await Document.findByIdAndUpdate(task.document, { signStatus: 'fully_signed' });
    } else {
      task.status = 'in_progress';
      await Document.findByIdAndUpdate(task.document, { signStatus: 'partially_signed' });
    }

    await task.save();
    res.json({ success: true, task, allSigned });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/sign-tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await SignTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Sign task not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
