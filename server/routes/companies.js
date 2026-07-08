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

// GET /api/companies
router.get('/', auth, async (req, res) => {
  try {
    const { status, jurisdiction, isListed, search } = req.query;
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

    const companies = await Company.find(query).sort({ name: 1 });
    res.json({ success: true, count: companies.length, companies });
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
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/:id/directors — 获取公司的所有在任董事
router.get('/:id/directors', auth, async (req, res) => {
  try {
    const Director = require('../models/Director');
    const directors = await Director.find({ 'appointments.company': req.params.id });
    res.json({ success: true, directors });
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
        region: String(row['地区'] || '').trim(),
        jurisdiction: ['香港', 'BVI', '开曼', '新加坡', '其他'].includes(String(row['地区'] || '').trim())
          ? String(row['地区']).trim() : '香港',
        businessNature: String(row['业务性质'] || '').trim(),
        industry: String(row['行业'] || '').trim(),
        phone: String(row['电话'] || '').trim(),
        email: String(row['邮箱'] || '').trim(),
        financialYearEnd: String(row['财务年度结束'] || '').trim(),
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

module.exports = router;
