const express = require('express');
const mongoose = require('mongoose');
const Personnel = require('../models/Personnel');
const Company = require('../models/Company');
const ShareholderEntry = require('../models/ShareholderEntry');
const DirectorEntry = require('../models/DirectorEntry');
const Meeting = require('../models/Meeting');
const Document = require('../models/Document');
const Task = require('../models/Task');
const ComplianceReminder = require('../models/ComplianceReminder');
const SignTask = require('../models/SignTask');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/personnel — 人员列表（支持搜索/筛选）
// v5.0 读时聚合：role / company 过滤与 roles 标签均从 Company.links 派生，不依赖 stored appointments
router.get('/', auth, async (req, res) => {
  try {
    const { search, role, company, page, limit } = req.query;
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

    // 分页（opt-in：仅当传 page/limit 时启用，兼容旧前端全量拉取）
    const usePaging = !!(page || limit);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
    const total = await Personnel.countDocuments(query);

    let q = Personnel.find(query).sort({ name: 1 });
    if (usePaging) q = q.skip((pageNum - 1) * limitNum).limit(limitNum);
    const personnel = await q;

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

    res.json({
      success: true,
      count: result.length,
      total,
      page: usePaging ? pageNum : undefined,
      pageSize: usePaging ? limitNum : undefined,
      personnel: result,
    });
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

// GET /api/personnel/:id/aggregate — Person 360° 读时聚合（单一事实源 + 索引友好关联）
// 公司关联用 localField/foreignField lookup 命中 links.link 索引（避免 $expr 全表扫）；
// tasks/meetings/reminders/documents 用顶层 $in 走各自索引并行查询。
async function getByPersonnelAPI(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Personnel not found' })
    }
    const personId = new mongoose.Types.ObjectId(id)

    // 1) 基础人员 + 关联公司：localField/foreignField lookup 命中 links.link 索引
    const [result] = await Personnel.aggregate([
      { $match: { _id: personId } },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: 'links.link',
          as: 'companyDocs',
        },
      },
      {
        $addFields: {
          companies: {
            $reduce: {
              input: '$companyDocs',
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: '$$this.links',
                          as: 'l',
                          cond: {
                            $and: [
                              { $eq: ['$$l.linkModel', 'Personnel'] },
                              { $eq: ['$$l.link', '$_id'] },
                            ],
                          },
                        },
                      },
                      as: 'l',
                      in: {
                        company: {
                          _id: '$$this._id',
                          name: '$$this.name',
                          nameChinese: '$$this.nameChinese',
                          registrationNumber: '$$this.registrationNumber',
                          type: '$$this.type',
                          status: '$$this.status',
                        },
                        roles: '$$l.roles',
                        shares: '$$l.shares',
                        shareType: '$$l.shareType',
                        appointmentDate: '$$l.appointmentDate',
                        cessationDate: '$$l.cessationDate',
                        notes: '$$l.notes',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ])

    if (!result) return res.status(404).json({ message: 'Personnel not found' })

    // 2) 公司维度关联：顶层 $in 走各自索引（tasks/meetings/reminders.company / documents.personnel）
    const companyIds = (result.companies || []).map((c) => c.company._id)
    const [tasks, meetings, reminders, documents] = await Promise.all([
      Task.find({
        $or: [{ company: { $in: companyIds } }, { personnel: personId }],
      }).sort({ dueDate: 1 }),
      Meeting.find({
        $or: [{ company: { $in: companyIds } }, { 'attendees.ref': personId }],
      }).sort({ scheduledAt: -1 }),
      ComplianceReminder.find({ company: { $in: companyIds } }).sort({ dueDate: 1 }),
      Document.find({ personnel: personId }).sort({ createdAt: -1 }),
    ])

    // 角色汇总（读时聚合自 Company.links.roles）
    const roleSet = new Set()
    ;(result.companies || []).forEach((c) => (c.roles || []).forEach((r) => roleSet.add(r)))

    // 剥离中间字段 companyDocs，组装响应
    const { _companyDocs, companies, ...personnel } = result

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

    // 清理反向引用，避免悬空指针
    const pid = person._id;
    await Promise.all([
      Company.updateMany({ 'links.link': pid }, { $pull: { links: { link: pid } } }),
      Meeting.updateMany({ 'attendees.ref': pid }, { $pull: { attendees: { ref: pid } } }),
      Document.updateMany({ personnel: pid }, { $unset: { personnel: '' } }),
      Task.updateMany({ personnel: pid }, { $unset: { personnel: '' } }),
      SignTask.updateMany({ 'signers.signer': pid }, { $pull: { signers: { signer: pid } } }),
    ]);

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
    // 迁移完成后遗留表应废弃；默认不再双写，避免与 Company.links 单一事实源漂移
    if (process.env.KEEP_LEGACY_ENTRIES) {
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
    }

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
