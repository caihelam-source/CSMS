// Wave 0 rev2 — 行级权限全局 Query Filter 中间件
// 规则：
//  - admin / auditor：行级豁免（req.scopeCompanies = null → 不注入任何公司约束）
//      · admin 全量读写；auditor 仅只读（写操作由 rbac 拦截），但可跨公司查看以满足审计需要
//  - secretary / manager / viewer：受 User.accessibleCompanies 约束
//      req.scopeCompanies = 可访问公司 ID 数组（可能为空 → 看不到任何公司数据）
//
// 用法：
//  router.get('/', auth, scopeMiddleware, async (req, res) => {
//    const query = {};
//    applyListScope(query, req, 'company'); // Document/Meeting/Task 用 'company'，Company 用 '_id'
//    ...
//  })
//  // 详情接口越权检查
//  if (!inScope(req, resource.company?._id || resource.company)) return res.status(403).json(...)

const mongoose = require('mongoose');
const Company = require('../models/Company');
const { SCOPE_BYPASS_ROLES } = require('./rbac');

// 计算当前用户的可见公司 ID 列表；null 表示不受限
function getScopeCompanies(req) {
  const user = req.user;
  if (!user) return null;
  if (SCOPE_BYPASS_ROLES.includes(user.role)) return null;
  const ids = (user.accessibleCompanies || []).map((id) => id.toString());
  return ids;
}

// Express 中间件：在 auth 之后挂载，把 scope 结果挂到 req 上
const scopeMiddleware = (req, res, next) => {
  req.scopeCompanies = getScopeCompanies(req);
  next();
};

// 把行级约束注入列表查询
// field: 'company'（Document/Meeting/Task）或 '_id'（Company 自身）
function applyListScope(query, req, field = 'company') {
  const ids = req.scopeCompanies;
  if (ids === null) return query; // admin / auditor 不受限
  if (field === '_id') {
    query._id = { $in: ids };
  } else {
    query[field] = { $in: ids };
  }
  return query;
}

// 详情越权检查：返回 true 表示允许访问
function inScope(req, companyId) {
  const ids = req.scopeCompanies;
  if (ids === null) return true; // admin / auditor 不受限
  if (!companyId) return false;
  return ids.includes(companyId.toString());
}

// ── Personnel 数据范围（反查）──────────────────────────────────────────────
// Personnel 本身无 company 字段，唯一事实源是 Company.links[{ link, linkModel:'Personnel' }]。
// 因此人员的可见性必须通过「可见公司 → links 反查」得到。

// 把 scope 里的公司 ID 字符串转成合法 ObjectId 数组（跳过非法值，避免 CastError）
function toObjectIds(ids) {
  return (ids || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

// 解析当前用户 scope 内的人员 ID 列表
// 返回 null 表示不受限（admin/auditor）；返回 [] 表示明确无授权（结果应为空）
async function resolvePersonnelIdsInScope(req) {
  const ids = req.scopeCompanies;
  if (ids === null) return null; // 不受限
  if (!ids.length) return []; // 明确无授权 → 空集合（绝不可当成"不限"）
  const oids = toObjectIds(ids);
  if (!oids.length) return [];
  const rows = await Company.aggregate([
    { $match: { _id: { $in: oids } } },
    { $unwind: '$links' },
    { $match: { 'links.linkModel': 'Personnel' } },
    { $group: { _id: '$links.link' } },
  ]);
  return rows.map((r) => r._id);
}

// 人员详情越权检查：该人员是否在当前用户可见公司的 links 中
async function personnelInScope(req, personnelId) {
  const ids = req.scopeCompanies;
  if (ids === null) return true; // 不受限
  if (!ids.length || !personnelId) return false;
  const oids = toObjectIds(ids);
  if (!oids.length) return false;
  const hit = await Company.exists({
    _id: { $in: oids },
    links: { $elemMatch: { linkModel: 'Personnel', link: personnelId } },
  });
  return !!hit;
}

module.exports = {
  scopeMiddleware,
  applyListScope,
  inScope,
  getScopeCompanies,
  toObjectIds,
  resolvePersonnelIdsInScope,
  personnelInScope,
};
