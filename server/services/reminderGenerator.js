/**
 * 合规提醒生成引擎（fixed 年费按年循环）
 *
 * 扫描所有 baseDateType='fixed' 且 anchorPayload 含 {m,d} 或 {reference:'brExpiryDate'} 的规则，
 * 对每家 active 公司按 jurisdiction / 上市条件 / condition 过滤后，计算当年 dueDate（已过则推次年），
 * 并按 (company + sourceRuleId + year) 去重，避免每天运行重复生成。
 */
const ComplianceRule = require('../models/ComplianceRule');
const ComplianceReminder = require('../models/ComplianceReminder');
const Company = require('../models/Company');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// 解析 fixed 规则的基准日
function resolveFixedBaseDate(rule, company, year, today) {
  const ap = rule.anchorPayload;
  if (ap && ap.reference === 'brExpiryDate') {
    // BR 续期：以公司 brExpiryDate 为基准，不滚动到次年
    if (!company.brExpiryDate) return null;
    const d = new Date(company.brExpiryDate);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  if (ap && ap.m && ap.d) {
    const d = new Date(year, ap.m - 1, ap.d);
    if (d < today) d.setFullYear(year + 1); // 今年已过 → 推至次年
    return d;
  }
  return null;
}

// 解析简单 condition 表达式，如 "bviRelevantActivity!='none'"
function passesCondition(rule, company) {
  if (!rule.condition) return true;
  const m = String(rule.condition).match(/^(\w+)\s*!=\s*'([^']*)'$/);
  if (m) {
    const field = m[1];
    const expected = m[2];
    return String(company[field]) !== expected;
  }
  return true; // 不支持的表达式 → 放行（保守）
}

/**
 * 生成所有 fixed 规则的年度提醒。返回 { generated, skipped, errors }。
 */
async function generateFixedReminders() {
  const today = new Date();
  const year = today.getFullYear();

  const rules = await ComplianceRule.find({ baseDateType: 'fixed', status: '启用' });
  const companies = await Company.find({ status: 'active' });

  let created = 0, skipped = 0, errors = 0;

  for (const rule of rules) {
    for (const company of companies) {
      // 适用范围过滤
      if (rule.jurisdiction !== 'ALL' && rule.jurisdiction !== company.jurisdiction) continue;
      if (rule.isListedOnly && !company.isListed) continue;
      if (rule.listingLocation && company.listingLocation !== rule.listingLocation) continue;
      if (!passesCondition(rule, company)) continue;

      const baseDate = resolveFixedBaseDate(rule, company, year, today);
      if (!baseDate) continue;

      const dueDate = addDays(baseDate, -(rule.dueDateOffset || 0)); // fixed：提前 N 天

      // 去重：同一公司 + 来源规则 + 年度
      const exists = await ComplianceReminder.findOne({
        company: company._id,
        sourceRuleId: rule.ruleId,
        year: dueDate.getFullYear(),
      });
      if (exists) { skipped++; continue; }

      try {
        await ComplianceReminder.create({
          company: company._id,
          rule: rule._id,
          sourceRuleId: rule.ruleId,
          ruleId: rule.ruleId,
          year: dueDate.getFullYear(),
          title: `${rule.ruleName} - ${company.name}`,
          description: rule.description,
          category: rule.category,
          dueDate,
          reminderDate: dueDate,
          reminderLevel: 1,
          priority: rule.priority,
          status: '待办',
        });
        created++;
      } catch (err) {
        if (err.code === 11000) skipped++;
        else { errors++; console.error('[reminderGenerator] create error:', err.message); }
      }
    }
  }

  console.log(`🔔 固定日期提醒生成完成: 新增 ${created}, 跳过 ${skipped}, 错误 ${errors}`);
  return { generated: created, skipped, errors };
}

module.exports = { generateFixedReminders, resolveFixedBaseDate, passesCondition };
