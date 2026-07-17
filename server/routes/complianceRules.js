const express = require('express');
const ComplianceRule = require('../models/ComplianceRule');
const { auth } = require('../middleware/auth');
const { initPresetRules, generateForRule, generateBatch } = require('../services/complianceService');

const router = express.Router();

// GET /api/compliance-rules
router.get('/', auth, async (req, res) => {
  try {
    const { jurisdiction, isListedOnly, status, isPreset, search } = req.query;
    const query = {};
    if (jurisdiction) query.jurisdiction = jurisdiction;
    if (isListedOnly !== undefined) query.isListedOnly = isListedOnly === 'true';
    if (status) query.status = status;
    if (isPreset !== undefined) query.isPreset = isPreset === 'true';
    if (search) query.$or = [
      { ruleName: { $regex: search, $options: 'i' } },
      { ruleId: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
    const rules = await ComplianceRule.find(query)
      .populate('appliedCompanies', 'name nameChinese')
      .sort({ jurisdiction: 1, isListedOnly: 1, ruleId: 1 });
    res.json({ success: true, count: rules.length, rules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliance-rules/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findById(req.params.id).populate('appliedCompanies', 'name nameChinese jurisdiction');
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-rules — 创建自定义规则
router.post('/', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.create({ ...req.body, isPreset: false });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/compliance-rules/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/compliance-rules/:id — 仅自定义规则可删
router.delete('/:id', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    if (rule.isPreset) return res.status(403).json({ message: '预设规则不能删除，只能停用' });
    await rule.deleteOne();
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-rules/:id/apply — 为规则关联公司
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const { companyIds } = req.body;
    const rule = await ComplianceRule.findByIdAndUpdate(
      req.params.id,
      { $set: { appliedCompanies: companyIds } },
      { new: true }
    ).populate('appliedCompanies', 'name');
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-rules/:id/generate — 为规则生成提醒
router.post('/:id/generate', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    const result = await generateForRule(rule);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-rules/generate/batch — 批量生成
router.post('/generate/batch', auth, async (req, res) => {
  try {
    const { ruleIds, companyIds } = req.body;
    if (!ruleIds?.length || !companyIds?.length) {
      return res.status(400).json({ message: '请选择规则和公司' });
    }
    const result = await generateBatch(ruleIds, companyIds);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliance-rules/initialize — 手动初始化预设规则
router.post('/initialize', auth, async (req, res) => {
  try {
    await initPresetRules();
    res.json({ success: true, message: '预设规则初始化完成' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
