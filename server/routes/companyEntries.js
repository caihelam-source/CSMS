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

    // v5.0 读时聚合：停止物化；单一事实源 Company.links 同步写入股东 link
    if (data.personnelRef) {
      await Personnel.findByIdAndUpdate(data.personnelRef, { $addToSet: { roles: 'shareholder' } });
      const company = await Company.findById(req.params.id);
      if (company) {
        const exists = (company.links || []).some(l =>
          l.linkModel === 'Personnel' && l.link?.toString() === data.personnelRef && (l.roles || []).includes('shareholder')
        );
        if (!exists) {
          company.links.push({ linkModel: 'Personnel', link: data.personnelRef, roles: ['shareholder'], shares: data.totalSharesHeld });
          await company.save();
        }
      }
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
    // v5.0 读时聚合：从单一事实源 Company.links 移除对应股东关系
    if (entry.personnelRef) {
      await Company.updateOne(
        { _id: entry.company },
        { $pull: { links: { linkModel: 'Personnel', link: entry.personnelRef, roles: 'shareholder' } } }
      );
    }
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

    // v5.0 读时聚合：停止物化 Personnel.appointments。
    // 单一事实源为 Company.links：同步写入一条 link，使新/旧 UI 都能读到该任职关系。
    if (data.personnelRef) {
      const role = data.positionType === '公司秘书' ? 'secretary' : 'director';
      await Personnel.findByIdAndUpdate(data.personnelRef, { $addToSet: { roles: role } });
      const company = await Company.findById(req.params.id);
      if (company) {
        const exists = (company.links || []).some(l =>
          l.linkModel === 'Personnel' && l.link?.toString() === data.personnelRef &&
          (l.roles || []).includes(role) &&
          (l.appointmentDate?.toISOString() === new Date(data.dateOfAppointment)?.toISOString())
        );
        if (!exists) {
          company.links.push({
            linkModel: 'Personnel', link: data.personnelRef, roles: [role],
            appointmentDate: data.dateOfAppointment,
            cessationDate: data.isCurrent === false ? (data.dateOfCessation || null) : null,
          });
          await company.save();
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

    // v5.0 读时聚合：从单一事实源 Company.links 移除对应任职关系（不再碰 Personnel.appointments）
    if (entry.personnelRef) {
      const role = entry.positionType === '公司秘书' ? 'secretary' : 'director';
      await Company.updateOne(
        { _id: entry.company },
        { $pull: { links: { linkModel: 'Personnel', link: entry.personnelRef, roles: role } } }
      );
    }

    await entry.deleteOne();
    res.json({ success: true, message: 'Director entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
