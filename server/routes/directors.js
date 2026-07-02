const express = require('express');
const XLSX = require('xlsx');
const Director = require('../models/Director');
const Company = require('../models/Company');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/directors — 获取董事列表
router.get('/', auth, async (req, res) => {
  try {
    const { search, company, status } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameChinese: { $regex: search, $options: 'i' } },
        { idNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (company) {
      query['appointments.company'] = company;
    }

    if (status) {
      query['appointments.status'] = status;
    }

    const directors = await Director.find(query)
      .populate('appointments.company', 'name nameChinese stockCode')
      .sort({ name: 1 });

    res.json({ success: true, count: directors.length, directors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/directors/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const director = await Director.findById(req.params.id)
      .populate('appointments.company', 'name nameChinese stockCode jurisdiction');
    if (!director) return res.status(404).json({ message: 'Director not found' });
    res.json({ success: true, director });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/directors — 创建董事
router.post('/', auth, async (req, res) => {
  try {
    const director = await Director.create(req.body);
    res.status(201).json({ success: true, director });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/directors/:id — 更新董事
router.put('/:id', auth, async (req, res) => {
  try {
    const director = await Director.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('appointments.company', 'name nameChinese stockCode');
    if (!director) return res.status(404).json({ message: 'Director not found' });
    res.json({ success: true, director });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/directors/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const director = await Director.findByIdAndDelete(req.params.id);
    if (!director) return res.status(404).json({ message: 'Director not found' });
    res.json({ success: true, message: 'Director deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/directors/:id/appointments — 添加职位
router.post('/:id/appointments', auth, async (req, res) => {
  try {
    const director = await Director.findById(req.params.id);
    if (!director) return res.status(404).json({ message: 'Director not found' });
    director.appointments.push(req.body);
    await director.save();
    await director.populate('appointments.company', 'name nameChinese');
    res.json({ success: true, director });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/directors/:id/appointments/:apptId — 更新职位
router.put('/:id/appointments/:apptId', auth, async (req, res) => {
  try {
    const director = await Director.findById(req.params.id);
    if (!director) return res.status(404).json({ message: 'Director not found' });
    const appt = director.appointments.id(req.params.apptId);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    Object.assign(appt, req.body);
    await director.save();
    res.json({ success: true, director });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Excel 导入 ──────────────────────────────────────────────────────────────

// POST /api/directors/import/excel — 从Excel批量导入董事
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

      const name = String(row['姓名'] || '').trim();
      const dobRaw = row['出生日期'];
      const companyName = String(row['任职公司'] || '').trim();
      const appointedDateRaw = row['任命日期'];

      if (!name) { errors.push(`第${rowNum}行：姓名不能为空`); continue; }
      if (!companyName) { errors.push(`第${rowNum}行：任职公司不能为空`); continue; }

      // 查找公司
      const company = await Company.findOne({
        $or: [
          { name: { $regex: companyName, $options: 'i' } },
          { nameChinese: { $regex: companyName, $options: 'i' } },
        ]
      });
      if (!company) { errors.push(`第${rowNum}行：找不到公司"${companyName}"，请先导入公司数据`); continue; }

      const dob = dobRaw ? new Date(dobRaw) : null;
      const appointedDate = appointedDateRaw ? new Date(appointedDateRaw) : null;
      const idNumber = String(row['证件号'] || '').trim();

      // 查重：证件号 > 姓名+出生日期
      let director;
      if (idNumber) {
        director = await Director.findOne({ idNumber });
      }
      if (!director && dob) {
        director = await Director.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, dateOfBirth: dob });
      }

      const apptData = {
        company: company._id,
        position: String(row['职位'] || '董事').trim(),
        appointedDate,
        status: String(row['状态'] || '在任').trim(),
      };

      if (!director) {
        // 新建董事
        director = await Director.create({
          name,
          nameChinese: String(row['中文名'] || '').trim(),
          dateOfBirth: dob,
          idNumber,
          passportNumber: String(row['护照号'] || '').trim(),
          email: String(row['邮箱'] || '').trim(),
          phone: String(row['电话'] || '').trim(),
          residentialAddress: String(row['住址'] || '').trim(),
          correspondenceAddress: String(row['通讯地址'] || '').trim(),
          appointments: [apptData],
        });
        created++;
      } else {
        // 更新基本信息，检查是否已有该公司职位
        const existingAppt = director.appointments.find(a => String(a.company) === String(company._id));
        if (!existingAppt) {
          director.appointments.push(apptData);
        } else {
          Object.assign(existingAppt, apptData);
        }
        // 更新基本信息
        if (row['中文名']) director.nameChinese = String(row['中文名']).trim();
        if (row['邮箱']) director.email = String(row['邮箱']).trim();
        if (row['电话']) director.phone = String(row['电话']).trim();
        await director.save();
        updated++;
      }
    }

    res.json({ success: true, created, updated, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
