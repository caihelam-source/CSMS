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
 * 为某条规则+公司生成提醒（支持多级提醒）
 */
async function generateRemindersForRule(rule, company) {
  if (rule.status !== '启用') return { created: 0, skipped: 0 };
  if (rule.baseDateType === 'trigger') return { created: 0, skipped: 0 };

  const dueDate = calcDueDate(rule, company);
  if (!dueDate) return { created: 0, skipped: 0 };

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

  return { created, skipped };
}

/**
 * 批量为多条规则+多家公司生成提醒
 */
async function generateBatch(ruleIds, companyIds) {
  const rules = await ComplianceRule.find({ _id: { $in: ruleIds }, status: '启用' });
  const companies = await Company.find({ _id: { $in: companyIds } });

  let totalCreated = 0, totalSkipped = 0;
  for (const rule of rules) {
    for (const company of companies) {
      // 检查规则适用性
      if (rule.jurisdiction !== 'ALL' && rule.jurisdiction !== company.jurisdiction) continue;
      if (rule.isListedOnly && !company.isListed) continue;
      if (rule.listingLocation && company.listingLocation !== rule.listingLocation) continue;

      const { created, skipped } = await generateRemindersForRule(rule, company);
      totalCreated += created;
      totalSkipped += skipped;
    }
  }
  return { created: totalCreated, skipped: totalSkipped };
}

/**
 * 为一条规则的所有已应用公司生成提醒
 */
async function generateForRule(rule) {
  const companies = await Company.find({ _id: { $in: rule.appliedCompanies } });
  let totalCreated = 0, totalSkipped = 0;
  for (const company of companies) {
    const { created, skipped } = await generateRemindersForRule(rule, company);
    totalCreated += created;
    totalSkipped += skipped;
  }
  return { created: totalCreated, skipped: totalSkipped };
}

module.exports = { initPresetRules, generateRemindersForRule, generateBatch, generateForRule, calcDueDate };
