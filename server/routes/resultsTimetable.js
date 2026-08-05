const express = require('express');
const ResultsTimetable = require('../models/ResultsTimetable');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const { generate } = require('../services/timetableEngine');
const XLSX = require('xlsx');

const router = express.Router();

// 优先级 / 状态 映射：skill(中文) → CSMS Task(英文枚举)
const PRI_MAP = { '最高优': 'urgent', '高优': 'high', '中优': 'medium', '低优': 'low' };
const STA_MAP = { '未启动': 'pending', '进行中': 'in_progress', '部分完成': 'in_progress', '已完成': 'completed' };

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// @route   POST /api/results-timetable/generate
// @desc    按锚点生成排期（落库 ResultsTimetable + 回写 Task）
router.post('/generate', auth, async (req, res) => {
  try {
    const { companyId, period, anchors = {}, fiscalYear, code, name } = req.body;
    if (!companyId || !period) {
      return res.status(400).json({ success: false, message: 'companyId 与 period 必填' });
    }
    if (!['interim', 'annual'].includes(period)) {
      return res.status(400).json({ success: false, message: 'period 须为 interim 或 annual' });
    }
    const uid = req.user.id || req.user._id;

    const overrides = {};
    ['T0', 'T1', 'T2', 'T3', 'T4'].forEach((k) => { if (anchors[k]) overrides[k] = anchors[k]; });
    const { anchors: calc, items } = generate(period, overrides);

    const doc = await ResultsTimetable.create({
      company: companyId,
      period,
      fiscalYear,
      code,
      name,
      anchors: { T0: calc.T0, T1: calc.T1, T2: calc.T2, T3: calc.T3, T4: calc.T4 },
      items: items.map((it) => ({ ...it, startDate: new Date(it.startDate), endDate: new Date(it.endDate) })),
      createdBy: uid,
    });

    // 回写 Task：先清同公司同期间旧排期任务，再批量重建，保证与排期一致
    await Task.deleteMany({ company: companyId, timetablePeriod: period, type: 'results_timetable' });
    const taskDocs = items.map((it) => ({
      title: it.title,
      description: it.steps,
      type: 'results_timetable',
      company: companyId,
      priority: PRI_MAP[it.priority] || 'medium',
      status: STA_MAP[it.status] || 'pending',
      dueDate: new Date(it.endDate),
      startDate: new Date(it.startDate),
      responsiblePerson: it.owner,
      ruleReference: it.rule,
      timetablePeriod: period,
      resultsTimetable: doc._id,
      notes: [{ content: `规则依据：${it.rule}\n步骤：${it.steps}\n负责中介：${it.agency}\n文件：${it.file}` }],
      createdBy: uid,
    }));
    await Task.insertMany(taskDocs);

    res.json({ success: true, id: doc._id, period, anchors: calc, items, tasksCreated: taskDocs.length });
  } catch (error) {
    console.error('[resultsTimetable] generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/list?company=
router.get('/list', auth, async (req, res) => {
  try {
    const q = {};
    if (req.query.company) q.company = req.query.company;
    if (req.query.period) q.period = req.query.period;
    const docs = await ResultsTimetable.find(q).populate('company', 'name code').sort('-createdAt').limit(50);
    res.json({ success: true, results: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await ResultsTimetable.findById(req.params.id).populate('company', 'name code');
    if (!doc) return res.status(404).json({ success: false, message: '未找到排期' });
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/:id/excel
// @desc    导出参数驱动 Excel（快照：实际计算日期；联动由数据库/前端驱动）
router.get('/:id/excel', auth, async (req, res) => {
  try {
    const doc = await ResultsTimetable.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: '未找到排期' });

    const wb = XLSX.utils.book_new();

    // 参数表
    const paramRows = [['参数', '日期']];
    ['T0', 'T1', 'T2', 'T3', 'T4'].forEach((k) => {
      if (doc.anchors[k]) paramRows.push([k, fmtDate(doc.anchors[k])]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramRows), '参数表');

    // 任务信息表
    const taskRows = [['大类', '规则依据', '任务名称', '操作步骤', '优先级', '状态', '项目', '负责人', '中介', '启动', '截止', '文件', '备注']];
    doc.items.forEach((it) => {
      taskRows.push([it.category, it.rule, it.title, it.steps, it.priority, it.status,
        it.project, it.owner, it.agency, fmtDate(it.startDate), fmtDate(it.endDate), it.file, it.note]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(taskRows), '任务信息表');

    // 进度总览
    const cats = {};
    doc.items.forEach((it) => {
      cats[it.category] = cats[it.category] || { t: 0, d: 0 };
      cats[it.category].t += 1;
      if (it.status === '已完成') cats[it.category].d += 1;
    });
    const progRows = [['大类', '总数', '已完成', '完成率']];
    Object.entries(cats).forEach(([c, v]) => {
      progRows.push([c, v.t, v.d, v.t ? `${Math.round((100 * v.d) / v.t)}%` : '0%']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(progRows), '进度总览');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const label = periodLabel(doc.period);
    res.setHeader('Content-Disposition', `attachment; filename=${doc.code || '1321'}_${label}业绩排期.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function periodLabel(p) { return p === 'annual' ? '年度' : '中期'; }

module.exports = router;
