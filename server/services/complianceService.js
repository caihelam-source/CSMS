const ComplianceRule = require('../models/ComplianceRule');
const ComplianceReminder = require('../models/ComplianceReminder');
const Company = require('../models/Company');
const PRESET_RULES = require('./presetRules');

/**
 * 初始化预设规则（启动时调用，upsert 模式）
 * - 以 ruleId 为唯一键（等价于「ruleName + jurisdiction」的稳定唯一键）
 * - 仅覆盖预设定义字段，保留用户可能修改的 status / appliedCompanies / customFields 等
 */
const PRESET_DEFINITION_FIELDS = [
  'ruleName', 'description', 'category', 'legalReference',
  'jurisdiction', 'isListedOnly', 'listingLocation',
  // companyScope：NAR1/NN3 互斥的结构化表达（见 ruleApplicability）。
  // 必须在表里，否则 initPresetRules 的 upsert 不会把它写进既有库记录。
  'companyScope',
  'baseDateType', 'baseDateOffset', 'dueDateOffset', 'anchorPayload', 'condition',
  'reminderDays', 'priority', 'penaltyNote', 'specialNote', 'isPreset',
];

/**
 * 判断一条规则是否适用于一家公司。
 * 返回 null = 适用；否则返回不适用原因（会作为 blockedByReason 的 key 回传前端）。
 *
 * 关键语义（v6.x）：
 *  1) **并行适用**：注册地非香港、但标记为「在港注册的非香港公司」
 *     （Company.nonHongKongCompany=true）的公司，除适用其自身注册地规则外，
 *     同时**并行**适用香港规则（rule.jurisdiction === 'HK'）。
 *     典型场景：开曼/BVI 公司在港上市并在港注册 → 既守开曼规则，也守香港规则。
 *  2) **NAR1 / NN3 互斥**：周年申报表二者只能其一——
 *       companyScope='HK_LOCAL'  → 仅香港本地公司，排除 nonHongKongCompany=true（NAR1）
 *       companyScope='HK_NON_HK' → 仅 nonHongKongCompany=true 的公司（NN3）
 *     该约束不能靠 condition 文本表达：引擎不解析 condition，它只是给人看的说明。
 *  3) companyScope 缺省（存量老规则为 undefined）时按 'ANY' 处理，行为与改动前一致，向后兼容。
 */
function ruleApplicability(rule, company) {
  const isNonHkReg = !!company.nonHongKongCompany;

  // 1) 注册地匹配（含在港注册非香港公司对 HK 规则的并行适用）
  const jurisdictionMatch =
    rule.jurisdiction === 'ALL' ||
    rule.jurisdiction === company.jurisdiction ||
    (isNonHkReg && rule.jurisdiction === 'HK');
  if (!jurisdictionMatch) return 'jurisdiction_mismatch';

  // 2) 主体范围（NAR1 / NN3 互斥）
  if (rule.companyScope === 'HK_LOCAL' && isNonHkReg) return 'hk_local_only';
  if (rule.companyScope === 'HK_NON_HK' && !isNonHkReg) return 'requires_non_hk_registration';

  // 3) 上市相关
  if (rule.isListedOnly && !company.isListed) return 'not_listed';
  if (rule.listingLocation && company.listingLocation !== rule.listingLocation) {
    return 'listing_location_mismatch';
  }
  return null;
}

async function initPresetRules() {
  let added = 0, updated = 0, skipped = 0;
  for (const rule of PRESET_RULES) {
    const existing = await ComplianceRule.findOne({ ruleId: rule.ruleId });
    if (!existing) {
      await ComplianceRule.create(rule);
      added++;
    } else {
      // 仅覆盖预设定义字段；保留用户自定义字段（status / appliedCompanies / customFields 等）
      const set = {};
      for (const k of PRESET_DEFINITION_FIELDS) {
        if (k in rule) set[k] = rule[k];
      }
      await ComplianceRule.updateOne({ ruleId: rule.ruleId }, { $set: set });
      updated++;
    }
  }
  console.log(`✅ 合规规则初始化完成: 新增 ${added}, 更新 ${updated}, 跳过 ${skipped}`);
}

/**
 * 根据公司信息计算某条规则的截止日期（通用版，无硬编码分支）
 *
 * 符号约定：
 *   - incorporationDate / financialYearEnd：dueDateOffset 正数 = 截止日后再加 N 天（相加）
 *   - fixed / reference(BR)：dueDateOffset 正数 = 提前 N 天（相减）
 *   - trigger：返回 null（不自动计算）
 *
 * anchorPayload：
 *   - { m, d }             → 每年该月该日（如 {m:1,d:31} = 1月31日）
 *   - { reference:'brExpiryDate' } → 以公司 brExpiryDate 为基准（BR 续期）
 *   - HKEX_MONTHLY_RETURN  → 特殊：每月第 5 个营业日，保持原「相加」语义
 */
function calcDueDate(rule, company) {
  if (rule.baseDateType === 'trigger') return null;

  const today = new Date();
  const year = today.getFullYear();
  const ap = rule.anchorPayload;
  let baseDate = null;

  if (rule.baseDateType === 'incorporationDate') {
    if (!company.incorporationDate) return null;
    const inc = new Date(company.incorporationDate);
    if (isNaN(inc.getTime())) return null;
    baseDate = new Date(year, inc.getMonth(), inc.getDate());
    if (baseDate < today) baseDate.setFullYear(year + 1);
    baseDate = addDays(baseDate, (rule.baseDateOffset || 365) - 365);
  } else if (rule.baseDateType === 'financialYearEnd') {
    const fye = company.financialYearEnd;
    if (!fye) return null;
    let mm, dd;
    // 主格式：{ day, month } 对象（Company 模型定义）
    if (fye.month != null && fye.day != null) {
      mm = fye.month;
      dd = fye.day;
    } else if (typeof fye === 'string') {
      // 向后兼容：旧字符串格式 "MM-DD"
      [mm, dd] = fye.split('-').map(Number);
    } else {
      return null;
    }
    if (!mm || !dd) return null;
    baseDate = new Date(year, mm - 1, dd); // month 需减 1（JS Date 月份从 0 起）
    if (baseDate < today) baseDate.setFullYear(year + 1);
    baseDate = addDays(baseDate, rule.baseDateOffset || 0);
  } else if (rule.baseDateType === 'fixed') {
    if (ap && ap.reference === 'brExpiryDate') {
      // BR 续期：以公司 brExpiryDate 为基准，不滚动到次年
      if (!company.brExpiryDate) return null;
      const d = new Date(company.brExpiryDate);
      if (isNaN(d.getTime())) return null;
      baseDate = d;
    } else if (ap && ap.m && ap.d) {
      baseDate = new Date(year, ap.m - 1, ap.d);
      if (baseDate < today) baseDate.setFullYear(year + 1);
    } else if (rule.ruleId === 'HKEX_MONTHLY_RETURN') {
      // 月报：下月第 5 天（保留特殊逻辑）
      baseDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);
    } else {
      return null;
    }
  }

  if (!baseDate) return null;

  const offset = rule.dueDateOffset || 0;
  // fixed 类（除 HKEX 月报）提前 N 天 → 相减；其余（含 HKEX 月报）截止日后再加 N 天 → 相加
  const sign = (rule.baseDateType === 'fixed' && rule.ruleId !== 'HKEX_MONTHLY_RETURN') ? -1 : 1;
  return addDays(baseDate, sign * offset);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 诊断某条规则对某公司为何无法计算截止日（供生成统计的 blocked 明细使用）。
 * 仅覆盖"因公司缺字段"的情况；jurisdiction/isListed/listingLocation 不适用由调用方记录。
 * @returns {{reason:string, missingFields:string[]}}
 */
function diagnoseDueDate(rule, company) {
  const missing = [];
  if (rule.baseDateType === 'incorporationDate' && !company.incorporationDate) {
    missing.push('incorporationDate');
  } else if (rule.baseDateType === 'financialYearEnd') {
    const fye = company.financialYearEnd;
    if (!fye || fye.month == null || fye.day == null) missing.push('financialYearEnd');
  } else if (rule.baseDateType === 'fixed') {
    const ap = rule.anchorPayload;
    if (ap && ap.reference === 'brExpiryDate' && !company.brExpiryDate) {
      missing.push('brExpiryDate');
    }
  }
  return { reason: missing.length ? 'missing_field' : 'other', missingFields: missing };
}

/**
 * 只读诊断所有公司的合规计算日期字段缺口（incorporationDate / financialYearEnd / brExpiryDate）。
 * 把生成阶段的 blocked 黑洞转化为可操作的工作清单，无任何写副作用。
 * @returns {{companies:Array, companiesWithGaps:number, totalCompanies:number, summary:{byField:Object,totalMissing:number}}}
 */
function companyMissingFields(company) {
  const missing = [];
  if (!company.incorporationDate) missing.push('incorporationDate');
  const fye = company.financialYearEnd;
  if (!fye || fye.month == null || fye.day == null) missing.push('financialYearEnd');
  if (!company.brExpiryDate) missing.push('brExpiryDate');
  return missing;
}

async function diagnoseCompanies() {
  const companies = await Company.find({}).lean();
  const byField = {};
  const list = companies.map((c) => {
    const missing = companyMissingFields(c);
    missing.forEach((f) => { byField[f] = (byField[f] || 0) + 1; });
    return {
      _id: c._id,
      name: c.name,
      nameChinese: c.nameChinese,
      jurisdiction: c.jurisdiction,
      isListed: c.isListed,
      missingFields: missing,
    };
  });
  const companiesWithGaps = list.filter((c) => c.missingFields.length > 0).length;
  const totalMissing = Object.values(byField).reduce((a, b) => a + b, 0);
  return {
    companies: list,
    companiesWithGaps,
    totalCompanies: list.length,
    summary: { byField, totalMissing },
  };
}

/**
 * 为某条规则+公司生成提醒（支持多级提醒）
 */
async function generateRemindersForRule(rule, company) {
  if (rule.status !== '启用') return { created: 0, skipped: 0, blocked: 0, blockedReason: 'rule_disabled', missingFields: [] };
  if (rule.baseDateType === 'trigger') return { created: 0, skipped: 0, blocked: 0, blockedReason: 'trigger', missingFields: [] };

  const dueDate = calcDueDate(rule, company);
  if (!dueDate) {
    const diag = diagnoseDueDate(rule, company);
    return { created: 0, skipped: 0, blocked: 1, blockedReason: diag.reason, missingFields: diag.missingFields };
  }

  let created = 0, skipped = 0;

  // 去重：同公司+规则+截止日期只创建一次
  const existing = await ComplianceReminder.findOne({
    company: company._id,
    rule: rule._id,
    dueDate: dueDate,
  });
  if (existing) return { created: 0, skipped: 1 };

  // 取最早的提醒日
  const reminderDays = rule.reminderDays && rule.reminderDays.length > 0 ? rule.reminderDays : [30];
  const earliestReminderDate = addDays(dueDate, -Math.max(...reminderDays));

  try {
    await ComplianceReminder.create({
      company: company._id,
      rule: rule._id,
      ruleId: rule.ruleId,
      // 关键修复：填充 sourceRuleId（与模型设计语义「生成提醒去重用」一致）。
      // 此前未填，所有提醒落到稀疏唯一索引 (company, sourceRuleId, year) 的
      // (company, null, null) 桶，导致同一公司第 2 条及之后的提醒全部撞 E11000
      // （被 generateRemindersForRule 的 catch 静默计为 skipped，无法生成）。
      sourceRuleId: rule.ruleId,
      // year：按到期日所在年填充，使年度循环类提醒在该稀疏索引下按年去重、互不冲突。
      year: dueDate ? dueDate.getUTCFullYear() : undefined,
      title: `${rule.ruleName} - ${company.name}`,
      description: rule.description,
      category: rule.category,
      dueDate,
      reminderDate: earliestReminderDate,
      reminderLevel: 1,
      priority: rule.priority,
      status: '待办',
    });
    created++;
  } catch (err) {
    if (err.code === 11000) skipped++; // 重复
    else throw err;
  }

  return { created, skipped, blocked: 0, missingFields: [] };
}

/**
 * 批量为多条规则+多家公司生成提醒
 */
async function generateBatch(ruleIds, companyIds) {
  const rules = await ComplianceRule.find({ _id: { $in: ruleIds }, status: '启用' });
  const companies = await Company.find({ _id: { $in: companyIds } });

  let totalCreated = 0, totalSkipped = 0, totalBlocked = 0;
  const blockedByField = {};
  const blockedByReason = {};
  const blockedDetails = [];

  const recordBlock = (reason, rule, company, missingFields = []) => {
    totalBlocked++;
    blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
    if (missingFields && missingFields.length) {
      for (const f of missingFields) blockedByField[f] = (blockedByField[f] || 0) + 1;
    }
    if (blockedDetails.length < 50) {
      blockedDetails.push({ ruleId: rule.ruleId, company: company.name, reason, missingFields });
    }
  };

  for (const rule of rules) {
    for (const company of companies) {
      // 检查规则适用性（记录不适用原因，避免静默跳过）
      // 统一走 ruleApplicability：注册地匹配 + 在港注册非香港公司的 HK 规则并行适用 + NAR1/NN3 互斥
      const notApplicable = ruleApplicability(rule, company);
      if (notApplicable) {
        recordBlock(notApplicable, rule, company);
        continue;
      }

      const r = await generateRemindersForRule(rule, company);
      totalCreated += r.created;
      totalSkipped += r.skipped;
      if (r.blocked) {
        recordBlock(r.blockedReason || 'other', rule, company, r.missingFields);
      }
    }
  }
  return { created: totalCreated, skipped: totalSkipped, blocked: totalBlocked, blockedByField, blockedByReason, blockedDetails };
}

/**
 * 为一条规则的所有已应用公司生成提醒
 */
async function generateForRule(rule, companyIds) {
  const ids = (companyIds && Array.isArray(companyIds) && companyIds.length) ? companyIds : rule.appliedCompanies;
  const companies = await Company.find({ _id: { $in: ids } });
  let totalCreated = 0, totalSkipped = 0, totalBlocked = 0;
  const blockedByField = {};
  const blockedByReason = {};
  const blockedDetails = [];

  const recordBlock = (reason, company, missingFields = []) => {
    totalBlocked++;
    blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
    if (missingFields && missingFields.length) {
      for (const f of missingFields) blockedByField[f] = (blockedByField[f] || 0) + 1;
    }
    if (blockedDetails.length < 50) {
      blockedDetails.push({ ruleId: rule.ruleId, company: company.name, reason, missingFields });
    }
  };

  for (const company of companies) {
    const r = await generateRemindersForRule(rule, company);
    totalCreated += r.created;
    totalSkipped += r.skipped;
    if (r.blocked) {
      recordBlock(r.blockedReason || 'other', company, r.missingFields);
    }
  }
  return { created: totalCreated, skipped: totalSkipped, blocked: totalBlocked, blockedByField, blockedByReason, blockedDetails };
}

/**
 * 为单家公司 ensure 启用规则对应的开放提醒。
 * 与 /recompute 的区别：ensure 只 generate（不删任何提醒），内部已去重，幂等。
 * 用途：NAR1 导入建档后 / CompanyDetail 首访自愈 / 状态位「生成提醒」按钮。
 * 返回 { ensured, created, skipped, blocked, reasons[] }
 */
async function ensureCompanyReminders(companyId, ruleIds = []) {
  const company = await Company.findById(companyId);
  if (!company) return { ensured: false, reason: 'company_not_found' };
  const query = { status: '启用' };
  if (Array.isArray(ruleIds) && ruleIds.length) query.ruleId = { $in: ruleIds };
  const rules = await ComplianceRule.find(query);
  let created = 0, skipped = 0, blocked = 0;
  const reasons = [];
  for (const rule of rules) {
    // 与 generateBatch 共用同一套适用性判定（并行适用 + NAR1/NN3 互斥），避免两条链路结果不一致
    const notApplicable = ruleApplicability(rule, company);
    if (notApplicable) {
      reasons.push({ ruleId: rule.ruleId, reason: notApplicable });
      continue;
    }
    const r = await generateRemindersForRule(rule, company);
    created += r.created;
    skipped += r.skipped;
    if (r.blocked) {
      blocked++;
      reasons.push({ ruleId: rule.ruleId, reason: r.blockedReason, missingFields: r.missingFields });
    }
  }
  return { ensured: true, created, skipped, blocked, reasons };
}

/**
 * 批量更新合规规则状态（按 ids 或按 jurisdiction）。
 * - 参数互斥：ids 与 jurisdiction 至少传一个；二者均传时，ids 优先（更精细）
 * - status 严格白名单（与 ComplianceRule.status enum 对齐：['启用','停用']）
 * - 返回 matched/modified + 已更新文档摘要，供前端 toast 用
 *
 * 触发场景：
 *  1. 「合规规则」页 jurisdiction Tab 顶部「启用当前分组全部 / 停用当前分组全部」
 *  2. 后续如果接入「按公司批量适配规则」也可复用
 */
async function bulkUpdateStatus({ ids, jurisdiction, status } = {}) {
  const VALID = ['启用', '停用']
  if (!VALID.includes(status)) {
    throw new Error(`status 必须是 ${VALID.join('|')}`)
  }
  const query = {}
  let scope = ''
  if (Array.isArray(ids) && ids.length) {
    query._id = { $in: ids }
    scope = `ids(${ids.length})`
  } else if (jurisdiction) {
    query.jurisdiction = jurisdiction
    scope = `jurisdiction=${jurisdiction}`
  } else {
    throw new Error('ids / jurisdiction 至少传一个')
  }
  const result = await ComplianceRule.updateMany(query, { $set: { status } })
  const rules = await ComplianceRule.find(query).select('_id ruleName jurisdiction status').lean()
  return { matched: result.matchedCount || 0, modified: result.modifiedCount || 0, scope, rules }
}

module.exports = { initPresetRules, generateRemindersForRule, generateBatch, generateForRule, ensureCompanyReminders, bulkUpdateStatus, calcDueDate, diagnoseCompanies, ruleApplicability };
