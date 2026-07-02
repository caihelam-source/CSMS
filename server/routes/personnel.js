const express = require('express');
const Personnel = require('../models/Personnel');
const Company = require('../models/Company');
const ShareholderEntry = require('../models/ShareholderEntry');
const DirectorEntry = require('../models/DirectorEntry');
const Meeting = require('../models/Meeting');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/personnel — 人员列表（支持搜索/筛选）
router.get('/', auth, async (req, res) => {
  try {
    const { search, role, company, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameChinese: { $regex: search, $options: 'i' } },
        { idNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nric: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) query.roles = role;
    if (company) query['appointments.company'] = company;
    if (status) query['appointments.status'] = status;

    const personnel = await Personnel.find(query)
      .populate('appointments.company', 'name nameChinese stockCode')
      .sort({ name: 1 });

    res.json({ success: true, count: personnel.length, personnel });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/personnel/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id)
      .populate('appointments.company', 'name nameChinese stockCode jurisdiction');
    if (!person) return res.status(404).json({ message: 'Personnel not found' });
    res.json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/personnel — 创建人员（含重复检测）
router.post('/', auth, async (req, res) => {
  try {
    const { name, nric, email } = req.body;
    
    // Duplicate check before create
    if (nric) {
      const existingWithNric = await Personnel.findOne({ nric });
      if (existingWithNric) {
        return res.status(409).json({ 
          message: 'Duplicate detected: NRIC already exists', 
          duplicate: { _id: existingWithNric._id, name: existingWithNric.name, nric: existingWithNric.nric } 
        });
      }
    }
    
    if (email) {
      const existingWithEmail = await Personnel.findOne({ email });
      if (existingWithEmail) {
        return res.status(409).json({ 
          message: 'Duplicate detected: Email already exists', 
          duplicate: { _id: existingWithEmail._id, name: existingWithEmail.name, email: existingWithEmail.email } 
        });
      }
    }
    
    // Fuzzy name match
    if (name) {
      const similarNames = await Personnel.find({ name: { $regex: name, $options: 'i' } });
      if (similarNames.length > 0 && !nric && !email) {
        // Warn but allow creation
        console.warn('Name similarity warning:', { suggested: similarNames.map(n => n.name), given: name });
      }
    }

    const person = await Personnel.create(req.body);
    await person.populate('appointments.company', 'name nameChinese');
    res.status(201).json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/personnel/:id — 更新人员
router.put('/:id', auth, async (req, res) => {
  try {
    const person = await Personnel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('appointments.company', 'name nameChinese stockCode');
    if (!person) return res.status(404).json({ message: 'Personnel not found' });
    res.json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/personnel/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const person = await Personnel.findByIdAndDelete(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });
    res.json({ success: true, message: 'Personnel deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/personnel/:id/appointments — 添加职位关联
router.post('/:id/appointments', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });

    const { company, position, appointedDate, ceasedDate, status, notes } = req.body;

    // Check if this appointment already exists
    const existingIndex = person.appointments.findIndex(
      a => a.company?.toString() === (company?._id || company)?.toString() && 
           a.position === position
    );

    if (existingIndex !== -1) {
      return res.status(400).json({ message: 'This appointment already exists' });
    }

    person.appointments.push({
      company: company?._id || company,
      position: position || '董事',
      appointedDate: appointedDate ? new Date(appointedDate) : new Date(),
      ceasedDate: ceasedDate ? new Date(ceasedDate) : null,
      status: status || 'current',
      notes: notes || '',
    });

    // Auto-add role tags
    if (!person.roles) person.roles = [];
    const roleMap = {
      '董事': 'director',
      '公司秘书': 'secretary',
      '股东': 'shareholder',
      '雇员': 'employee',
      '总经理': 'manager',
    };
    
    const roleName = Object.keys(roleMap).find(k => position?.includes(k));
    if (roleName && !person.roles.includes(roleMap[roleName])) {
      person.roles.push(roleMap[roleName]);
    }
    
    // Also add roles from existing appointments
    if (person.appointments) {
      person.appointments.forEach(appt => {
        if (appt.position) {
          const ar = Object.keys(roleMap).find(k => appt.position.includes(k));
          if (ar && !person.roles.includes(roleMap[ar])) {
            person.roles.push(roleMap[ar]);
          }
        }
      });
    }

    await person.save();
    await person.populate('appointments.company', 'name registrationNumber type status');
    res.json({ success: true, personnel: person });
  } catch (err) {
    console.error('Error adding appointment:', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/personnel/:id/appointments/:apptId — 更新职位关联
router.put('/:id/appointments/:apptId', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });
    const appt = person.appointments.id(req.params.apptId);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    Object.assign(appt, req.body);
    await person.save();
    await person.populate('appointments.company', 'name registrationNumber');
    res.json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Duplicate detection — GET /api/personnel/duplicates
router.get('/duplicates', auth, async (req, res) => {
  try {
    const { search, idNumber, name } = req.query;
    let query = {};

    // 按证件号精确匹配重复
    if (idNumber) {
      query.nric = { $regex: idNumber, $options: 'i' };
    } else if (search) {
      // 按姓名模糊匹配 + 证件号部分匹配
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameChinese: { $regex: search, $options: 'i' } },
        ...(name ? [{ name: { $regex: name, $options: 'i' } }] : []),
      ];
      // 如果有证件号，加上精确匹配
      if (idNumber) {
        query.nric = { $regex: idNumber, $options: 'i' };
      }
    }

    const records = await Personnel.find(query).sort({ name: 1 });

    // 按 name 分组，找出有重复的记录
    const duplicates = {};
    records.forEach(r => {
      const key = (r.name || '').toLowerCase().trim();
      if (!duplicates[key]) duplicates[key] = [];
      duplicates[key].push(r);
    });

    // 只返回有重复的组
    const duplicateGroups = Object.entries(duplicates)
      .filter(([_, group]) => group.length > 1)
      .map(([key, group]) => ({
        name: group[0].name,
        count: group.length,
        records: group.map(r => ({
          _id: r._id,
          name: r.name,
          nric: r.nric,
          email: r.email,
          phone: r.phone,
          appointments: r.appointments?.length || 0,
        })),
      }));

    res.json({ success: true, duplicates: duplicateGroups, total: duplicateGroups.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Merge personnel — POST /api/personnel/merge
router.post('/merge', auth, async (req, res) => {
  try {
    const { targetId, sourceId } = req.body;
    if (!targetId || !sourceId) {
      return res.status(400).json({ message: 'targetId and sourceId are required' });
    }
    if (targetId === sourceId) {
      return res.status(400).json({ message: 'Cannot merge a person with themselves' });
    }

    const target = await Personnel.findById(targetId);
    const source = await Personnel.findById(sourceId);
    if (!target) return res.status(404).json({ message: 'Target personnel not found' });
    if (!source) return res.status(404).json({ message: 'Source personnel not found' });

    // Merge appointments
    const sourceAppointments = source.appointments || [];
    const targetAppointments = target.appointments || [];

    // Deduplicate by company ID
    const targetApptCompanyIds = new Set(targetAppointments.map(a => a.company?.toString?.() || a.company).filter(Boolean));
    sourceAppointments.forEach(appt => {
      const companyId = appt.company?.toString?.() || appt.company;
      if (!targetApptCompanyIds.has(companyId)) {
        targetAppointments.push(appt);
        targetApptCompanyIds.add(companyId);
      }
    });

    // Merge roles
    const sourceRoles = source.roles || [];
    const targetRoles = [...new Set([...targetAppointments, ...sourceRoles].filter(Boolean))];
    target.roles = [...new Set([...(target.roles || []), ...sourceRoles])];

    // Preserve best data from source
    if (!target.nric && source.nric) target.nric = source.nric;
    if (!target.email && source.email) target.email = source.email;
    if (!target.phone && source.phone) target.phone = source.phone;
    if (!target.nameChinese && source.nameChinese) target.nameChinese = source.nameChinese;
    if (!target.nationality && source.nationality) target.nationality = source.nationality;
    if (source.notes && !target.notes) target.notes = source.notes;
    else if (source.notes) target.notes += '\n[来自合并] ' + source.notes;

    // Move company-level links: update references from sourceId to targetId
    // Update ShareholderEntry references
    await ShareholderEntry.updateMany(
      { personnelRef: sourceId },
      { $set: { personnelRef: targetId } }
    );

    // Update DirectorEntry references
    await DirectorEntry.updateMany(
      { personnelRef: sourceId },
      { $set: { personnelRef: targetId } }
    );

    // Update Meeting attendee references
    await Meeting.updateMany(
      { 'attendees.ref': sourceId },
      { $set: { 'attendees.$.ref': targetId, 'attendees.$.name': target.name } }
    );

    // Update Document references
    await Document.updateMany(
      { personnel: sourceId },
      { $set: { personnel: targetId } }
    );

    // Delete source
    await Personnel.findByIdAndDelete(sourceId);
    await target.save();

    res.json({ success: true, message: 'Personnel merged successfully', personnel: target });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check duplicates on create — POST /api/personnel/check-duplicate
router.post('/check-duplicate', auth, async (req, res) => {
  try {
    const { name, nric, email } = req.body;
    let query = {};
    
    if (nric) {
      query.nric = nric;
    } else if (name) {
      query.name = { $regex: `^${name}$`, $options: 'i' };
    } else if (email) {
      query.email = email;
    }

    const matches = await Personnel.find(query);
    const hasDuplicate = matches.length > 0;

    res.json({ success: true, hasDuplicate, duplicates: matches });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/personnel/:id/appointments — 获取人员任职记录
router.get('/:id/appointments', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });

    // Populate company details from appointments
    const populatedAppts = await Promise.all(
      (person.appointments || []).map(async (a) => {
        if (a.company) {
          const company = await Company.findById(a.company).select('name registrationNumber type status');
          return { ...a.toObject(), company };
        }
        return a;
      })
    );

    res.json({ success: true, appointments: populatedAppts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete appointment — DELETE /api/personnel/:id/appointments/:apptId
router.delete('/:id/appointments/:apptId', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });
    const idx = person.appointments.findIndex(a => a._id.toString() === req.params.apptId);
    if (idx === -1) return res.status(404).json({ message: 'Appointment not found' });
    person.appointments.splice(idx, 1);
    await person.save();
    res.json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
