const express = require('express');
const ComplianceReminder = require('../models/ComplianceReminder');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/compliance-reminders
router.get('/', auth, async (req, res) => {
  try {
    const { status, company, priority, search, overdue } = req.query;
    const query = {};
    if (status) query.status = status;
    if (company) query.company = company;
    if (priority) query.priority = priority;
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['待办', '处理中'] };
    }
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { ruleId: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];

    const reminders = await ComplianceReminder.find(query)
      .populate('company', 'name nameChinese jurisdiction isListed')
      .populate('rule', 'ruleName ruleId category')
      .sort({ dueDate: 1 });

    res.json({ success: true, count: reminders.length, reminders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliance-reminders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const reminder = await ComplianceReminder.findById(req.params.id)
      .populate('company').populate('rule');
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-reminders — 手动创建提醒
router.post('/', auth, async (req, res) => {
  try {
    const reminder = await ComplianceReminder.create(req.body);
    res.status(201).json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/compliance-reminders/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const reminder = await ComplianceReminder.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('company', 'name').populate('rule', 'ruleName');
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-reminders/:id/complete — 标记完成
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const reminder = await ComplianceReminder.findByIdAndUpdate(
      req.params.id,
      { status: '已完成', completedAt: new Date(), completedBy: req.user._id, notes: req.body.notes },
      { new: true }
    ).populate('company', 'name');
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/compliance-reminders/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ComplianceReminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliance-reminders/stats/summary — 统计概览
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const [total, pending, overdue, upcoming, urgent] = await Promise.all([
      ComplianceReminder.countDocuments(),
      ComplianceReminder.countDocuments({ status: '待办' }),
      ComplianceReminder.countDocuments({ status: { $in: ['待办', '处理中'] }, dueDate: { $lt: now } }),
      ComplianceReminder.countDocuments({ status: { $in: ['待办', '处理中'] }, dueDate: { $gte: now, $lte: in30 } }),
      ComplianceReminder.countDocuments({ priority: '紧急', status: { $in: ['待办', '处理中'] } }),
    ]);
    res.json({ success: true, stats: { total, pending, overdue, upcoming, urgent } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
