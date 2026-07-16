const express = require('express');
const mongoose = require('mongoose');
const Personnel = require('../models/Personnel');
const Company = require('../models/Company');
const ShareholderEntry = require('../models/ShareholderEntry');
const DirectorEntry = require('../models/DirectorEntry');
const Meeting = require('../models/Meeting');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/personnel — 人员列表（支持搜索/筛选）
// v5.0 读时聚合：role / company 过滤与 roles 标签均从 Company.links 派生，不依赖 stored appointments
router.get('/', auth, async (req, res) => {
  try {
    const { search, role, company } = req.query;
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

    // 读时聚合：role / company 过滤均从 Company.links 派生
    if (role || company) {
      const match = { 'links.linkModel': 'Personnel' };
      if (company && mongoose.Types.ObjectId.isValid(company)) {
        match['links.link'] = new mongoose.Types.ObjectId(company);
      }
      if (role) match['links.roles'] = role;
      const agg = await Company.aggregate([
        company ? { $match: { _id: new mongoose.Types.ObjectId(company) } } : { $match: {} },
        { $unwind: '$links' },
        { $match: match },
        { $group: { _id: '$links.link' } },
      ]);
      query._id = { $in: agg.map(a => a._id) };
    }

    const personnel = await Personnel.find(query).sort({ name: 1 });

    // 读时聚合：派生的 roles（来自 Company.links），覆盖 stored roles
    const roleAgg = await Company.aggregate([
      { $unwind: '$links' },
      { $match: { 'links.linkModel': 'Personnel' } },
      { $unwind: '$links.roles' },
      { $group: { _id: '$links.link', roles: { $addToSet: '$links.roles' } } },
    ]);
    const roleMap = new Map(roleAgg.map(r => [r._id.toString(), r.roles]));
    const result = personnel.map(p => {
      const obj = p.toObject();
      obj.roles = roleMap.get(p._id.toString()) || [];
      return obj;
    });

    res.json({ success: true, count: result.length, personnel: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/personnel/:id
// v5.0 读时聚合：从 Company.links 反查关联公司（单一事实源），并派生 roles
router.get('/:id', auth, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id);
    if (!person) return res.status(404).json({ message: 'Personnel not found' });

    const companies = await Company.find({ 'links.link': person._id, 'links.linkModel': 'Personnel' })
      .select('name nameChinese registrationNumber type status links');
    const linked = [];
    const roleSet = new Set();
    companies.forEach(c => (c.links || []).forEach(l => {
      if (l.linkModel === 'Personnel' && l.link?.toString() === person._id.toString()) {
        linked.push({
          company: { _id: c._id, name: c.name, nameChinese: c.nameChinese, registrationNumber: c.registrationNumber, type: c.type, status: c.status },
          roles: l.roles || [],
          appointmentDate: l.appointmentDate,
          cessationDate: l.cessationDate,
          shares: l.shares,
          shareType: l.shareType,
          notes: l.notes,
        });
        (l.roles || []).forEach(r => roleSet.add(r));
      }
    }));

    const obj = person.toObject();
    obj.companies = linked;
    obj.roles = [...roleSet];
    res.json({ success: true, personnel: obj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/personnel/:id/aggregate — Person 360° 读时聚合（单一事实源 + $lookup）
// 用 $lookup 一次性聚合人员关联的公司 / Task / Meeting / Document(Files) / ComplianceReminder
async function getByPersonnelAPI(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Personnel not found' })
    }
    const personId = new mongoose.Types.ObjectId(id)

    const [result] = await Personnel.aggregate([
      { $match: { _id: personId } },

      // 1) 关联公司：反向引用 Company.links[].link === 本人员
      {
        $lookup: {
          from: 'companies',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $in: ['$$pid', '$links.link'] } } },
            { $unwind: '$links' },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$links.linkModel', 'Personnel'] },
                    { $eq: ['$links.link', '$$pid'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                company: {
                  _id: '$_id',
                  name: '$name',
                  nameChinese: '$nameChinese',
                  registrationNumber: '$registrationNumber',
                  type: '$type',
                  status: '$status',
                },
                roles: '$links.roles',
                shares: '$links.shares',
                shareType: '$links.shareType',
                appointmentDate: '$links.appointmentDate',
                cessationDate: '$links.cessationDate',
                notes: '$links.notes',
              },
            },
          ],
          as: 'companies',
        },
      },

      // 2) 关联 Task（公司引用 ∪ 直接人员引用）
      {
        $lookup: {
          from: 'tasks',
          let: { pid: '$_id', cids: '$companies.company' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$company', '$$cids'] },
                    { $eq: ['$personnel', '$$pid'] },
                  ],
                },
              },
            },
            { $sort: { dueDate: 1 } },
          ],
          as: 'tasks',
        },
      },

      // 3) 关联 Meeting（公司引用 ∪ 参会人员）
      {
        $lookup: {
          from: 'meetings',
          let: { pid: '$_id', cids: '$companies.company' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$company', '$$cids'] },
                    { $in: ['$$pid', '$attendees.ref'] },
                  ],
                },
              },
            },
            { $sort: { scheduledAt: -1 } },
          ],
          as: 'meetings',
        },
      },

      // 4) 关联 Files（Document：仅直接人员引用，不含公司全部文件）
      //     公司文件 ≠ 个人文件：个人 360° 视图只展示与该人直接关联的证件/个人文档
      {
        $lookup: {
          from: 'documents',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$personnel', '$$pid'] },
              },
            },
            { $sort: { createdAt: -1 } },
          ],
          as: 'documents',
        },
      },

      // 5) 关联 ComplianceReminder（仅公司引用）
      {
        $lookup: {
          from: 'compliancereminders',
          let: { cids: '$companies.company' },
          pipeline: [
            { $match: { $expr: { $in: ['$company', '$$cids'] } } },
            { $sort: { dueDate: 1 } },
          ],
          as: 'reminders',
        },
      },
    ])

    if (!result) return res.status(404).json({ message: 'Personnel not found' })

    // 角色汇总（读时聚合自 Company.links.roles）
    const roleSet = new Set()
    ;(result.companies || []).forEach((c) => (c.roles || []).forEach((r) => roleSet.add(r)))

    // 剥离 $lookup 中间字段，仅保留人员基础字段
    const { companies, tasks, meetings, documents, reminders, ...personnel } = result

    res.json({
      data: {
        data: {
          personnel: { ...personnel, roles: [...roleSet] },
          companies: companies || [],
          tasks: tasks || [],
          meetings: meetings || [],
          documents: documents || [],
          reminders: reminders || [],
        },
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
router.get('/:id/aggregate', auth, getByPersonnelAPI);

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
    res.status(201).json({ success: true, personnel: person });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/personnel/:id — 更新人员
router.put('/:id', auth, async (req, res) => {
  try {
    const person = await Personnel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
      .map(([_key, group]) => ({
        name: group[0].name,
        count: group.length,
        records: group.map(r => ({
          _id: r._id,
          name: r.name,
          nric: r.nric,
          email: r.email,
          phone: r.phone,
          appointments: 0, // v5.0 读时聚合：任职关系已迁至 Company.links，不再 stored
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

    // v5.0 读时聚合：重指单一事实源 Company.links（不再维护 Personnel.appointments）
    const sourceObj = mongoose.Types.ObjectId(sourceId);
    const targetObj = mongoose.Types.ObjectId(targetId);
    await Company.updateMany(
      { 'links.link': sourceObj, 'links.linkModel': 'Personnel' },
      { $set: { 'links.$[elem].link': targetObj } },
      { arrayFilters: [{ 'elem.link': sourceObj, 'elem.linkModel': 'Personnel' }] }
    );

    // Merge roles (stored roles 仅作过渡缓存；实际以 Company.links 读时派生为准)
    const sourceRoles = source.roles || [];
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



module.exports = router;
