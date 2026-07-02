const express = require('express');
const ShareholderEntry = require('../models/ShareholderEntry');
const DirectorEntry = require('../models/DirectorEntry');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const { auth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // 继承 :id 参数

// ── 股东条目 CRUD ──────────────────────────────────────────────

// GET /api/companies/:id/shareholder-entries
router.get('/shareholder-entries', auth, async (req, res) => {
  try {
    const entries = await ShareholderEntry.find({ company: req.params.id })
      .populate('personnelRef', 'name nameChinese idNumber nationality residentialAddress correspondenceAddress occupation')
      .populate('companyRef', 'name nameChinese registrationNumber registeredAddress')
      .sort({ isCurrentMember: -1, dateEnteredAsMember: 1 });

    res.json({ success: true, count: entries.length, shareholderEntries: entries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/companies/:id/shareholder-entries
router.post('/shareholder-entries', auth, async (req, res) => {
  try {
    const data = { ...req.body, company: req.params.id };
    const entry = await ShareholderEntry.create(data);

    // 如果关联了人员库，自动给人员加上"股东"角色
    if (data.personnelRef) {
      await Personnel.findByIdAndUpdate(data.personnelRef, { $addToSet: { roles: '股东' } });
    }

    await entry.populate('personnelRef', 'name nameChinese');
    await entry.populate('companyRef', 'name nameChinese');
    res.status(201).json({ success: true, shareholderEntry: entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/companies/:id/shareholder-entries/:entryId
router.put('/shareholder-entries/:entryId', auth, async (req, res) => {
  try {
    const entry = await ShareholderEntry.findOneAndUpdate(
      { _id: req.params.entryId, company: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ message: 'Shareholder entry not found' });

    await entry.populate('personnelRef', 'name nameChinese');
    await entry.populate('companyRef', 'name nameChinese');
    res.json({ success: true, shareholderEntry: entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/companies/:id/shareholder-entries/:entryId
router.delete('/shareholder-entries/:entryId', auth, async (req, res) => {
  try {
    const entry = await ShareholderEntry.findOneAndDelete({ _id: req.params.entryId, company: req.params.id });
    if (!entry) return res.status(404).json({ message: 'Shareholder entry not found' });
    res.json({ success: true, message: 'Shareholder entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 董事/秘书条目 CRUD ──────────────────────────────────────────

// GET /api/companies/:id/director-entries
router.get('/director-entries', auth, async (req, res) => {
  try {
    const entries = await DirectorEntry.find({ company: req.params.id })
      .populate('personnelRef', 'name nameChinese formerName dateOfBirth placeOfBirth nationality idNumber residentialAddress correspondenceAddress occupation')
      .sort({ isCurrent: -1, dateOfAppointment: 1 });

    res.json({ success: true, count: entries.length, directorEntries: entries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/companies/:id/director-entries
router.post('/director-entries', auth, async (req, res) => {
  try {
    const data = { ...req.body, company: req.params.id };

    // 去重：同一公司+同一人员+同一职位+同一任命日期，不重复创建
    if (data.personnelRef) {
      const dup = await DirectorEntry.findOne({
        company: req.params.id,
        personnelRef: data.personnelRef,
        positionTitle: data.positionTitle,
        dateOfAppointment: data.dateOfAppointment,
      });
      if (dup) {
        await dup.populate('personnelRef', 'name nameChinese formerName');
        return res.json({ success: true, directorEntry: dup, message: '已存在，未重复创建' });
      }
    }

    const entry = await DirectorEntry.create(data);

    // 如果关联了人员库，自动加角色和appointment（去重）
    if (data.personnelRef) {
      const roleToAdd = data.positionType === '公司秘书' ? '公司秘书' : '董事';
      await Personnel.findByIdAndUpdate(data.personnelRef, {
        $addToSet: { roles: roleToAdd },
      });

      // 给人员加appointment记录（去重）
      const person = await Personnel.findById(data.personnelRef);
      if (person) {
        const already = person.appointments.some(a =>
          a.company?.toString() === req.params.id &&
          a.position === (data.positionTitle || data.positionType) &&
          a.appointedDate?.toISOString() === new Date(data.dateOfAppointment)?.toISOString()
        );
        if (!already) {
          person.appointments.push({
            company: req.params.id,
            position: data.positionTitle || data.positionType,
            appointedDate: data.dateOfAppointment,
            status: data.isCurrent !== false ? '在任' : '离任',
          });
          await person.save();
        }
      }
    }

    await entry.populate('personnelRef', 'name nameChinese formerName');
    res.status(201).json({ success: true, directorEntry: entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/companies/:id/director-entries/:entryId
router.put('/director-entries/:entryId', auth, async (req, res) => {
  try {
    const entry = await DirectorEntry.findOneAndUpdate(
      { _id: req.params.entryId, company: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ message: 'Director entry not found' });

    await entry.populate('personnelRef', 'name nameChinese formerName');
    res.json({ success: true, directorEntry: entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/companies/:id/director-entries/:entryId
router.delete('/director-entries/:entryId', auth, async (req, res) => {
  try {
    const entry = await DirectorEntry.findOne({ _id: req.params.entryId, company: req.params.id });
    if (!entry) return res.status(404).json({ message: 'Director entry not found' });

    // 同步删除 Personnel.appointments 里对应的记录
    if (entry.personnelRef) {
      const person = await Personnel.findById(entry.personnelRef);
      if (person) {
        person.appointments = person.appointments.filter(a =>
          !(a.company?.toString() === entry.company.toString() &&
            a.position === (entry.positionTitle || entry.positionType) &&
            a.appointedDate?.toISOString() === entry.dateOfAppointment?.toISOString())
        );
        await person.save();
      }
    }

    await entry.deleteOne();
    res.json({ success: true, message: 'Director entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
