/**
 * 文书模板路由（v2 · Schema 驱动引擎）。
 *
 * 契约要点（见 docs/design-template-module-v2.md §3.6）：
 *   GET    /api/templates              auth       → { success, count, templates }
 *   GET    /api/templates/:id          auth       → { success, template }
 *   POST   /api/templates              editorAuth → 201 { success, template }
 *   PUT    /api/templates/:id          editorAuth → { success, template }
 *   DELETE /api/templates/:id          editorAuth → { success } / 403（isPreset）
 *   POST   /api/templates/:id/duplicate editorAuth → 201 { success, template }
 *   POST   /api/templates/:id/resolve  auth       → { success, values, autoFilled }
 *   POST   /api/templates/initialize   editorAuth → { success, deleted, upserted }
 *
 * ⭐ B3：`POST /:id/render` 整条路由已删除（Q1 废弃 {{变量}} 字符串替换 + Q2 渲染移前端）。
 * ⭐ B4：category 校验取自 shared/templateCategories.json 单一事实源。
 * ⭐ Q4 → D4 修订：所有写操作（POST / PUT / DELETE / duplicate / initialize）改为 editorAuth
 *    （admin 或 secretary），即模板管理权限下放给秘书 / 合规人员。
 *    ※ User.role enum 无 'compliance'，合规人员统一归入 secretary 角色（决策 4 · 方案甲）。
 *
 * ⚠️ Mixed 写入约定（设计 §7.7）：
 *    · POST     → Model.create({ docSchema })          不需要 markModified
 *    · PUT      → findById → 就地改 → save()            **必须** markModified
 *    · initialize → findOneAndUpdate + $set 显式路径     不需要 markModified
 *    禁止 findByIdAndUpdate(id, { ...req.body }) 把 Mixed 铺开写。
 */

const express = require('express');
const DocumentTemplate = require('../models/DocumentTemplate');
const { auth, editorAuth } = require('../middleware/auth');
const {
  SCHEMA_VERSION,
  CATEGORY_VALUES,
  SchemaValidationError,
  assertValidDocSchema,
  deriveVariables,
  isValidCategory,
} = require('../constants/templateSchema');
const { getPresets } = require('../data/templatePresets');
const { resolveValues } = require('../services/templateResolver');

const router = express.Router();

/** versionHistory 保留条数上限，防文档膨胀 */
const VERSION_HISTORY_LIMIT = 20;

/**
 * 统一错误响应：契约校验错误 → 400，Mongoose 校验错误 → 400，其余 → 500。
 * @param {import('express').Response} res Express 响应对象
 * @param {Error} err 捕获到的错误
 * @returns {import('express').Response} 已发送的响应
 */
function sendError(res, err) {
  if (err instanceof SchemaValidationError) {
    return res.status(400).json({ success: false, message: `docSchema 契约校验失败：${err.message}` });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `参数格式错误：${err.path}` });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: '唯一键冲突（presetKey 已存在）' });
  }
  return res.status(500).json({ success: false, message: err && err.message ? err.message : 'Internal error' });
}

/**
 * 校验并归一化 category。
 * @param {unknown} category 客户端传入的分类
 * @returns {string} 合法分类值
 * @throws {SchemaValidationError} 不在 12 项白名单内
 */
function normalizeCategory(category) {
  if (category === undefined || category === null || category === '') return 'other';
  if (!isValidCategory(category)) {
    throw new SchemaValidationError(
      `category「${String(category)}」不在白名单，仅允许 ${CATEGORY_VALUES.join(' / ')}`
    );
  }
  return category;
}

/**
 * 归一化 annualCycle 锚点（本期只存不用）。
 * @param {unknown} input 客户端传入值
 * @returns {{enabled:boolean, fiscalYearField:string, taskGroupKey:string}} 归一化结果
 */
function normalizeAnnualCycle(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    enabled: src.enabled === true,
    fiscalYearField: typeof src.fiscalYearField === 'string' ? src.fiscalYearField : '',
    taskGroupKey: typeof src.taskGroupKey === 'string' ? src.taskGroupKey : '',
  };
}

// ──────────────────────────────────────────────────────────────
// POST /api/templates/initialize — 清旧 + 幂等写入 6 个内置模板（O4）
// ⚠️ 必须声明在 /:id 系列之前，避免 'initialize' 被当成 :id 捕获。
// ──────────────────────────────────────────────────────────────
router.post('/initialize', editorAuth, async (req, res) => {
  try {
    // 步骤 1（不可逆 · 清旧）：删除旧 HTML 引擎存量与无 schema 的历史记录。
    // ⚠️ 顺序不可颠倒：必须先删后写，否则会把刚 upsert 的新 preset 一并删掉。
    const deleteResult = await DocumentTemplate.deleteMany({
      $or: [
        { engine: 'html' },
        { engine: { $exists: false } },
        { docSchema: { $exists: false } },
        { docSchema: null },
        { docSchema: {} },
      ],
    });
    const deleted = deleteResult && typeof deleteResult.deletedCount === 'number' ? deleteResult.deletedCount : 0;

    // 步骤 2（幂等 · 写新）：presetKey 唯一稀疏索引 ⇒ 重复调用不产生重复数据。
    const presets = getPresets();
    let upserted = 0;
    for (const preset of presets) {
      assertValidDocSchema(preset.docSchema);
      await DocumentTemplate.findOneAndUpdate(
        { presetKey: preset.presetKey },
        {
          // $set 为显式路径赋值 → Mixed 正常持久化，无需 markModified
          $set: {
            name: preset.name,
            description: preset.description || '',
            category: normalizeCategory(preset.category),
            engine: 'schema',
            schemaVersion: preset.schemaVersion || SCHEMA_VERSION,
            docSchema: preset.docSchema,
            sampleData: preset.sampleData || {},
            variables: deriveVariables(preset.docSchema),
            isPreset: true,
          },
          $setOnInsert: {
            version: 1,
            versionHistory: [],
            createdBy: req.user._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      upserted += 1;
    }

    return res.json({ success: true, deleted, upserted });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/templates — 列表
// ──────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const templates = await DocumentTemplate.find(query)
      .populate('company', 'name')
      .sort({ isPreset: -1, name: 1 });
    // ⭐ B1：顶层键为复数 `templates`，前端 responseNormalize 的 ENTITY_KEYS 已同步补齐。
    return res.json({ success: true, count: templates.length, templates });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/templates/:id — 单条
// ──────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id).populate('company', 'name');
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    return res.json({ success: true, template });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/templates — 新建（仅 admin）
// ──────────────────────────────────────────────────────────────
router.post('/', editorAuth, async (req, res) => {
  try {
    const { name, description, docSchema, sampleData, company, annualCycle } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: '模板名称不能为空' });
    }
    const category = normalizeCategory(req.body ? req.body.category : undefined);
    const schemaBody = docSchema === undefined ? { schemaVersion: SCHEMA_VERSION, layoutMode: 'auto', fields: [] } : docSchema;
    assertValidDocSchema(schemaBody);

    const template = await DocumentTemplate.create({
      name: name.trim(),
      description: typeof description === 'string' ? description : '',
      category,
      engine: 'schema',
      schemaVersion: SCHEMA_VERSION,
      docSchema: schemaBody,
      sampleData: sampleData && typeof sampleData === 'object' ? sampleData : {},
      // ⭐ variables 一律服务端派生，忽略客户端传入
      variables: deriveVariables(schemaBody),
      company: company || undefined,
      isPreset: false,
      version: 1,
      versionHistory: [],
      annualCycle: normalizeAnnualCycle(annualCycle),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json({ success: true, template });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/templates/:id — 更新（仅 admin）
// ⚠️ hydrate 后就地改 Mixed ⇒ 必须 markModified，否则改动静默丢失。
// ──────────────────────────────────────────────────────────────
router.put('/:id', editorAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).json({ success: false, message: '模板名称不能为空' });
      }
      template.name = body.name.trim();
    }
    if (body.description !== undefined) {
      template.description = typeof body.description === 'string' ? body.description : '';
    }
    if (body.category !== undefined) {
      template.category = normalizeCategory(body.category);
    }
    if (body.company !== undefined) {
      template.company = body.company || undefined;
    }

    if (body.docSchema !== undefined) {
      assertValidDocSchema(body.docSchema);
      const previous = template.docSchema || {};
      const changed = JSON.stringify(previous) !== JSON.stringify(body.docSchema);

      if (changed) {
        // Q6：先把旧版压入 versionHistory（保留最近 20 条），再 version + 1
        const history = Array.isArray(template.versionHistory) ? template.versionHistory.slice() : [];
        history.push({
          version: template.version || 1,
          docSchema: previous,
          note: typeof body.versionNote === 'string' ? body.versionNote : '',
          updatedBy: req.user._id,
          updatedAt: new Date(),
        });
        template.versionHistory = history.slice(-VERSION_HISTORY_LIMIT);
        template.markModified('versionHistory');
        template.version = (template.version || 1) + 1;
      }

      template.docSchema = body.docSchema;
      template.markModified('docSchema');
      template.variables = deriveVariables(body.docSchema);
      template.schemaVersion = SCHEMA_VERSION;
    }

    if (body.sampleData !== undefined) {
      template.sampleData = body.sampleData && typeof body.sampleData === 'object' ? body.sampleData : {};
      template.markModified('sampleData');
    }

    if (body.annualCycle !== undefined) {
      template.annualCycle = normalizeAnnualCycle(body.annualCycle);
      template.markModified('annualCycle');
    }

    template.engine = 'schema';
    template.updatedBy = req.user._id;
    await template.save();

    return res.json({ success: true, template });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/templates/:id — 删除（仅 admin；内置模板拒绝删除）
// ──────────────────────────────────────────────────────────────
router.delete('/:id', editorAuth, async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (template.isPreset) {
      // 403 Forbidden：内置模板受保护，任何角色（含 admin）均不可删除。
      // ⚠️ 状态码以设计 §3.6 / T01 验收点 5 为准，不可改为 409。
      return res.status(403).json({ success: false, message: '预设模板不可删除' });
    }
    await template.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/templates/:id/duplicate — 另存副本（R-P1-6，仅 admin）
// ──────────────────────────────────────────────────────────────
router.post('/:id/duplicate', editorAuth, async (req, res) => {
  try {
    const source = await DocumentTemplate.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ success: false, message: 'Template not found' });

    const requestedName = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const copy = await DocumentTemplate.create({
      name: requestedName || `${source.name}（副本）`,
      description: source.description || '',
      category: source.category || 'other',
      engine: 'schema',
      schemaVersion: source.schemaVersion || SCHEMA_VERSION,
      docSchema: source.docSchema || {},
      sampleData: source.sampleData || {},
      variables: deriveVariables(source.docSchema),
      company: source.company || undefined,
      // 副本永远不是内置模板，且不继承 presetKey（保持唯一稀疏索引干净）
      isPreset: false,
      version: 1,
      versionHistory: [],
      annualCycle: normalizeAnnualCycle(source.annualCycle),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json({ success: true, template: copy });
  } catch (err) {
    return sendError(res, err);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/templates/:id/resolve — 公司/系统变量预填（R-P1-1）
// ⭐ 取代已删除的 /:id/render：只返回值，不返回任何 HTML。
// ──────────────────────────────────────────────────────────────
router.post('/:id/resolve', auth, async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id).lean();
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const body = req.body || {};
    const companyId = body.companyId ? body.companyId : null;
    const directorIds = Array.isArray(body.directorIds) ? body.directorIds : [];
    const meetingId = body.meetingId ? body.meetingId : null;

    // 透传 company / director / meeting 解析参数
    const { values, autoFilled } = await resolveValues(template, {
      companyId,
      directorIds,
      meetingId,
    });

    return res.json({ success: true, values, autoFilled });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
