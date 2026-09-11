#!/usr/bin/env node
/**
 * backfill-fye-and-regen-hkex.cjs — 回填在港上市公司的 financialYearEnd 并补生成被阻塞的 HKEX 提醒
 *
 * 背景（2026-09-11 / 09-12）：
 *   3 家在港上市主体（众安集团 00672 / 中国新城市集团 01321 / 众安智慧生活 02271）已标记为
 *   isListed=true + nonHongKongCompany=true + listingLocation=HK，命中 10 条 HKEX 预设规则。
 *   但其中 8 条规则以 financialYearEnd 为基准日，而库里这 3 家的 financialYearEnd 为空，
 *   导致 generateRemindersForRule 计算不出到期日 → blocked，共 24 条（8 规则 × 3 公司）未生成。
 *   另有 2 条（HKEX_CAY_NN3 / HKEX_MONTHLY_RETURN）以成立日 / 当月为基准，已生成 6 条。
 *
 * 处理方式：
 *   - 按「12-31」为这 3 家回填 financialYearEnd（港股 Cayman 主体财年多为 12 月 31 日，为合理默认；
 *     若与真实财年不符，可后续在 Company 录入入口修正，本脚本写前已备份，可回滚）。
 *   - 回填后立即用 ensureCompanyReminders（与生成脚本同套判定）补生成被解除阻塞的 HKEX 提醒。
 *   - 默认 dry-run：先打印「当前 FYE → 12-31」与「回填后将新增多少条」，确认后 --apply。
 *   - --apply 前把「将被修改的公司文档 + 这些公司现有提醒」完整备份到 .workbuddy/backups/。
 *
 * 用法：
 *   node scripts/backfill-fye-and-regen-hkex.cjs        # dry-run（默认）
 *   node scripts/backfill-fye-and-regen-hkex.cjs --apply # 备份 + 回填 + 重新生成
 *
 * 注意：需要出网，Bash 请使用 dangerouslyDisableSandbox: true。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.log('⚠️  无法设置 DNS resolver:', err.message);
}

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, '.workbuddy', 'backups');
const APPLY = process.argv.includes('--apply');

function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  const secretsPath = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');
  if (!fs.existsSync(secretsPath)) throw new Error('找不到 .workbuddy/memory/SECRETS.md');
  const txt = fs.readFileSync(secretsPath, 'utf8');
  const m = txt.match(/mongodb\+srv:\/\/\S+/);
  if (!m) throw new Error('SECRETS.md 里找不到 mongodb+srv:// 开头的 URI');
  return m[0].replace(/["'`)\]]/g, '').trim();
}

function backup(prefix, data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${prefix}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

function ymd(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));
  const ComplianceRule = require(path.join(ROOT, 'server', 'models', 'ComplianceRule'));
  const ComplianceReminder = require(path.join(ROOT, 'server', 'models', 'ComplianceReminder'));
  const complianceService = require(path.join(ROOT, 'server', 'services', 'complianceService'));
  const { ruleApplicability, calcDueDate, ensureCompanyReminders } = complianceService;

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  console.log('✅ 已连接 Atlas:', mongoose.connection.db.databaseName);

  const targets = await Company.find({ isListed: true, listingLocation: 'HK' })
    .sort({ stockCode: 1, name: 1 })
    .lean();
  console.log(`\n=== 目标公司（isListed=true & listingLocation=HK）共 ${targets.length} 家 ===`);
  targets.forEach((c) =>
    console.log(
      `  ${String(c.name).slice(0, 42).padEnd(44)}reg=${String(c.registrationNumber || '-').padEnd(24)}` +
      `jur=${String(c.jurisdiction || '-').padEnd(8)}code=${String(c.stockCode || '-').padEnd(7)}` +
      `fye=${c.financialYearEnd ? c.financialYearEnd.month + '/' + c.financialYearEnd.day : '(空)'}`
    )
  );

  console.log('\n=== FYE 回填计划：将 financialYearEnd 设为 {month:12, day:31} ===');
  targets.forEach((c) => {
    const cur = c.financialYearEnd ? `${c.financialYearEnd.month}/${c.financialYearEnd.day}` : '(空)';
    console.log(`  ${c.name}: ${cur} -> 12/31`);
  });

  const hkexRules = await ComplianceRule.find({ ruleId: /^HKEX_/, status: { $ne: '停用' } })
    .sort({ ruleId: 1 })
    .lean();
  const activeRuleIds = hkexRules.map((r) => r.ruleId);
  console.log(`\n启用中 HKEX 规则 ${hkexRules.length} 条`);

  console.log('\n=== 回填后 HKEX 规则生成预览（calcDueDate 用 12-31 财年）===');
  let willCreate = 0;
  for (const c of targets) {
    const fyeCompany = { ...c, financialYearEnd: { month: 12, day: 31 } };
    for (const r of hkexRules) {
      if (ruleApplicability(r, fyeCompany)) continue;
      const due = calcDueDate(r, fyeCompany);
      if (!due) continue;
      const existing = await ComplianceReminder.findOne({ company: c._id, rule: r._id, dueDate: due }).lean();
      if (!existing) willCreate++;
    }
  }
  console.log(`预计将新增 HKEX 提醒约 ${willCreate} 条（已存在者跳过，保持幂等）`);

  if (!APPLY) {
    console.log('\n[只读模式] 未写库。确认计划无误后加 --apply 执行（会先备份到 .workbuddy/backups/）。');
    await mongoose.disconnect();
    return;
  }

  // ---------- 备份 → 回填 → 重新生成 ----------
  const before = await Company.find({ _id: { $in: targets.map((t) => t._id) } }).lean();
  const existingReminders = await ComplianceReminder.find({ company: { $in: targets.map((t) => t._id) } }).lean();
  const file = backup('hkex-fye-backfill-before', {
    generatedAt: new Date().toISOString(),
    operation: 'set financialYearEnd={month:12,day:31} + ensureCompanyReminders HKEX_*',
    companies: before,
    reminders: existingReminders,
  });
  console.log(`\n📦 已备份 ${targets.length} 家公司 + ${existingReminders.length} 条既有提醒: ${file}`);

  for (const c of targets) {
    const res = await Company.updateOne({ _id: c._id }, { $set: { financialYearEnd: { month: 12, day: 31 } } });
    console.log(`  FYE set ${c.name}: matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  console.log('\n=== 重新生成 HKEX 提醒（ensureCompanyReminders）===');
  for (const c of targets) {
    const res = await ensureCompanyReminders(c._id, activeRuleIds);
    console.log(`  ${c.name}: created=${res.created} skipped=${res.skipped} blocked=${res.blocked}`);
    if (res.reasons && res.reasons.length) {
      const grouped = {};
      res.reasons.forEach((r) => { grouped[r.reason] = (grouped[r.reason] || 0) + 1; });
      console.log(`      未生成原因: ${Object.entries(grouped).map(([k, v]) => `${k}×${v}`).join(', ')}`);
    }
  }

  console.log('\n=== 复验：各公司 HKEX_ 提醒数 ===');
  for (const c of targets) {
    const rows = await ComplianceReminder.find({ company: c._id, ruleId: /^HKEX_/ }).lean();
    console.log(`  ${c.name} [${c.stockCode || '无代码'}]: ${rows.length} 条`);
    rows.forEach((r) => console.log(`    ${String(r.ruleId).padEnd(28)} due=${ymd(r.dueDate)} year=${r.year || '-'} src=${r.sourceRuleId || '-'}`));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
