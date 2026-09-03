// queryAlias.js — 把公司/人员等引用型查询参数的两种命名归一为规范名。
// 背景：前端 services 习惯以 companyId / personnelId / meetingId 传 ID，
//       但部分 GET 路由以 company / personnel / meeting 为规范名。
//       历史上两套命名都在被调用，错配会静默丢失过滤条件 → 跨公司/跨人串台事故。
// 约定：
//   规范名 (preferred)  = 模型字段名（company / personnel / meeting）
//   别名     (alias)    = 以 Id 结尾的常见写法（companyId / personnelId / meetingId）
// 行为：canonical > alias（前者胜，避免传两个时歧义）
//
// 用法：
//   const ref = pickRef(req.query, 'company');
//   if (ref) query.company = ref;
//
// 防退化测试：scripts/__test_query_alias.js

function pickRef(query, field) {
  if (!query) return undefined;
  const preferred = query[field];
  const alias = query[`${field}Id`];
  return preferred || alias || undefined;
}

module.exports = { pickRef };
