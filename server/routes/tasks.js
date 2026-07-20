const express = require('express');
const Task = require('../models/Task');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, type, assignedTo, company, companyId, personnel, personnelId, dueDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (assignedTo) query.assignedTo = assignedTo;
    // v5.0 读时聚合：getByCompany / getByPersonnel 通过引用 ID 过滤；兼容 companyId / personnelId 别名
    const companyRef = company || companyId;
    if (companyRef) query.company = companyRef;
    const personnelRef = personnel || personnelId;
    if (personnelRef) query.personnel = personnelRef;
    if (dueDate) {
      const date = new Date(dueDate);
      query.dueDate = {
        $lte: date,
        $gte: new Date(date.setHours(0, 0, 0, 0))
      };
    }

    const tasks = await Task.find(query)
      .populate('company', 'name')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('meeting', 'title date')
      .populate('personnel', 'name')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('company')
      .populate('assignedTo', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('meeting')
      .populate('notes.createdBy', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      createdBy: req.user._id
    });

    const populatedTask = await Task.findById(task._id)
      .populate('company', 'name')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      task: populatedTask
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updateData = { ...req.body };

    // If status is being set to completed, add completedDate
    if (req.body.status === 'completed' && !req.body.completedDate) {
      updateData.completedDate = new Date();
    }

    // v5.1 完成门禁：签署类 / 文档审阅类 Task 必须已有附件方可标记完成（#2.3 状态流转）
    const REQUIRE_ATTACH = ['signing', 'document_review'];
    if (req.body.status === 'completed' && REQUIRE_ATTACH.includes(existing.type)) {
      const hasAtt = existing.hasAttachment === true || req.body.hasAttachment === true;
      if (!hasAtt) {
        // 兜底：检查是否已存在关联该 Task 的签署扫描件文档
        const linked = await Document.findOne({
          $or: [
            { 'source.refId': existing._id },
            { 'source.kind': 'signing_scan', refId: existing._id },
          ],
        });
        if (!linked) {
          return res.status(400).json({ message: '请先上传签署文件后再标记完成' });
        }
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('company', 'name')
     .populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tasks/:id/notes
// @desc    Add note to task
// @access  Private
router.post('/:id/notes', auth, async (req, res) => {
  try {
    const { content } = req.body;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            content,
            createdBy: req.user._id,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).populate('notes.createdBy', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
