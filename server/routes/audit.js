const express = require('express');
const AuditLog = require('../models/AuditLog');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit — 审计日志（仅 admin / auditor 可查）
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'auditor') {
      return res.status(403).json({ message: 'Access denied. Admin or Auditor only.' });
    }
    const { action, entityType, limit = 50, page = 1 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .skip((Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10));
    res.json({ success: true, count: logs.length, total, logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
