const express = require('express');
const XLSX = require('xlsx');
const Company = require('../models/Company');
const Document = require('../models/Document');
const Personnel = require('../models/Personnel');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const ComplianceReminder = require('../models/ComplianceReminder');
const SignTask = require('../models/SignTask');
const { auth, adminAuth } = require('../middleware/auth');
const { scopeMiddleware, applyListScope, inScope } = require('../middleware/scope');
const multer = require('multer');
const mongoose = require('mongoose');
const { findCompanyDuplicates, fuzzyMatch } = require('../utils/dedup');
const { applyDocRenumbers } = require('../utils/docFileCode');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// jurisdiction 归一化：兼容中文/旧英文/英文，未知值归为 'HK'（与模型 enum 对齐）
const normalizeJurisdiction = (v) => {
  const m = {
    '香港': 'HK', 'Hong Kong': 'HK',
    'BVI': 'BVI', 'British Virgin Islands': 'BVI',
    '开曼': 'Cayman', 'Cayman': 'Cayman', 'Cayman Islands': 'Cayman',
    '新加坡': 'SG', 'Singapore': 'SG',
    '其他': 'OTHER', 'Other': 'OTHER',
  };
  return m[String(v || '').trim()] || 'HK';
};

// GET /api/companies
router.get('/', auth, scopeMiddleware, async (req, res) => {
  try {
    const { status, jurisdiction, isListed, search, page, limit } = req.query;
    const query = {};

    if (status) query.status = status;
    if (jurisdiction) query.jurisdiction = jurisdiction;
    if (isListed !== undefined) query.isListed = isListed === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameChinese: { $regex: search, $options: 'i' } },
        { stockCode: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Wave 0 rev2 — 行级权限：非 admin/auditor 仅见 accessibleCompanies 内的公司
    applyListScope(query, req, '_id');

    // 分页（opt-in：仅当传 page/limit 时启用，兼容旧前端全量拉取）
    const usePaging = !!(page || limit);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
    const total = await Company.countDocuments(query);

    let q = Company.find(query).lean().sort({ name: 1 });
    if (usePaging) q = q.skip((pageNum - 1) * limitNum).limit(limitNum);
    const companies = await q;

    res.json({
      success: true,
      count: companies.length,
      total,
      page: usePaging ? pageNum : undefined,
      pageSize: usePaging ? limitNum : undefined,
      companies,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/duplicates — 公司去重检测（v6.x 公司合并闭环）
//   返回所有疑似重复对，按三层匹配从强→弱：exact_regno > alias > fuzzy_name (JW ≥ 0.92)
//   ⚠️ 必须放在 /:id GET 之前，否则 Express 会把 'duplicates' 当 ObjectId
router.get('/duplicates', auth, async (req, res) => {
  try {
    const { includeMerged, fuzzyThreshold } = req.query
    const companies = await Company.find(
      includeMerged === 'true' ? {} : { status: { $ne: 'merged' } },
    ).lean()
    const pairs = findCompanyDuplicates(companies, {
      fuzzyThreshold: fuzzyThreshold ? Number(fuzzyThreshold) : undefined,
    })
    const lite = (c) => ({
      _id: c._id,
      name: c.name,
      nameChinese: c.nameChinese,
      registrationNumber: c.registrationNumber,
      jurisdiction: c.jurisdiction,
      stockCode: c.stockCode,
      type: c.type,
      status: c.status,
      formerNames: (c.formerNames || []).slice(-3),
      mergedInto: c.mergedInto,
    })
    res.json({
      success: true,
      count: pairs.length,
      // 走 B 形状：前端 services 直接取 data.pairs 数组
      data: {
        count: pairs.length,
        pairs: pairs.map(({ a, b, type, score, reason }) => ({
          type,
          score,
          reason,
          a: lite(a),
          b: lite(b),
        })),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/companies/reverse-links?personnelId=xxx — 反查某人关联的所有公司（v5.0 方案甲：从 Company.links 读）
router.get('/reverse-links', auth, async (req, res) => {
  try {
    const { personnelId } = req.query;
    if (!personnelId) return res.status(400).json({ message: 'personnelId required' });
    const companies = await Company.find({ 'links.link': personnelId, 'links.linkModel': 'Personnel' }).lean()
      .select('name nameChinese registrationNumber type status links');
    const links = [];
    companies.forEach(c => {
      (c.links || []).forEach(l => {
        if (l.linkModel === 'Personnel' && l.link?.toString() === personnelId) {
          links.push({ ...l.toObject(), company: { _id: c._id, name: c.name, nameChinese: c.nameChinese, registrationNumber: c.registrationNumber } });
        }
      });
    });
    res.json({ success: true, links });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/stats/dashboard — Dashboard 统计概览（与前端 getDashboardStats 对齐）
router.get('/stats/dashboard', auth, async (req, res) => {
  try {
    const now = new Date();
    const [
      totalCompanies, activeCompanies, totalPersonnel, totalDocuments, totalMeetings,
      totalTasks, pendingTasks, completedTasks, totalReminders, upcomingReminders,
      expiredReminders, totalSignTasks,
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Personnel.countDocuments(),
      Document.countDocuments(),
      Meeting.countDocuments(),
      Task.countDocuments(),
      Task.countDocuments({ status: 'pending' }),
      Task.countDocuments({ status: 'completed' }),
      ComplianceReminder.countDocuments(),
      ComplianceReminder.countDocuments({ status: { $in: ['待办', '处理中'] }, dueDate: { $gte: now } }),
      ComplianceReminder.countDocuments({ status: { $in: ['待办', '处理中'] }, dueDate: { $lt: now } }),
      SignTask.countDocuments(),
    ]);
    res.json({
      success: true,
      data: {
        totalCompanies, activeCompanies, totalPersonnel, totalDocuments, totalMeetings,
        totalTasks, pendingTasks, completedTasks, totalReminders, upcomingReminders,
        expiredReminders, totalSignTasks,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', auth, scopeMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid company id' });
  }
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ message: 'Company not found' });
    // Wave 0 rev2 — 行级权限：越权访问返回 403
    if (!inScope(req, company._id)) {
      return res.status(403).json({ message: 'Access denied: company not in your accessible scope' });
    }
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/reverse-links/:personnelId — 反查某人关联的所有公司（读时聚合自 Company.links）
router.get('/reverse-links/:personnelId', auth, async (req, res) => {
  try {
    const pid = req.params.personnelId;
    const companies = await Company.find({ 'links.link': pid, 'links.linkModel': 'Personnel' }).lean()
      .select('name nameChinese registrationNumber type status links');
    const links = [];
    companies.forEach(c => (c.links || []).forEach(l => {
      if (l.linkModel === 'Personnel' && l.link?.toString() === pid) {
        links.push({
          company: { _id: c._id, name: c.name, nameChinese: c.nameChinese, registrationNumber: c.registrationNumber, type: c.type, status: c.status },
          roles: l.roles || [], shares: l.shares, shareType: l.shareType,
          appointmentDate: l.appointmentDate, cessationDate: l.cessationDate, notes: l.notes,
        });
      }
    }));
    res.json({ success: true, count: links.length, links });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/companies
router.post('/', auth, async (req, res) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json({ success: true, company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // 清理反向引用，避免悬空指针
    const cid = company._id;
    await Promise.all([
      Document.updateMany({ company: cid }, { $unset: { company: '' } }),
      Meeting.updateMany({ company: cid }, { $unset: { company: '' } }),
      Task.updateMany({ company: cid }, { $unset: { company: '' } }),
      ComplianceReminder.deleteMany({ company: cid }),
      SignTask.updateMany({ company: cid }, { $unset: { company: '' } }),
    ]);

    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/companies/import/excel — 批量导入公司
router.post('/import/excel', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传 Excel 文件' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let created = 0, updated = 0, errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = String(row['公司名称'] || '').trim();
      const incorporationDateRaw = row['成立日期'];

      if (!name) { errors.push(`第${rowNum}行：公司名称不能为空`); continue; }

      const incorporationDate = incorporationDateRaw ? new Date(incorporationDateRaw) : null;
      if (!incorporationDate || isNaN(incorporationDate)) {
        errors.push(`第${rowNum}行：成立日期格式错误（应为 YYYY-MM-DD）`); continue;
      }

      const stockCode = String(row['股票代码'] || '').trim();
      const registrationNumber = String(row['注册号'] || '').trim();

      // 查重
      let company = null;
      if (stockCode) company = await Company.findOne({ stockCode });
      if (!company && registrationNumber) company = await Company.findOne({ registrationNumber });

      const data = {
        name,
        nameChinese: String(row['公司中文名'] || '').trim(),
        stockCode,
        registrationNumber,
        incorporationDate,
        registeredAddress: String(row['注册地址'] || '').trim(),
        businessAddress: String(row['营业地址'] || '').trim(),
        jurisdiction: normalizeJurisdiction(row['地区']),
        businessNature: String(row['业务性质'] || '').trim(),
        industry: String(row['行业'] || '').trim(),
        phone: String(row['电话'] || '').trim(),
        email: String(row['邮箱'] || '').trim(),
        financialYearEnd: (() => {
          const m = String(row['财务年度结束'] || '').match(/(\d{1,2})[-/](\d{1,2})/);
          return m ? { month: parseInt(m[1], 10), day: parseInt(m[2], 10) } : undefined;
        })(),
        companySecretary: String(row['公司秘书'] || '').trim(),
        status: String(row['状态'] || '活跃').trim(),
        notes: String(row['备注'] || '').trim(),
      };

      // 名称模糊补缺：无股票代码/注册号命中时按归一化名 fuzzy 查重（阈值 0.92），
      // 应对"已在系统里手工建过同名公司但未填注册号"的缺口，避免 Excel 重导产生重复卡片。
      if (!company && (name || data.nameChinese)) {
        const prefix = String(name || data.nameChinese || '').slice(0, 16);
        const candidates = await Company.find({
          status: { $ne: 'merged' },
          $or: [
            { name: { $regex: '^' + prefix, $options: 'i' } },
            { nameChinese: { $regex: String(data.nameChinese || name || '').slice(0, 8), $options: 'i' } },
          ],
        }).limit(20).lean();
        for (const cand of candidates) {
          if (cand.registrationNumber && registrationNumber && cand.registrationNumber !== registrationNumber) continue
          const hit = fuzzyMatch({ name, nameChinese: data.nameChinese }, cand)
          if (hit) { company = await Company.findById(cand._id); break }
        }
      }

      if (!company) {
        await Company.create(data);
        created++;
      } else {
        await Company.updateOne({ _id: company._id }, { $set: data });
        updated++;
      }
    }

    res.json({ success: true, created, updated, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/template/excel — 下载公司 Excel 模板
router.get('/template/excel', auth, (req, res) => {
  const headers = ['公司名称', '公司中文名', '股票代码', '注册号', '成立日期', '注册地址', '营业地址', '地区', '业务性质', '行业', '电话', '邮箱', '财务年度结束', '公司秘书', '状态', '备注'];
  const example = ['ABC Limited', 'ABC有限公司', '00001', '12345678', '2020-01-15', '香港中环...', '', '香港', '贸易', '金融', '+852 1234 5678', 'info@abc.com', '12-31', 'John Doe', '活跃', ''];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Companies');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=companies_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ====== v5.0: 统一关联 CRUD（读时聚合：Company.links 为唯一事实源，不物化 Personnel）======

// POST /api/companies/:id/links — 新增关联（董事/股东/秘书/公司型股东）
router.post('/:id/links', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const {
      linkModel, link, roles, shares, shareType,
      appointmentDate, cessationDate, notes,
      shareRecords, formerNameOrAlias, documentServiceAddress, usualResidentialAddress,
    } = req.body;

    const newLink = {
      linkModel: linkModel || 'Personnel',
      link: link?._id || link,
      roles: roles || ['director'],
      shares, shareType,
      appointmentDate: appointmentDate ? new Date(appointmentDate) : undefined,
      cessationDate: cessationDate ? new Date(cessationDate) : undefined,
      notes,
      shareRecords: shareRecords || [],
      formerNameOrAlias, documentServiceAddress, usualResidentialAddress,
    };
    company.links.push(newLink);
    await company.save();

    // 读时聚合：仅写 Company.links（唯一事实源），不物化 Personnel.appointments。
    // 人视角的任职公司/角色由 GET /api/companies/reverse-links 与 deriveRoles 读时聚合。
    const updated = await Company.findById(company._id);
    res.status(201).json({ success: true, company: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/companies/:id/links/:linkId — 更新关联
router.put('/:id/links/:linkId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const link = company.links.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Link not found' });

    const {
      linkModel, link: incomingLink, roles, shares, shareType,
      appointmentDate, cessationDate, notes,
      shareRecords, formerNameOrAlias, documentServiceAddress, usualResidentialAddress,
    } = req.body;

    if (linkModel !== undefined) link.linkModel = linkModel;
    if (incomingLink !== undefined) link.link = incomingLink?._id || incomingLink;
    if (roles !== undefined) link.roles = roles;
    if (shares !== undefined) link.shares = shares;
    if (shareType !== undefined) link.shareType = shareType;
    if (appointmentDate !== undefined) link.appointmentDate = appointmentDate ? new Date(appointmentDate) : undefined;
    if (cessationDate !== undefined) link.cessationDate = cessationDate ? new Date(cessationDate) : undefined;
    if (notes !== undefined) link.notes = notes;
    if (shareRecords !== undefined) link.shareRecords = shareRecords;
    if (formerNameOrAlias !== undefined) link.formerNameOrAlias = formerNameOrAlias;
    if (documentServiceAddress !== undefined) link.documentServiceAddress = documentServiceAddress;
    if (usualResidentialAddress !== undefined) link.usualResidentialAddress = usualResidentialAddress;
    await company.save();
    // 读时聚合：仅更新 Company.links，不回写 Personnel.appointments。
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/companies/:id/links/:linkId — 删除关联
router.delete('/:id/links/:linkId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const link = company.links.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Link not found' });

    company.links.pull(req.params.linkId);
    await company.save();
    res.json({ success: true, message: 'Link removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ====== v6.x 公司去重 / 合并 闭环 ======
//
// 设计约定（与 personnel merge 对齐）：
//   - 软合并：源公司 status='merged'、mergedInto=target、mergedAt=now、mergedBy=currentUser
//   - 数据零删除：源公司保留可读，formerNames[] 入 target；Document/Meeting/Task/SignTask/ComplianceReminder
//     等反向引用全部 $set 到 target，不 $unset
//   - Personnel 链接去重合并：源公司的 links[].link 按 personnelId 去重后并入 target
//   - 文件重编号：可选，对 target+source 范围内的 Document 走 v6.x 编号 (entityCode-year-typeCode-seq)
//   - 行级权限 scopeMiddleware：rows 方向 only；merge 接口 admin 鉴权 (adminAuth)
//
// ⚠️ 重要：合并操作不可逆。一旦执行，唯一回滚路径是 --rollback 重新 $set 回去（见 scripts/exec-merge-plan.js）。
//          调用前务必 dry-run 一遍（GET /api/companies/duplicates 命中后再 merge）。

// POST /api/companies/:id/merge — 软合并（admin only）
//   :id = sourceCompanyId（将被并入 target）
//   body: { targetCompanyId, options?: { addAsFormerName?, renumberFiles?, mergeLinks? } }
//   默认全 true（最安全）
router.post('/:id/merge', auth, adminAuth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid source company id' })
  }
  const { targetCompanyId, options = {} } = req.body || {}
  if (!targetCompanyId) {
    return res.status(400).json({ message: 'targetCompanyId is required' })
  }
  if (req.params.id === String(targetCompanyId)) {
    return res.status(400).json({ message: 'Cannot merge a company with itself' })
  }
  if (!mongoose.Types.ObjectId.isValid(targetCompanyId)) {
    return res.status(400).json({ message: 'Invalid target company id' })
  }
  const {
    addAsFormerName = true,
    renumberFiles = true,
    mergeLinks = true,
  } = options

  try {
    const source = await Company.findById(req.params.id)
    const target = await Company.findById(targetCompanyId)
    if (!source) return res.status(404).json({ message: 'Source company not found' })
    if (!target) return res.status(404).json({ message: 'Target company not found' })
    // 阻二次合并：源 / 目标任一已 status='merged' 则拒绝
    if (source.status === 'merged') {
      return res.status(409).json({ message: 'Source company is already merged', mergedInto: source.mergedInto })
    }
    if (target.status === 'merged') {
      return res.status(409).json({ message: 'Target company is already merged', mergedInto: target.mergedInto })
    }

    const sourceOid = source._id
    const targetOid = target._id
    const sourceName = source.name
    const sourceNameChinese = source.nameChinese
    const sourceRegNo = source.registrationNumber

    // 1) Document / Meeting / Task / SignTask / ComplianceReminder.company 全部重指向 target
    //    注意：ComplianceReminder 用 deleteMany 之外的 updateMany（保留历史，仅重指关联）
    const refOps = await Promise.all([
      Document.updateMany({ company: sourceOid }, { $set: { company: targetOid } }),
      Meeting.updateMany({ company: sourceOid }, { $set: { company: targetOid } }),
      Task.updateMany({ company: sourceOid }, { $set: { company: targetOid } }),
      SignTask.updateMany({ company: sourceOid }, { $set: { company: targetOid } }),
      ComplianceReminder.updateMany({ company: sourceOid }, { $set: { company: targetOid } }),
    ])
    const refCounts = Object.fromEntries(
      refOps.map((op, i) => [[['document', 'meeting', 'task', 'signTask', 'complianceReminder'][i]], op.modifiedCount || 0]),
    )

    // 2) Personnel.links 跨公司迁移：把 source.links 里所有 linkModel=Personnel 的条目，
    //    在 target.links 中按 (linkModel, link) 去重后追加（mergeLinks 选项开关）
    let mergedLinks = 0
    if (mergeLinks && Array.isArray(source.links) && source.links.length) {
      const targetLinkKeys = new Set(
        (target.links || []).map((l) => `${l.linkModel}|${String(l.link)}`),
      )
      for (const sl of source.links) {
        if (!sl.link) continue
        const key = `${sl.linkModel}|${String(sl.link)}`
        if (targetLinkKeys.has(key)) {
          // 链接已存在 → 仅合并 roles（去重）、shareRecords
          const existing = target.links.find((l) => `${l.linkModel}|${String(l.link)}` === key)
          if (existing) {
            const roles = new Set([...(existing.roles || []), ...(sl.roles || [])])
            existing.roles = Array.from(roles)
            if (sl.shareRecords?.length) existing.shareRecords = [...(existing.shareRecords || []), ...sl.shareRecords]
          }
          continue
        }
        // 新链接 → 浅拷贝插入
        target.links.push(sl.toObject ? sl.toObject() : { ...sl })
        targetLinkKeys.add(key)
        mergedLinks++
      }
      await target.save()
    }

    // 3) formerNames[]：把 source 的当前 name / nameChinese 加入 target
    let formerNameAdded = null
    if (addAsFormerName && sourceName) {
      const entry = {
        name: sourceName,
        nameChinese: sourceNameChinese || undefined,
        changedAt: new Date(),
        source: 'merger',
        mergedFromCompanyId: sourceOid,
        notes: sourceRegNo ? `原 BR: ${sourceRegNo}` : undefined,
      }
      target.formerNames = [...(target.formerNames || []), entry]
      formerNameAdded = entry
      await target.save()
    }

    // 4) 文件重编号（v6.x）；可选 — 对 target 现有文档 + 已迁入文档批量重编号
    //    用 applyDocRenumbers 两遍写，规避 docNumber 唯一索引瞬时冲突
    let renumberOpsApplied = 0
    if (renumberFiles) {
      const allDocs = await Document.find({ company: targetOid }).lean().select('_id type createdAt docNumber')
      renumberOpsApplied = await applyDocRenumbers(Document, target, allDocs)
    }

    // 5) 软关源公司
    source.status = 'merged'
    source.mergedInto = targetOid
    source.mergedAt = new Date()
    source.mergedBy = req.user?._id
    // 源公司 links 清空（已迁到 target）避免 UI 重复渲染
    source.links = []
    await source.save()

    res.json({
      success: true,
      source: { _id: source._id, name: source.name, status: source.status, mergedInto: source.mergedInto },
      target: { _id: target._id, name: target.name, formerNamesCount: (target.formerNames || []).length },
      stats: {
        referenceMigrations: refCounts,
        mergedLinksCount: mergedLinks,
        formerNameAdded,
        filesRenumbered: renumberOpsApplied,
      },
    })
  } catch (err) {
    console.error('merge error:', err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/companies/:id/former-names — 手动增/删 formerNames 条目（与 merge 解耦的可选维护入口）
//   body:
//     { op: 'add', name, nameChinese?, notes? }          → 追加一条 source='manual'
//     { op: 'remove', index }                            → 按索引删除一条（仅 source='manual' 可删，merger 来源保护）
//     { op: 'replace', entries: [...] }                  → 整体替换（admin only）
router.put('/:id/former-names', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid company id' })
  }
  const { op } = req.body || {}
  try {
    const company = await Company.findById(req.params.id)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    if (company.status === 'merged') {
      return res.status(409).json({ message: 'Company already merged; former names are immutable' })
    }

    if (op === 'add') {
      const { name, nameChinese, notes } = req.body
      if (!name || !String(name).trim()) {
        return res.status(400).json({ message: 'name is required' })
      }
      company.formerNames = [...(company.formerNames || []), {
        name: String(name).trim(),
        nameChinese: nameChinese ? String(nameChinese).trim() : undefined,
        changedAt: new Date(),
        source: 'manual',
        notes: notes ? String(notes).trim() : undefined,
      }]
      await company.save()
      return res.json({ success: true, formerNames: company.formerNames })
    }

    if (op === 'remove') {
      const { index } = req.body
      const list = company.formerNames || []
      const target = list[index]
      if (!target) return res.status(400).json({ message: 'index out of range' })
      // merger 来源保护：仅允许删手动条目
      if (target.source === 'merger') {
        return res.status(403).json({ message: 'Cannot remove merger-sourced former name; undo via manual merge instead' })
      }
      list.splice(index, 1)
      company.formerNames = list
      await company.save()
      return res.json({ success: true, formerNames: company.formerNames })
    }

    if (op === 'replace') {
      // admin only：一次性替换整列（merge 后期清理用）
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'replace requires admin role' })
      }
      const { entries } = req.body
      if (!Array.isArray(entries)) {
        return res.status(400).json({ message: 'entries must be an array' })
      }
      company.formerNames = entries.filter((e) => e && e.name).map((e) => ({
        name: String(e.name).trim(),
        nameChinese: e.nameChinese ? String(e.nameChinese).trim() : undefined,
        changedAt: e.changedAt ? new Date(e.changedAt) : new Date(),
        source: e.source || 'manual',
        notes: e.notes ? String(e.notes).trim() : undefined,
      }))
      await company.save()
      return res.json({ success: true, formerNames: company.formerNames })
    }

    return res.status(400).json({ message: 'op must be one of add/remove/replace' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router;
