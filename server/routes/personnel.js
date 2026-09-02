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
const { findPersonnelDuplicates, extractBracketAliases } = require('../utils/personnelDedup');
const { auth } = require('../middleware/auth');
const {
  scopeMiddleware,
  inScope,
  toObjectIds,
  resolvePersonnelIdsInScope,
  personnelInScope,
} = require('../middleware/scope');

const router = express.Router();

// GET /api/personnel — 人员列表（支持搜索/筛选）
// v5.0 读时聚合：role / company 过滤与 roles 标签均从 Company.links 派生，不依赖 stored appointments
router.get('/', auth, scopeMiddleware, async (req, res) => {
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

    // 行级数据范围：人员靠 Company.links 反查（Personnel 无 company 字段）
    // 语义：null=不受限；[]=明确无授权（结果为空）；[...]=受限
    // 与用户显式传入的 ?company= 取「交集」而非覆盖 —— 越权公司过滤后为空列表（无声过滤，不报 403）
    // v6.x：默认排除已合并（status='merged'）的源人员，避免列表出现重复；?includeMerged=true 可显式包含
    if (req.query.includeMerged !== 'true') {
      query.status = { $ne: 'merged' }
    }
    const scopedPids = await resolvePersonnelIdsInScope(req);
    if (scopedPids !== null) {
      const allow = new Set(scopedPids.map(String));
      query._id = query._id && query._id.$in
        ? { $in: query._id.$in.filter((id) => allow.has(String(id))) }
        : { $in: scopedPids };
    }

    // 分页（opt-in：仅当传 page/limit 时启用，兼容旧前端全量拉取）
    const usePaging = !!(page || limit);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
    const total = await Personnel.countDocuments(query);

    let q = Personnel.find(query).lean().sort({ name: 1 });
    if (usePaging) q = q.skip((pageNum - 1) * limitNum).limit(limitNum);
    const personnel = await q;

    // 读时聚合：派生的 roles（来自 Company.links），覆盖 stored roles
    // 受限用户只能从可见公司派生角色标签，否则会带出越权公司的角色（信息泄露）
    const roleScopeStages = req.scopeCompanies === null
      ? []
      : [{ $match: { _id: { $in: toObjectIds(req.scopeCompanies) } } }];
    const roleAgg = await Company.aggregate([
      ...roleScopeStages,
      { $unwind: '$links' },
      { $match: { 'links.linkModel': 'Personnel' } },
      { $unwind: '$links.roles' },
      { $group: { _id: '$links.link', roles: { $addToSet: '$links.roles' } } },
    ]);
    const roleMap = new Map(roleAgg.map(r => [r._id.toString(), r.roles]));
    const result = personnel.map(p => {
      // .lean() 返回纯对象，不能调用 toObject()
      const obj = p.toObject ? p.toObject() : { ...p };
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
router.get('/:id', auth, scopeMiddleware, async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id).lean();
    if (!person) return res.status(404).json({ message: 'Personnel not found' });

    // 详情接口越权直接 403（列表是无声过滤，详情才报错）
    if (!(await personnelInScope(req, person._id))) {
      return res.status(403).json({ message: 'Forbidden: out of data scope' });
    }

    const allCompanies = await Company.find({ 'links.link': person._id, 'links.linkModel': 'Personnel' }).lean()
      .select('name nameChinese registrationNumber type status links');
    // 反查到的公司也要按 scope 裁剪，避免通过人员详情泄露越权公司
    const companies = allCompanies.filter(c => inScope(req, c._id));
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

    // 详情接口越权直接 403
    if (!(await personnelInScope(req, personId))) {
      return res.status(403).json({ message: 'Forbidden: out of data scope' })
    }

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

    // 剥离中间字段 companyDocs，组装响应
    const { _companyDocs, companies, ...personnel } = result

    // 行级数据范围：聚合结果后置 JS 裁剪（aggregate 内联过滤成本高且易漏，统一在出口收口）
    const byCompany = (x) => inScope(req, x?.company?._id || x?.company)
    const visibleCompanies = (companies || []).filter((c) => inScope(req, c.company?._id))
    // 文档：有 company 归属按公司判定；仅挂人员的文档随「人员本身已通过 403 校验」可见
    // （与前端 useScopedDocuments 的 company → personnel 回退语义保持一致）
    const byDocument = (d) => (d?.company ? byCompany(d) : !!d?.personnel)

    // 角色汇总（读时聚合自 Company.links.roles）—— 只统计可见公司，避免越权角色标签泄露
    const roleSet = new Set()
    visibleCompanies.forEach((c) => (c.roles || []).forEach((r) => roleSet.add(r)))

    res.json({
      data: {
        data: {
          personnel: { ...personnel, roles: [...roleSet] },
          companies: visibleCompanies,
          tasks: (tasks || []).filter(byCompany),
          meetings: (meetings || []).filter(byCompany),
          documents: (documents || []).filter(byDocument),
          reminders: (reminders || []).filter(byCompany),
        },
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
router.get('/:id/aggregate', auth, scopeMiddleware, getByPersonnelAPI);

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
// v6.x：使用 personnelDedup 三层匹配（exact_nric / exact_chinese / alias / pinyin），
// 能识别「纯中文 ↔ 拼音+中文」变体（如 施金帆 ↔ JINFAN / 施金帆）。
router.get('/duplicates', auth, async (req, res) => {
  try {
    const all = await Personnel.find({ status: { $ne: 'merged' } }).lean();
    const pairs = findPersonnelDuplicates(all);

    if (!pairs.length) {
      return res.json({ success: true, duplicates: [], total: 0 });
    }

    // 并查集：把 pair 收敛为「重复组」（施南路 3 条记录 → 1 组）
    const parent = {};
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const union = (a, b) => { parent[find(a)] = find(b) }
    const idSet = new Set()
    pairs.forEach((p) => {
      const a = String(p.a._id), b = String(p.b._id)
      idSet.add(a); idSet.add(b)
      if (!parent[a]) parent[a] = a
      if (!parent[b]) parent[b] = b
      union(a, b)
    })
    const groups = {}
    idSet.forEach((id) => {
      const root = find(id)
      if (!groups[root]) groups[root] = []
      groups[root].push(id)
    })

    // 每组：找 link 数最多的成员作为建议 target（保住 Company.links 任职数据）
    const linkCounts = {}
    await Promise.all([...idSet].map(async (id) => {
      linkCounts[id] = await Company.countDocuments({ 'links.link': id, 'links.linkModel': 'Personnel' })
    }))
    const byId = new Map(all.map((r) => [String(r._id), r]))

    const duplicateGroups = Object.values(groups).map((ids) => {
      const members = ids.map((id) => byId.get(id)).filter(Boolean)
      // 建议 target：link 数最多 → 有 nameChinese → roles 多 → 名字更「标准」(含中文且不含空格)
      const scored = members.map((m) => ({
        m,
        score: (linkCounts[String(m._id)] || 0) * 100
          + (m.nameChinese ? 10 : 0)
          + (m.roles ? m.roles.length : 0)
          + (/[一-鿿]/.test(m.name) && !/\s/.test(m.name) ? 1 : 0),
      }))
      scored.sort((x, y) => y.score - x.score)
      const target = scored[0].m
      return {
        key: ids.slice().sort().join('|'),
        count: members.length,
        name: target.name + (target.nameChinese ? ' / ' + target.nameChinese : ''),
        suggestedTargetId: String(target._id),
        records: members.map((r) => ({
          _id: r._id,
          name: r.name,
          nameChinese: r.nameChinese || '',
          nric: r.nric || '',
          email: r.email || '',
          phone: r.phone || '',
          linkCount: linkCounts[String(r._id)] || 0,
          roles: r.roles || [],
        })),
      }
    })

    res.json({ success: true, duplicates: duplicateGroups, total: duplicateGroups.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Merge personnel — POST /api/personnel/merge
// v6.x 软合并（与公司同构）：迁移全部 7 类引用 → 追加 formerNames 到 target → 保最佳数据 →
// 将源 status='merged' + mergedInto=target（零数据丢失，可回滚方向）。不再硬删源。
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
    if (target.status === 'merged' || source.status === 'merged') {
      return res.status(409).json({ message: 'Cannot merge with an already-merged record' });
    }

    const sourceObj = new mongoose.Types.ObjectId(sourceId);
    const targetObj = new mongoose.Types.ObjectId(targetId);

    // 1) 迁移全部 7 类引用
    await Promise.all([
      // a) Company.links（单一事实源）
      Company.updateMany(
        { 'links.link': sourceObj, 'links.linkModel': 'Personnel' },
        { $set: { 'links.$[elem].link': targetObj } },
        { arrayFilters: [{ 'elem.link': sourceObj, 'elem.linkModel': 'Personnel' }] },
      ),
      // b) DirectorEntry.personnelRef
      DirectorEntry.updateMany({ personnelRef: sourceId }, { $set: { personnelRef: targetId } }),
      // c) ShareholderEntry.personnelRef
      ShareholderEntry.updateMany({ personnelRef: sourceId }, { $set: { personnelRef: targetId } }),
      // d) Meeting.attendees.ref
      Meeting.updateMany(
        { 'attendees.ref': sourceId },
        { $set: { 'attendees.$.ref': targetId, 'attendees.$.name': target.name } },
      ),
      // e) Document.personnel
      Document.updateMany({ personnel: sourceId }, { $set: { personnel: targetId } }),
      // f) SignTask：顶层 signer + signers[] 数组（双写兼容）
      SignTask.updateMany({ signer: sourceId }, { $set: { signer: targetId, signerName: target.name } }),
      SignTask.updateMany(
        { 'signers.signer': sourceId },
        { $set: { 'signers.$[s].signer': targetId } },
        { arrayFilters: [{ 's.signer': sourceObj }] },
      ),
      // g) Task.personnel
      Task.updateMany({ personnel: sourceId }, { $set: { personnel: targetId } }),
    ]);

    // 2) 重算 target.roles（从 Company.links 读时聚合）
    const targetCos = await Company.find({ 'links.link': targetObj, 'links.linkModel': 'Personnel' }, 'links')
    target.roles = [...new Set(
      targetCos.flatMap((c) => (c.links || [])
        .filter((l) => l.linkModel === 'Personnel' && l.link?.toString() === targetId)
        .flatMap((l) => l.roles || [])),
    )]

    // 3) 保最佳数据
    if (!target.nric && source.nric) target.nric = source.nric;
    if (!target.email && source.email) target.email = source.email;
    if (!target.phone && source.phone) target.phone = source.phone;
    if (!target.nameChinese && source.nameChinese) target.nameChinese = source.nameChinese;
    if (!target.nationality && source.nationality) target.nationality = source.nationality;
    if (source.notes && !target.notes) target.notes = source.notes;
    else if (source.notes) target.notes += '\n[来自合并] ' + source.notes;

    // 4) formerNames 入 target（源 name/nameChinese + 括注中文别名，如「施侃成」）
    const newFormer = [{
      name: source.name,
      nameChinese: source.nameChinese || undefined,
      changedAt: new Date(),
      source: 'merger',
      mergedFromPersonnelId: source._id,
    }]
    const aliases = extractBracketAliases(source.name)
    for (const al of aliases) {
      if (!target.formerNames?.some((f) => (f.nameChinese || f.name) === al)) {
        newFormer.push({ name: al, nameChinese: al, changedAt: new Date(), source: 'merger', mergedFromPersonnelId: source._id })
      }
    }
    target.formerNames = [...(target.formerNames || []), ...newFormer]

    await target.save()

    // 5) 软关 source（零数据丢失）
    source.status = 'merged'
    source.mergedInto = target._id
    source.mergedAt = new Date()
    source.mergedBy = req.user ? req.user._id : null
    await source.save()

    res.json({ success: true, message: 'Personnel merged successfully (soft)', personnel: target });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Manage formerNames — PUT /api/personnel/:id/former-names
// v6.x 对齐 Company：用户可手填/追加曾用名（中文名/别名），供 alias 重复检测与展示。
router.put('/:id/former-names', auth, async (req, res) => {
  try {
    const p = await Personnel.findById(req.params.id)
    if (!p) return res.status(404).json({ message: 'Personnel not found' })
    const list = Array.isArray(req.body.formerNames) ? req.body.formerNames : []
    p.formerNames = list.map((f) => ({
      name: f.name || undefined,
      nameChinese: f.nameChinese || undefined,
      changedAt: f.changedAt ? new Date(f.changedAt) : new Date(),
      source: f.source || 'manual',
      notes: f.notes || undefined,
    }))
    await p.save()
    res.json({ success: true, formerNames: p.formerNames })
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check duplicates on create — POST /api/personnel/check-duplicate
router.post('/check-duplicate', auth, async (req, res) => {
  try {
    const { name, nameChinese, nric, email } = req.body;
    let query = { $or: [] };

    if (nric) {
      query.$or.push({ nric: { $regex: nric.replace(/^demo-nric-/i, ''), $options: 'i' } });
    }
    if (name) {
      query.$or.push({ name: { $regex: `^${name}$`, $options: 'i' } });
    }
    if (nameChinese) {
      query.$or.push({ nameChinese: { $regex: `^${nameChinese}$`, $options: 'i' } });
    }
    if (email) {
      query.$or.push({ email });
    }

    if (!query.$or.length) query = {};
    const matches = await Personnel.find(query);
    const hasDuplicate = matches.length > 0;

    res.json({ success: true, hasDuplicate, duplicates: matches });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;
