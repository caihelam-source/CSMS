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
  'baseDateType', 'baseDateOffset', 'dueDateOffset', 'anchorPayload', 'condition',
  'reminderDays', 'priority', 'penaltyNote', 'specialNote', 'isPreset',
];

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
      if (rule.jurisdiction !== 'ALL' && rule.jurisdiction !== company.jurisdiction) {
        recordBlock('jurisdiction_mismatch', rule, company);
        continue;
      }
      if (rule.isListedOnly && !company.isListed) {
        recordBlock('not_listed', rule, company);
        continue;
      }
      if (rule.listingLocation && company.listingLocation !== rule.listingLocation) {
        recordBlock('listing_location_mismatch', rule, company);
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

module.exports = { initPresetRules, generateRemindersForRule, generateBatch, generateForRule, calcDueDate, diagnoseCompanies };
