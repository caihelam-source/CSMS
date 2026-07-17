const express = require('express');
const { adminAuth } = require('../middleware/auth');
const { generateFixedReminders } = require('../services/reminderGenerator');

const router = express.Router();

// POST /api/admin/generate-reminders
// 手动触发「固定日期合规提醒」按年循环生成（含去重）
router.post('/generate-reminders', adminAuth, async (req, res) => {
  try {
    const result = await generateFixedReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[admin] generate-reminders failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
