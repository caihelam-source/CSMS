const express = require('express');
const multer = require('multer');
const vm = require('vm');
const ResultsTimetable = require('../models/ResultsTimetable');
const RuleLibrary = require('../models/RuleLibrary');
const Task = require('../models/Task');
const { auth, adminAuth } = require('../middleware/auth');
const {
  generate,
  computeOffsets,
  complianceChecks,
  parseDate,
  fmt,
  getRule,
  partyLabel,
  getSeed,
  isLibrary,
} = require('../services/timetableEngine');
const RULES = require('../services/timetableData');
const XLSX = require('xlsx');

const router = express.Router();

/**
 * 规则文件上传专用 multer 实例（内存存储）。
 *
 * 为什么不用 `../middleware/upload`：该共享实例的 fileFilter 只放行
 * PDF/DOC/XLS/图片 mimetype，会直接拒掉 `.js` / `.json` 规则文件；
 * 且它落盘到 uploads/ 目录，而规则导入只需一次性解析、无须留存原始文件。
 */
const ruleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 规则库全文约 100KB，5MB 足够
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (name.endsWith('.js') || name.endsWith('.json')) return cb(null, true);
    return cb(new Error('仅支持 .js 或 .json 规则文件'), false);
  },
});

/** multer 错误码 → 中文提示（仅覆盖本路由可能触发的两类）。 */
const MULTER_MSG = {
  LIMIT_FILE_SIZE: '文件过大，规则文件不得超过 5MB',
  LIMIT_UNEXPECTED_FILE: '文件字段名不正确，须为 file',
};

/**
 * 包装 `ruleUpload.single('file')`，把 multer 的错误就地转成 400 JSON。
 *
 * 为什么必须包：fileFilter 抛错与 LIMIT_FILE_SIZE 都走 `next(err)` 冒泡，
 * 而 server/index.js 没有 app 级错误中间件，最终由 Express 默认处理器返回
 * **HTML 500**（开发态还带堆栈）。前端读 `err.response.data.message` 会取空，
 * 用户只看到 "Request failed with status code 500"，中文提示永远不可达。
 * 前端 `accept=".js,.json"` 只是文件对话框的筛选建议，切「所有文件」即可绕过，
 * 所以这条路径是真实可达的。
 */
const ruleUploadSafe = (req, res, next) => {
  ruleUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = MULTER_MSG[err.code] || err.message || '文件上传失败';
    return res.status(400).json({ success: false, message });
  });
};

// 优先级 / 状态 映射：规则库(中文) → CSMS Task(英文枚举)
const PRI_MAP = { '最高优': 'urgent', '高优': 'high', '中优': 'medium', '低优': 'low' };
const STA_MAP = { '未启动': 'pending', '进行中': 'in_progress', '部分完成': 'in_progress', '已完成': 'completed' };

const ANCHOR_KEYS = ['T0', 'T1', 'T2', 'T3', 'T4'];

/** 规则库文档的业务字段（用于组装 / 清洗，剔除 _id、__v 等 mongo 内部字段）。 */
const LIB_FIELDS = [
  'version', 'meta', 'parties', 'rules',
  'offsets_midyear', 'offsets_annual', 'tasks_midyear', 'tasks_annual',
];

function periodLabel(p) {
  return p === 'annual' ? '年度' : '中期';
}

/** Date | ISO 串 → 'YYYY-MM-DD'（空值安全）。 */
function fmtDate(d) {
  return fmt(parseDate(d));
}

/** 任务日期列：时点=单日，区间='起 — 止'（复刻参考生成器）。 */
function dateCell(start, end) {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e && s !== e) return `${s} — ${e}`;
  return s || e || '';
}

/** 仅保留有值的锚点，转为 Date（存库用）。 */
function anchorsToDates(anchors) {
  const out = {};
  ANCHOR_KEYS.forEach((k) => { out[k] = anchors[k] ? parseDate(anchors[k]) : null; });
  return out;
}

// ───────────────────────── 规则库（RuleLibrary）辅助 ─────────────────────────

/** 种子（timetableData.js）→ RuleLibrary 文档形状。revision 固定 0，标记「未落库」。 */
function seedToDoc() {
  const seed = getSeed() || RULES;
  return {
    version: (seed.meta && seed.meta.version) || '2026-01',
    revision: 0,
    meta: seed.meta || {},
    parties: seed.parties || {},
    rules: seed.rules || {},
    offsets_midyear: seed.offsets_midyear || [],
    offsets_annual: seed.offsets_annual || [],
    tasks_midyear: seed.tasks_midyear || [],
    tasks_annual: seed.tasks_annual || [],
  };
}

/**
 * 载入运行时规则库：库中有单例文档就用它，否则回落种子。
 * 懒写入策略：此处 **不** 主动落库，只有 PUT /rules 或 POST /rules/import 才写。
 * @returns {Promise<object>} 普通对象（已 toObject，供引擎与 JSON 序列化直接使用）
 */
async function loadLibrary() {
  try {
    const doc = await RuleLibrary.findOne({}).lean();
    if (doc && Array.isArray(doc.tasks_midyear) && Array.isArray(doc.tasks_annual)) {
      // 旧单例文档可能缺 revision 字段（快照改动前的「规则库后台管理」写入的）：
      // 有文档即代表已落库，revision 至少记为 1，避免徽标误显「（内置种子 · 规则库尚未落库）」。
      // 种子路径（seedToDoc）保持 revision: 0 不变，persistLibrary 的 +1 逻辑亦不受影响。
      doc.revision = Number(doc.revision) || 1;
      return doc;
    }
  } catch (err) {
    console.error('[resultsTimetable] loadLibrary failed, fallback to seed:', err.message);
  }
  return seedToDoc();
}

/**
 * 规则库形状校验。
 * @param {any} lib
 * @returns {{ valid: boolean, message: string }}
 */
function validateLibrary(lib) {
  if (!lib || typeof lib !== 'object' || Array.isArray(lib)) {
    return { valid: false, message: '规则库须为对象' };
  }
  const arrays = ['offsets_midyear', 'offsets_annual', 'tasks_midyear', 'tasks_annual'];
  for (const k of arrays) {
    if (!Array.isArray(lib[k])) return { valid: false, message: `字段 ${k} 须为数组` };
  }
  if (!lib.tasks_midyear.length && !lib.tasks_annual.length) {
    return { valid: false, message: '中期与年度任务不可同时为空' };
  }
  if (lib.parties && (typeof lib.parties !== 'object' || Array.isArray(lib.parties))) {
    return { valid: false, message: '字段 parties 须为对象' };
  }
  if (lib.rules && (typeof lib.rules !== 'object' || Array.isArray(lib.rules))) {
    return { valid: false, message: '字段 rules 须为对象' };
  }
  return { valid: true, message: '' };
}

/** 只取业务字段，剔除 _id / __v / updatedBy 等由服务端掌控的字段。 */
function pickLibFields(src) {
  const out = {};
  LIB_FIELDS.forEach((k) => {
    if (src[k] !== undefined) out[k] = src[k];
  });
  if (!out.version) out.version = (out.meta && out.meta.version) || '2026-01';
  return out;
}

/** 请求发起人标识（用于 updatedBy 审计字段）。 */
function actorId(req) {
  const u = req.user || {};
  return (u._id && u._id.toString()) || u.id || u.email || 'admin';
}

/** 规则文件里可能出现的赋值前缀（定位对象字面量的起点）。 */
const RULE_ASSIGN_MARKERS = [
  /window\s*\.\s*RULES_DATA\s*=/,
  /module\s*\.\s*exports\s*=/,
  /exports\s*\.\s*default\s*=/,
  /export\s+default\s+/,
];

/**
 * 从规则文件文本中截取对象字面量。
 *
 * ⚠️ 不能直接用 `indexOf('{')`：种子文件 `timetableData.js` 的头部注释里
 * 就有 `{ meta, parties, rules, ... }` 字样，会被误当成字面量起点。
 * 因此优先按赋值前缀定位，再从前缀之后找第一个 `{`；
 * 没有赋值前缀时（整文件即字面量）先剥掉整行 `//` 注释再定位。
 *
 * @param {string} text 文件全文
 * @returns {string|null} 对象字面量源码；定位失败返回 null
 */
function extractObjectLiteral(text) {
  for (const marker of RULE_ASSIGN_MARKERS) {
    const m = text.match(marker);
    if (!m) continue;
    const start = text.indexOf('{', m.index + m[0].length);
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return text.slice(start, end + 1);
  }
  const stripped = text.replace(/^\s*\/\/.*$/gm, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);
  return null;
}

/**
 * 解析上传的规则文件。
 * 支持四种载体：
 *   1) `.json` —— 直接 JSON.parse
 *   2) `.js` 里的 `window.RULES_DATA = {...};`
 *   3) `.js` 里的 `module.exports = {...};` / `export default {...}`
 *   4) `.js` 里裸对象字面量
 * 统一策略：先 JSON.parse（转换后的规则库是严格 JSON），
 * 失败再用 `vm` 在空沙箱中求值（容忍不带引号的键 / 单引号 / 注释）。
 *
 * @param {Buffer} buffer 文件内容
 * @param {string} filename 原始文件名（决定是否走纯 JSON 分支）
 * @returns {object} 解析出的规则库对象
 * @throws {Error} 解析失败
 */
function parseRuleFile(buffer, filename) {
  const text = String(buffer.toString('utf8')).replace(/^\uFEFF/, '');
  const lower = String(filename || '').toLowerCase();

  if (lower.endsWith('.json')) {
    return JSON.parse(text);
  }

  const literal = extractObjectLiteral(text);
  if (!literal) {
    throw new Error('未在文件中找到对象字面量（期望 window.RULES_DATA = {...} 或 module.exports = {...}）');
  }

  try {
    return JSON.parse(literal);
  } catch {
    // 退化路径：空沙箱求值，无 require / process / window，2 秒超时
    const script = new vm.Script(`(${literal})`);
    const ctx = vm.createContext(Object.create(null));
    const result = script.runInContext(ctx, { timeout: 2000 });
    if (!result || typeof result !== 'object') throw new Error('规则文件求值结果不是对象');
    // 结构化克隆，切断与沙箱上下文的原型链
    return JSON.parse(JSON.stringify(result));
  }
}

/**
 * 构建「规则出处文本 → 规则条目」反查索引。
 *
 * 落库的 `item.rule` 存的是生成当时的 `getRule(code).source`（见 timetableEngine.generate），
 * 属于**快照**；导出时需据此回捞原文关键句 `text`。
 * 索引同时收录 code 与 source 两种键，覆盖 source 缺失时 generate 回落 code 的情况。
 *
 * @param {object} lib 规则库
 * @returns {Map<string, {source:string,text:string,interpretation:string}>}
 */
function buildRuleIndex(lib) {
  const idx = new Map();
  Object.entries((lib && lib.rules) || {}).forEach(([code, r]) => {
    const entry = {
      source: (r && r.source) || code,
      text: (r && r.text) || '',
      interpretation: (r && r.interpretation) || '',
    };
    if (!idx.has(code)) idx.set(code, entry);
    if (entry.source && !idx.has(entry.source)) idx.set(entry.source, entry);
  });
  return idx;
}

/** 规则库统计计数（导入 / 保存后回执用）。 */
function libraryCounts(lib) {
  return {
    rules: Object.keys(lib.rules || {}).length,
    parties: Object.keys(lib.parties || {}).length,
    offM: (lib.offsets_midyear || []).length,
    offA: (lib.offsets_annual || []).length,
    taskM: (lib.tasks_midyear || []).length,
    taskA: (lib.tasks_annual || []).length,
  };
}

/**
 * 单例写入：整库覆盖式 upsert，并把修订号 `revision` +1。
 *
 * 为什么先读后写而不用 `$inc`：`setDefaultsOnInsert` 会为「未出现在 update 中的路径」
 * 补 `$setOnInsert`，与 `$inc` 同时命中 revision 时 MongoDB 会报路径冲突。
 * 规则库是单例配置文档、只有 admin 手动保存/导入两条写路径，并发可忽略，
 * 读取当前值 +1 更直白也更好排查。首次落库（库中无文档）→ revision = 1。
 *
 * `pickLibFields` 只放行业务字段，客户端无法伪造 revision / updatedBy。
 */
async function persistLibrary(payload, req) {
  const current = await RuleLibrary.findOne({}).select('revision').lean();
  const currentRevision = Number(current && current.revision);
  const nextRevision = Number.isFinite(currentRevision) && currentRevision > 0 ? currentRevision + 1 : 1;

  return RuleLibrary.findOneAndUpdate(
    {},
    {
      ...pickLibFields(payload),
      revision: nextRevision,
      updatedBy: actorId(req),
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

// ─────────────────── 规则库版本快照（写入排期结果文档） ───────────────────

/**
 * 构造「生成时刻」的规则库快照。
 *
 * 快照随 ResultsTimetable 一并落库，此后规则库被改写 / 重新导入都不影响历史排期：
 * 重算偏移量、合规自检与规则出处时一律优先用快照（见 libraryForDoc）。
 *
 * @param {object} lib loadLibrary() 的返回值（DB 单例文档或种子）
 * @returns {object} 与 RuleLibrary 同形状 + generatedAt
 */
function buildLibrarySnapshot(lib) {
  const src = lib || {};
  return {
    version: src.version || (src.meta && src.meta.version) || '',
    revision: Number(src.revision) || 0,
    meta: src.meta || {},
    parties: src.parties || {},
    rules: src.rules || {},
    offsets_midyear: src.offsets_midyear || [],
    offsets_annual: src.offsets_annual || [],
    tasks_midyear: src.tasks_midyear || [],
    tasks_annual: src.tasks_annual || [],
    // 引擎当前把合规检查项硬编码在代码里，规则库尚无此字段；预留以便日后规则化
    compliance_checks: src.compliance_checks || {},
    generatedAt: new Date(),
  };
}

/**
 * 取「该排期文档应当使用的规则库」：优先生成时快照，其次当下规则库。
 *
 * 用引擎自己的 `isLibrary` 把关（而非另写一套判定），保证「路由认为快照可用」
 * 与「引擎 resolveLibrary 真的会采用它」两个判断永远一致——否则形状不合格时
 * 引擎会静默回落种子，而路由还以为在用快照。
 * 回落分支服务于本功能上线前生成的历史文档（无快照字段），行为与改动前一致。
 *
 * @param {object} doc ResultsTimetable 文档
 * @returns {Promise<object>} 规则库对象
 */
async function libraryForDoc(doc) {
  const snap = doc && doc.ruleLibrarySnapshot;
  if (isLibrary(snap)) return snap;
  return loadLibrary();
}

// ─────────────────────────────── 排期生成 ───────────────────────────────

// @route   POST /api/results-timetable/generate
// @desc    按锚点生成排期（落库 ResultsTimetable + 回写 Task），返回合规自检结果
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
    ANCHOR_KEYS.forEach((k) => { if (anchors[k]) overrides[k] = anchors[k]; });

    // 规则库真源：MongoDB RuleLibrary（为空时回落 timetableData.js 种子）
    const lib = await loadLibrary();
    const { anchors: calc, items, compliance, offsets } = generate(period, overrides, lib);

    // 版本水印 + 全量快照：把「本次用的是哪一版规则库、内容是什么」钉死在结果上，
    // 之后 admin 改库 / 重新导入都不会让这份历史排期跟着漂移
    const snapshot = buildLibrarySnapshot(lib);

    // upsert：同 company + period 先删旧排期，避免历史列表堆积重复记录
    await ResultsTimetable.deleteMany({ company: companyId, period });

    const doc = await ResultsTimetable.create({
      company: companyId,
      period,
      fiscalYear,
      code,
      name,
      anchors: anchorsToDates(calc),
      items: items.map((it) => ({
        ...it,
        startDate: it.startDate ? parseDate(it.startDate) : null,
        endDate: it.endDate ? parseDate(it.endDate) : null,
      })),
      ruleLibraryVersion: snapshot.revision,
      ruleLibrarySnapshot: snapshot,
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
      dueDate: it.endDate ? parseDate(it.endDate) : null,
      startDate: it.startDate ? parseDate(it.startDate) : null,
      responsiblePerson: it.owner,
      ruleReference: it.rule,
      timetablePeriod: period,
      resultsTimetable: doc._id,
      notes: [{ content: `规则依据：${it.rule}\n步骤：${it.steps}\n负责中介：${it.agency}` }],
      createdBy: uid,
    }));
    await Task.insertMany(taskDocs);

    res.json({
      success: true,
      id: doc._id,
      period,
      anchors: calc,
      items,
      count: items.length,
      tasksCreated: taskDocs.length,
      compliance,
      // 规则库水印随响应下发：预览页直接渲染「规则库版本 vX · 快照于 …」，无需二次请求
      ruleLibraryVersion: snapshot.revision,
      ruleLibrarySnapshot: snapshot,
      // 偏移量随响应下发：前端「主要事项」表与打印版 Word 直接取用，不在前端复算规则
      offsets: offsets.map((o) => ({ id: o.id, name: o.name, anchor: o.anchor, days: o.days, date: o.dateStr })),
    });
  } catch (error) {
    console.error('[resultsTimetable] generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────── 规则库管理（必须全部定义在 '/:id' 之前） ───────────────────

// @route   GET /api/results-timetable/rules
// @desc    规则库全量读取（DB 单例优先，缺省回落种子）
// @access  auth（所有登录用户可读；编辑仅 admin）
// @note    必须定义在 '/:id' 之前，否则会被参数路由捕获
router.get('/rules', auth, async (req, res) => {
  try {
    const lib = await loadLibrary();
    res.json({ success: true, data: lib });
  } catch (error) {
    console.error('[resultsTimetable] get rules error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/results-timetable/rules
// @desc    整库覆盖保存（Admin Panel「业绩排期规则库」微调后提交）
// @access  adminAuth
router.put('/rules', adminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const { valid, message } = validateLibrary(body);
    if (!valid) return res.status(400).json({ success: false, message });

    const saved = await persistLibrary(body, req);
    res.json({ success: true, data: saved, counts: libraryCounts(saved) });
  } catch (error) {
    console.error('[resultsTimetable] save rules error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/results-timetable/rules/import
// @desc    上传 rules 文件（.js / .json）整库导入
// @access  adminAuth
router.post('/rules/import', adminAuth, ruleUploadSafe, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: '未收到文件（字段名须为 file）' });
    }

    let parsed = null;
    try {
      parsed = parseRuleFile(req.file.buffer, req.file.originalname);
    } catch (err) {
      return res.status(400).json({ success: false, message: `规则文件解析失败：${err.message}` });
    }

    const { valid, message } = validateLibrary(parsed);
    if (!valid) return res.status(400).json({ success: false, message: `规则文件校验失败：${message}` });

    const saved = await persistLibrary(parsed, req);
    res.json({
      success: true,
      data: {
        ok: true,
        filename: req.file.originalname,
        version: saved.version,
        counts: libraryCounts(saved),
      },
    });
  } catch (error) {
    console.error('[resultsTimetable] import rules error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/list?company=&period=
router.get('/list', auth, async (req, res) => {
  try {
    const q = {};
    if (req.query.company) q.company = req.query.company;
    if (req.query.period) q.period = req.query.period;
    // 列表刻意剔除 ruleLibrarySnapshot（整份规则库约百 KB，50 条会把响应撑到数 MB）；
    // ruleLibraryVersion 是标量，保留以便列表页直接标注版本
    const docs = await ResultsTimetable.find(q).lean()
      .select('-ruleLibrarySnapshot')
      .populate('company', 'name code')
      .sort('-createdAt')
      .limit(50);
    res.json({ success: true, results: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await ResultsTimetable.findById(req.params.id).lean().populate('company', 'name code');
    if (!doc) return res.status(404).json({ success: false, message: '未找到排期' });

    // 依据落库锚点重算偏移量与合规自检，供前端「主要事项」表 / 合规面板 / 打印版 Word 使用。
    // 规则库须与**生成当时**一致：优先用结果文档里的快照，缺快照的历史文档才回落当下库。
    const lib = await libraryForDoc(doc);
    const period = doc.period === 'annual' ? 'annual' : 'interim';
    const anchors = {};
    ANCHOR_KEYS.forEach((k) => { anchors[k] = doc.anchors && doc.anchors[k] ? parseDate(doc.anchors[k]) : null; });
    const offsetMap = computeOffsets(period, anchors, lib);

    res.json({
      success: true,
      data: doc,
      compliance: complianceChecks(period, anchors, offsetMap),
      offsets: offsetMap._list.map((o) => ({ id: o.id, name: o.name, anchor: o.anchor, days: o.days, date: o.dateStr })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/results-timetable/:id/excel
// @desc    导出参数驱动 Excel（4 表，结构对齐参考生成器 exportExcel）
router.get('/:id/excel', auth, async (req, res) => {
  try {
    const doc = await ResultsTimetable.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: '未找到排期' });

    // 导出必须复现「生成当天出具的那一版」：规则库同样优先取结果文档里的快照
    const lib = await libraryForDoc(doc);
    const period = doc.period === 'annual' ? 'annual' : 'interim';
    const anchors = {};
    ANCHOR_KEYS.forEach((k) => { anchors[k] = doc.anchors && doc.anchors[k] ? parseDate(doc.anchors[k]) : null; });

    // 依据落库锚点重算偏移量（Sheet2 用）
    const offsetMap = computeOffsets(period, anchors, lib);
    // Sheet3 的规则出处以落库快照 item.rule 为准，仅用索引回捞原文，不再重算任务
    const ruleIndex = buildRuleIndex(lib);

    const wb = XLSX.utils.book_new();

    // ---- Sheet 1：参数表 ----
    const anchorKeysForPeriod = period === 'annual' ? ANCHOR_KEYS : ['T0', 'T1', 'T2'];
    const paramRows = [['参数', '日期']];
    anchorKeysForPeriod.forEach((k) => { paramRows.push([k, fmt(anchors[k])]); });
    // 规则库水印：让导出件自带「这份表是按哪一版规则库算出来的」，便于事后对账
    const snap = doc.ruleLibrarySnapshot || null;
    paramRows.push(['规则库版本', `v${Number(doc.ruleLibraryVersion) || 0}`]);
    if (snap && snap.generatedAt) paramRows.push(['规则快照时间', fmtDate(snap.generatedAt)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramRows), '参数表');

    // ---- Sheet 2：偏移量 ----
    const offRows = [['偏移量名称', '偏移天数', '绑定锚点', '计算日期', '规则出处', '原文关键句', '实务解读']];
    offsetMap._list.forEach((o) => {
      const r = getRule(o.ruleCode, lib);
      offRows.push([o.name, o.days, o.anchor, o.dateStr, r.source, r.text, o.interpretation || r.interpretation]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(offRows), '偏移量');

    // ---- Sheet 3：任务信息 ----
    //
    // ⚠️ 规则出处必须取落库快照 `it.rule`，**不可**用 computeTasks 的结果按索引配对。
    // `doc.items` 是生成时的快照，而 computeTasks 用的是「当下规则库」；
    // admin 一旦在生成后禁用/增删任务，两个数组的长度与顺序即错位，
    // 会把 A 任务的规则出处静默写到 B 任务行上（这是给监管/董事会看的合规表，不可接受）。
    // 原文关键句改由 ruleIndex 按出处文本回捞，取不到时留空而非错取。
    const taskRows = [['大类', '日期', '规则出处', '原文关键句', '任务名称', '操作步骤', '负责人', '优先级']];
    doc.items.forEach((it) => {
      const src = it.rule || '';
      const r = ruleIndex.get(src);
      taskRows.push([
        it.category || '',
        dateCell(it.startDate, it.endDate),
        src,
        (r && r.text) || '',
        it.title || '',
        it.steps || '',
        it.owner || '',
        it.priority || '',
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(taskRows), '任务信息');

    // ---- Sheet 4：参与方配置 ----
    const partyRows = [['身份Key', '显示名称']];
    Object.keys(lib.parties || {}).forEach((k) => { partyRows.push([k, partyLabel(k, lib)]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partyRows), '参与方配置');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const label = periodLabel(doc.period);
    const filename = `${doc.code || '1321'}_${label}业绩排期.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('[resultsTimetable] excel error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
