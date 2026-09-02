const express = require('express');
const ComplianceReminder = require('../models/ComplianceReminder');
const ComplianceRule = require('../models/ComplianceRule');
const Company = require('../models/Company');
const { auth } = require('../middleware/auth');
const { parsePaging, pagingEnvelope } = require('../utils/pagination');
const { createTaskFromReminder, createTasksBatch } = require('../services/taskFromReminder');
const { ensureCompanyReminders } = require('../services/complianceService');
const { generateRemindersForRule } = require('../services/complianceService');

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

    const { page, limit, usePaging, skip } = parsePaging(req.query);
    const total = await ComplianceReminder.countDocuments(query);

    let q = ComplianceReminder.find(query).lean()
      .populate('company', 'name nameChinese jurisdiction isListed')
      .populate('rule', 'ruleName ruleId category')
      .sort({ dueDate: 1 });
    if (usePaging) q = q.skip(skip).limit(limit);
    const reminders = await q;

    res.json(pagingEnvelope('reminders', reminders, { usePaging, page, limit, total }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-reminders/recompute — 按公司+规则重建开放提醒
// 用途：BR 续期（更新 brExpiryDate 后旧截止日提醒会残留）/ NAR1 补录（补全成立日后）刷新。
// 流程：先删该公司下相关规则的开放提醒，再按最新公司字段重新生成，保证单一当前周期提醒。
router.post('/recompute', auth, async (req, res) => {
  try {
    const { companyId, ruleIds } = req.body || {};
    if (!companyId || !Array.isArray(ruleIds) || !ruleIds.length) {
      return res.status(400).json({ message: 'companyId 与 ruleIds 必填' });
    }
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const rules = await ComplianceRule.find({ ruleId: { $in: ruleIds }, status: '启用' });
    let created = 0, skipped = 0, cleared = 0;
    for (const rule of rules) {
      const del = await ComplianceReminder.deleteMany({
        company: companyId, rule: rule._id, status: { $in: ['待办', '处理中'] },
      });
      cleared += del.deletedCount || 0;
      const r = await generateRemindersForRule(rule, company);
      created += r.created;
      skipped += r.skipped;
    }
    res.json({ success: true, data: { created, skipped, cleared } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-reminders/ensure — 单公司 ensure 启用规则对应的开放提醒
// 与 /recompute 的差别：ensure 只 generate（不删任何提醒），幂等。供 NAR1 导入闭环、
// CompanyDetail 首访自愈、状态条「生成提醒」按钮使用。
router.post('/ensure', auth, async (req, res) => {
  try {
    const { companyId, ruleIds } = req.body || {};
    if (!companyId) return res.status(400).json({ message: 'companyId 必填' });
    const result = await ensureCompanyReminders(companyId, Array.isArray(ruleIds) ? ruleIds : []);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-reminders/ensure-all-hk — admin 一键兜底：对所有 jurisdiction='HK' 公司
// ensure HK_AR_42 + HK_BR_RENEW（nonHongKongCompany=true 的额外加 HK_NN3_AR）。
// 用于：Render 部署后 initPresetRules 跑过但 ensure 未自动触发的兜底；以及秘书一次性"全员刷一遍"。
// 幂等；非 admin 返回 403。
router.post('/ensure-all-hk', auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: '需要管理员权限' });
    }
    const Company = require('../models/Company');
    const companies = await Company.find({ jurisdiction: 'HK' }).select('_id name nonHongKongCompany').lean();
    let processed = 0, created = 0, skipped = 0, blocked = 0;
    const errors = [];
    for (const c of companies) {
      try {
        const ruleIds = c.nonHongKongCompany
          ? ['HK_NN3_AR', 'HK_BR_RENEW']
          : ['HK_AR_42', 'HK_BR_RENEW'];
        const r = await ensureCompanyReminders(c._id, ruleIds);
        created += r.created || 0;
        skipped += r.skipped || 0;
        blocked += r.blocked || 0;
        processed++;
      } catch (e) {
        errors.push({ companyId: String(c._id), name: c.name, error: e.message });
      }
    }
    res.json({
      success: true,
      data: { processed, totalCompanies: companies.length, created, skipped, blocked, errors },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliance-reminders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const reminder = await ComplianceReminder.findById(req.params.id).lean()
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

// POST /api/compliance-reminders/create-tasks/batch — 批量：提醒→任务（闭环第二跳）
router.post('/create-tasks/batch', auth, async (req, res) => {
  try {
    const { ids, assignedTo, notes } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids 不能为空' });
    }
    const result = await createTasksBatch(ids, { userId: req.user._id, assignedTo, notes });
    res.json({ success: true, ...result });
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

// POST /api/compliance-reminders/:id/create-task — 单条：提醒→任务（闭环第二跳）
router.post('/:id/create-task', auth, async (req, res) => {
  try {
    const { assignedTo, notes } = req.body || {};
    const { task, created } = await createTaskFromReminder(req.params.id, {
      userId: req.user._id,
      assignedTo,
      notes,
    });
    res.status(created ? 201 : 200).json({ success: true, created, task });
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
