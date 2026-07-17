const express = require('express');
const XLSX = require('xlsx');
const Company = require('../models/Company');
const Document = require('../models/Document');
const Personnel = require('../models/Personnel');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const ComplianceReminder = require('../models/ComplianceReminder');
const SignTask = require('../models/SignTask');
const { auth } = require('../middleware/auth');
const multer = require('multer');

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
router.get('/', auth, async (req, res) => {
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

    // 分页（opt-in：仅当传 page/limit 时启用，兼容旧前端全量拉取）
    const usePaging = !!(page || limit);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
    const total = await Company.countDocuments(query);

    let q = Company.find(query).sort({ name: 1 });
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

// GET /api/companies/reverse-links?personnelId=xxx — 反查某人关联的所有公司（v5.0 方案甲：从 Company.links 读）
router.get('/reverse-links', auth, async (req, res) => {
  try {
    const { personnelId } = req.query;
    if (!personnelId) return res.status(400).json({ message: 'personnelId required' });
    const companies = await Company.find({ 'links.link': personnelId, 'links.linkModel': 'Personnel' })
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
router.get('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/reverse-links/:personnelId — 反查某人关联的所有公司（读时聚合自 Company.links）
router.get('/reverse-links/:personnelId', auth, async (req, res) => {
  try {
    const pid = req.params.personnelId;
    const companies = await Company.find({ 'links.link': pid, 'links.linkModel': 'Personnel' })
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

module.exports = router;
