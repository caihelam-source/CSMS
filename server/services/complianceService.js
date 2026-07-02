const ComplianceRule = require('../models/ComplianceRule');
const ComplianceReminder = require('../models/ComplianceReminder');
const Company = require('../models/Company');
const PRESET_RULES = require('./presetRules');

/**
 * 初始化预设规则（启动时调用，幂等）
 */
async function initPresetRules() {
  let added = 0, updated = 0, skipped = 0;
  for (const rule of PRESET_RULES) {
    const existing = await ComplianceRule.findOne({ ruleId: rule.ruleId });
    if (!existing) {
      await ComplianceRule.create(rule);
      added++;
    } else {
      // 更新描述/提醒天数等，但保留 appliedCompanies 和 status
      await ComplianceRule.updateOne(
        { ruleId: rule.ruleId },
        { $set: { ...rule, appliedCompanies: existing.appliedCompanies, status: existing.status } }
      );
      updated++;
    }
  }
  console.log(`✅ 合规规则初始化完成: 新增 ${added}, 更新 ${updated}, 跳过 ${skipped}`);
}

/**
 * 根据公司信息计算某条规则的截止日期
 */
function calcDueDate(rule, company) {
  if (rule.baseDateType === 'trigger') return null;

  const today = new Date();
  const year = today.getFullYear();
  let baseDate;

  if (rule.baseDateType === 'incorporationDate') {
    if (!company.incorporationDate) return null;
    const inc = new Date(company.incorporationDate);
    // 找到今年的周年日
    baseDate = new Date(year, inc.getMonth(), inc.getDate());
    if (baseDate < today) baseDate.setFullYear(year + 1);
    baseDate = addDays(baseDate, rule.baseDateOffset - 365); // baseDateOffset=365 表示周年日本身
  } else if (rule.baseDateType === 'financialYearEnd') {
    if (!company.financialYearEnd) return null;
    const [mm, dd] = company.financialYearEnd.split('-').map(Number);
    baseDate = new Date(year, mm - 1, dd);
    if (baseDate < today) baseDate.setFullYear(year + 1);
    baseDate = addDays(baseDate, rule.baseDateOffset);
  } else if (rule.baseDateType === 'fixed') {
    // CAY_ANNUAL_RETURN: 每年1月31日
    baseDate = new Date(year + 1, 0, 31);

    // HKEX_MONTHLY_RETURN: 下月第5天
    if (rule.ruleId === 'HKEX_MONTHLY_RETURN') {
      baseDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);
    }
  }

  if (!baseDate) return null;

  // BVI_ANNUAL_FEE 特殊处理
  if (rule.ruleId === 'BVI_ANNUAL_FEE') {
    if (!company.incorporationDate) return null;
    const incMonth = new Date(company.incorporationDate).getMonth() + 1;
    baseDate = incMonth <= 6
      ? new Date(year, 4, 31)   // 5月31日
      : new Date(year, 10, 30); // 11月30日
    if (baseDate < today) baseDate.setFullYear(year + 1);
    return baseDate;
  }

  return addDays(baseDate, rule.dueDateOffset);
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
      if (rule.jurisdiction !== '全部' && rule.jurisdiction !== company.jurisdiction) continue;
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
