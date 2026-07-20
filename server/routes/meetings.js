const express = require('express');
const Meeting = require('../models/Meeting');
const Company = require('../models/Company');
const { auth } = require('../middleware/auth');
const { scopeMiddleware, applyListScope, inScope } = require('../middleware/scope');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// @route   GET /api/meetings
// @desc    Get all meetings
// @access  Private
router.get('/', auth, scopeMiddleware, async (req, res) => {
  try {
    const { status, type, company, personnelId, startDate, endDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (company) query.company = company;
    // v5.0 读时聚合：personnelId 反查该人关联公司的会议 + 其作为出席人的会议
    if (personnelId) {
      const linkedCompanies = await Company.find({ 'links.link': personnelId, 'links.linkModel': 'Personnel' }).select('_id');
      query.$or = [
        { 'attendees.ref': personnelId },
        { company: { $in: linkedCompanies.map(c => c._id) } },
      ];
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Wave 0 rev2 — 行级权限：非 admin/auditor 仅见 accessibleCompanies 内的公司会议
    applyListScope(query, req, 'company');

    const meetings = await Meeting.find(query)
      .populate('company', ' name')
      .populate('attendees.ref', 'name email')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: meetings.length,
      meetings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/meetings/:id
// @desc    Get single meeting
// @access  Private
router.get('/:id', auth, scopeMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('company')
      .populate('attendees.ref', 'name email phone')
      .populate('createdBy', 'name')
      .populate('documents');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    // Wave 0 rev2 — 行级权限：越权访问返回 403
    if (!inScope(req, meeting.company?._id || meeting.company)) {
      return res.status(403).json({ message: 'Access denied: meeting not in your accessible scope' });
    }

    res.json({
      success: true,
      meeting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/meetings
// @desc    Create new meeting
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { company, title, type, date, time, location, agenda, attendees } = req.body;

    const meeting = await Meeting.create({
      company,
      title,
      type,
      date,
      time,
      location,
      agenda,
      attendees,
      createdBy: req.user._id
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('company', 'name')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      meeting: populatedMeeting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/meetings/:id
// @desc    Update meeting
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('company', 'name');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({
      success: true,
      meeting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/meetings/:id
// @desc    Delete meeting
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/meetings/:id/status
// @desc    Update meeting status
// @access  Private
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, phase } = req.body;
    const update = {};
    if (status) update.status = status;
    if (phase) update.phase = phase;

    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('company', 'name');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Wave 0 rev2 — 审计：会议归档（phase=completed）留痕
    if (phase === 'completed') {
      logAudit(req, { action: 'archive', entityType: 'Meeting', entityId: meeting._id, detail: `归档会议「${meeting.title}」${meeting.company ? ' · ' + meeting.company.name : ''}` });
    }

    res.json({
      success: true,
      meeting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
