const express = require('express');
const { adminAuth } = require('../middleware/auth');
const Announcement = require('../models/Announcement');

const router = express.Router();

// ── 公共读取：前台 Dashboard 走马灯（仅 active，按 order 升序）──
// 无需鉴权：公告为运营展示文本，且 Dashboard 已处于登录态；公开可避免冷启动 token 缺失时的 401。
router.get('/', async (req, res) => {
  try {
    const list = await Announcement.find({ active: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('[announcements] list failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 管理读取：全部（含 inactive）──
router.get('/all', adminAuth, async (req, res) => {
  try {
    const list = await Announcement.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('[announcements] list-all failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 新增 ──
router.post('/', adminAuth, async (req, res) => {
  try {
    const { eyebrow, title, subtitle, link, linkText, active, order } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }
    const ann = new Announcement({
      eyebrow: eyebrow || '',
      title: String(title).trim(),
      subtitle: subtitle || '',
      link: link || '',
      linkText: linkText || '',
      active: active !== false,
      order: Number(order) || 0,
      createdBy: (req.user && (req.user.email || req.user.name)) || 'admin',
    });
    await ann.save();
    res.json({ success: true, data: ann });
  } catch (err) {
    console.error('[announcements] create failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 更新（局部字段）──
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { eyebrow, title, subtitle, link, linkText, active, order } = req.body;
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ success: false, message: '公告不存在' });

    if (title !== undefined) ann.title = String(title).trim();
    if (eyebrow !== undefined) ann.eyebrow = eyebrow;
    if (subtitle !== undefined) ann.subtitle = subtitle;
    if (link !== undefined) ann.link = link;
    if (linkText !== undefined) ann.linkText = linkText;
    if (active !== undefined) ann.active = !!active;
    if (order !== undefined) ann.order = Number(order) || 0;

    await ann.save();
    res.json({ success: true, data: ann });
  } catch (err) {
    console.error('[announcements] update failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 删除 ──
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ success: false, message: '公告不存在' });
    res.json({ success: true, data: { _id: req.params.id } });
  } catch (err) {
    console.error('[announcements] delete failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 初始化默认公告（仅当库为空时种子，避免覆盖既有编辑）──
const DEFAULTS = [
  { eyebrow: '合规提醒', title: '周年申报表（NAR1）提交期限将至？', subtitle: '及时提交避免罚款，可在「合规提醒」一键生成关联任务并追踪进度。', order: 1 },
  { eyebrow: '文件归档', title: 'NAR1 / BR 证书一键归档至公司档案', subtitle: '上传即自动创建公司与人员关联，三层去重杜绝重复实体。', order: 2 },
  { eyebrow: '日程聚合', title: '合规、任务、会议、到期——一屏掌握', subtitle: '日历聚合视图按月份汇总全部待办来源，不再错过任何节点。', order: 3 },
];

router.post('/initialize', adminAuth, async (req, res) => {
  try {
    const count = await Announcement.estimatedDocumentCount();
    if (count > 0) {
      return res.json({ success: true, data: [], skipped: true, message: '已存在公告，跳过初始化' });
    }
    const created = await Announcement.insertMany(
      DEFAULTS.map((d) => ({ ...d, active: true, createdBy: 'seed' })),
    );
    res.json({ success: true, data: created, message: `已初始化 ${created.length} 条默认公告` });
  } catch (err) {
    console.error('[announcements] initialize failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
