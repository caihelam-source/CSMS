const express = require('express');
const Task = require('../models/Task');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');
const { scopeMiddleware, applyListScope, inScope } = require('../middleware/scope');
const { parsePaging, pagingEnvelope } = require('../utils/pagination');

const router = express.Router();

/**
 * 完成权限判定（v-incremental 2026-08-19 / Q1 采纳收窄）
 * 规则：admin 或 任务的创建者(createdBy) 或 参与者(assignedTo 含本人) 可标记完成。
 * Q3：assignedTo 与 responsiblePerson 皆空时，仅创建者/admin 可完成（本函数天然满足）。
 * @param {Object} user  当前登录用户（req.user，含 _id / role）
 * @param {Object} task  任务文档（含 assignedTo / createdBy）
 * @returns {boolean}
 */
function canCompleteTask(user, task) {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  const uid = user._id.toString();
  if (task.createdBy && task.createdBy.toString() === uid) return true;
  const assigned = (task.assignedTo || []).map((id) => id.toString());
  return assigned.includes(uid);
}

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Private
router.get('/', auth, scopeMiddleware, async (req, res) => {
  try {
    const { status, priority, type, assignedTo, company, companyId, personnel, personnelId, dueDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    // v-incremental(2026-08-19) T03：assignedTo 过滤增强
    //   · 'me'        → 翻译为当前登录用户 req.user._id（前端不传真实 id，更安全）
    //   · 'a,b,c'     → { $in: [a,b,c] }（多值）
    //   · 单值         → 等值（保持原行为）
    if (assignedTo) {
      if (assignedTo === 'me') {
        query.assignedTo = req.user._id;
      } else if (assignedTo.includes(',')) {
        // P1 正确性/隐私修复（2026-08-20）：逗号分支同样翻译 'me' → 当前用户，
        // 避免 mixed 值（如 'me,otherId'）漏翻导致漏查本人任务及可探测 scope 内同事指派。
        query.assignedTo = {
          $in: assignedTo.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((tok) => (tok === 'me' ? req.user._id : tok)),
        };
      } else {
        query.assignedTo = assignedTo;
      }
    }
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

    // Wave 0 rev2 — 行级权限：非 admin/auditor 仅见 accessibleCompanies 内的公司任务
    applyListScope(query, req, 'company');

    const { page, limit, usePaging, skip } = parsePaging(req.query);
    const total = await Task.countDocuments(query);

    let q = Task.find(query).lean()
      .populate('company', 'name')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name')
      .populate('meeting', 'title date')
      .populate('personnel', 'name')
      .sort({ dueDate: 1 });
    if (usePaging) q = q.skip(skip).limit(limit);
    const tasks = await q;

    res.json(pagingEnvelope('tasks', tasks, { usePaging, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', auth, scopeMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean()
      .populate('company')
      .populate('assignedTo', 'name email phone role')
      .populate('createdBy', 'name email')
      .populate('completer', 'name email')
      .populate('meeting')
      .populate('notes.createdBy', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // Wave 0 rev2 — 行级权限：越权访问返回 403
    if (!inScope(req, task.company?._id || task.company)) {
      return res.status(403).json({ message: 'Access denied: task not in your accessible scope' });
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
    const body = { ...req.body };
    // 兼容前端自动归档：company / personnel / meeting 可能是 { _id, name } 对象
    if (body.company && typeof body.company === 'object' && body.company._id) body.company = body.company._id;
    if (body.personnel && typeof body.personnel === 'object' && body.personnel._id) body.personnel = body.personnel._id;
    if (body.meeting && typeof body.meeting === 'object' && body.meeting._id) body.meeting = body.meeting._id;
    if (body.sourceDocumentId) body.sourceDocumentId = String(body.sourceDocumentId);

    const task = await Task.create({
      ...body,
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
router.put('/:id', auth, scopeMiddleware, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // P0 安全修复（2026-08-20）：写接口挂载行级 scope 校验，确保只能操作本人 scope 内的任务，
    // 阻断「跨公司 PUT 自加为参与者 → 再 PUT completed 越权完成」的攻击链。
    const taskCompany = existing.company?._id || existing.company;
    if (!inScope(req, taskCompany)) {
      return res.status(403).json({
        message: 'Access denied: task not in your accessible scope',
      });
    }

    // P0 安全修复（2026-08-20）：assignedTo 变更闸门——
    // 仅 创建者 / admin / 原参与者 可修改参与者列表，防止 scope 内非授权用户自加为参与者后越权完成。
    if (req.body.assignedTo !== undefined) {
      const isAdmin = req.user.role === 'admin';
      const isCreator = existing.createdBy && existing.createdBy.toString() === req.user._id.toString();
      const isOriginalParticipant = (existing.assignedTo || [])
        .map((id) => id.toString())
        .includes(req.user._id.toString());
      if (!isAdmin && !isCreator && !isOriginalParticipant) {
        return res.status(403).json({
          message: 'Access denied: only the creator, an assignee, or admin may change task participants',
        });
      }
    }

    const updateData = { ...req.body };

    // v-incremental(2026-08-19) T04 / Q1 采纳收窄：
    // 仅当 status 置为 completed 时校验完成权限（admin / 创建者 / 参与者），
    // 非授权者返回 403；通过且完成时写入 completedDate 与完成人审计字段 completer（Q6）。
    if (req.body.status === 'completed') {
      if (!canCompleteTask(req.user, existing)) {
        return res.status(403).json({
          message: 'Access denied: only creator, an assignee, or admin may complete this task',
        });
      }
      if (!req.body.completedDate) {
        updateData.completedDate = new Date();
      }
      updateData.completer = req.user._id;
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
     .populate('assignedTo', 'name email role')
     .populate('completer', 'name email');

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
