#!/usr/bin/env node
/**
 * generate-hkex-reminders.cjs — 为在港上市主体补生成 HKEX 合规提醒
 *
 * 背景（2026-09-11）：
 *   complianceService.ruleApplicability 支持「注册地非香港、但 nonHongKongCompany=true 的公司
 *   并行适用香港规则」，因此 3 家 Cayman + 在港上市主体（众安集团 00672 / 中国新城市集团 01321 /
 *   众安智慧生活 02271）应当命中 10 条 HKEX 预设规则，但这些规则此前从未跑过生成 —— 库里
 *   这 3 家只有 HK_NN3_AR 与 CAY_ANNUAL_RETURN，没有任何 HKEX_ 提醒。
 *
 * 设计取舍（重要）：
 *   - **不新写任何业务规则**。预览阶段只调用 service 已导出的纯函数
 *     ruleApplicability() / calcDueDate()；写库阶段只调用 ensureCompanyReminders()。
 *     这样「预览看到的」与「真正写入的」走同一套判定，不会两套逻辑跑偏。
 *   - ensureCompanyReminders 内部按 (company, rule, dueDate) 去重，幂等，重复执行不会产生脏数据。
 *   - 默认 dry-run：先打印「公司 × 规则 × 到期日」，确认后再 --apply。
 *   - --apply 前把「将被影响的公司文档 + 这些公司现有的提醒」完整备份到 .workbuddy/backups/。
 *
 * 用法：
 *   node scripts/generate-hkex-reminders.cjs            # dry-run（默认）
 *   node scripts/generate-hkex-reminders.cjs --apply    # 真正生成（先备份）
 *   node scripts/generate-hkex-reminders.cjs --verify   # 只做只读复验：列出各公司 HKEX_ 提醒
 *   node scripts/generate-hkex-reminders.cjs --reg=38403862,73240801   # 限定公司（注册号，逗号分隔）
 *
 * 注意：需要出网，Bash 请使用 dangerouslyDisableSandbox: true。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Atlas SRV 解析依赖外网 DNS；沙箱/公司网络下常解析失败，显式指定公共 DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.log('⚠️  无法设置 DNS resolver:', err.message);
}

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, '.workbuddy', 'backups');

const APPLY = process.argv.includes('--apply');
const VERIFY_ONLY = process.argv.includes('--verify');

/**
 * 读取形如 `--key=value` 的参数，缺失时返回空串。
 * @param {string} name 参数名（不含 --）
 * @returns {string} 参数值
 */
function arg(name) {
  const hit = process.argv.find((x) => x.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

const REG_FILTER = arg('reg') ? arg('reg').split(',').map((s) => s.trim()).filter(Boolean) : [];

/**
 * 从 .workbuddy/memory/SECRETS.md 提取 MongoDB URI。
 * 优先读环境变量 MONGODB_URI；绝不打印 URI（含凭据）。
 * @returns {string} mongodb+srv URI
 */
function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  const secretsPath = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');
  if (!fs.existsSync(secretsPath)) throw new Error('找不到 .workbuddy/memory/SECRETS.md');
  const txt = fs.readFileSync(secretsPath, 'utf8');
  const m = txt.match(/mongodb\+srv:\/\/\S+/);
  if (!m) throw new Error('SECRETS.md 里找不到 mongodb+srv:// 开头的 URI');
  return m[0].replace(/["'`)\]]/g, '').trim();
}

/**
 * 把数据落盘到 .workbuddy/backups/，用于写库前留痕。
 * @param {string} prefix 文件名前缀
 * @param {*} data 待备份数据
 * @returns {string} 备份文件绝对路径
 */
function backup(prefix, data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${prefix}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

/** Date → YYYY-MM-DD；空值返回 '-' */
function ymd(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));
  const ComplianceRule = require(path.join(ROOT, 'server', 'models', 'ComplianceRule'));
  const ComplianceReminder = require(path.join(ROOT, 'server', 'models', 'ComplianceReminder'));
  const PRESET_RULES = require(path.join(ROOT, 'server', 'services', 'presetRules'));
  const complianceService = require(path.join(ROOT, 'server', 'services', 'complianceService'));
  const { ruleApplicability, calcDueDate, ensureCompanyReminders } = complianceService;

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  console.log('✅ 已连接 Atlas:', mongoose.connection.db.databaseName);

  // ---------- 1. 目标公司：在港上市主体 ----------
  const companyQuery = { isListed: true };
  if (REG_FILTER.length) companyQuery.registrationNumber = { $in: REG_FILTER };
  const candidates = await Company.find(companyQuery).sort({ stockCode: 1, name: 1 }).lean();

  console.log(`\n=== 1. isListed 公司（共 ${candidates.length} 家）===`);
  candidates.forEach((c) => {
    console.log(
      `  ${String(c.name).slice(0, 40).padEnd(42)}` +
      `reg=${String(c.registrationNumber || '-').padEnd(26)}` +
      `jur=${String(c.jurisdiction || '-').padEnd(7)}` +
      `nonHK=${String(c.nonHongKongCompany || false).padEnd(6)}` +
      `loc=${String(c.listingLocation || '-').padEnd(4)}` +
      `code=${String(c.stockCode || '-').padEnd(7)}` +
      `fye=${c.financialYearEnd ? c.financialYearEnd.month + '/' + c.financialYearEnd.day : '-'}` +
      `inc=${ymd(c.incorporationDate)}`
    );
  });

  const targets = candidates.filter((c) => c.listingLocation === 'HK');
  const skippedLoc = candidates.filter((c) => c.listingLocation !== 'HK');
  if (skippedLoc.length) {
    console.log(`\n⚠️  以下 ${skippedLoc.length} 家 isListed 但 listingLocation !== 'HK'，不在本次范围内：`);
    skippedLoc.forEach((c) => console.log(`    - ${c.name} (loc=${c.listingLocation})`));
  }
  console.log(`\n🎯 目标公司 ${targets.length} 家（listingLocation=HK）`);

  // ---------- 2. HKEX 规则盘点 ----------
  const hkexRules = await ComplianceRule.find({ ruleId: /^HKEX_/ }).sort({ ruleId: 1 }).lean();
  const presetHkex = PRESET_RULES.filter((r) => String(r.ruleId).startsWith('HKEX_'));
  const presetIds = new Set(presetHkex.map((r) => r.ruleId));
  const dbIds = new Set(hkexRules.map((r) => r.ruleId));
  const missingInDb = [...presetIds].filter((id) => !dbIds.has(id));

  console.log(`\n=== 2. HKEX 规则（预设 ${presetIds.size} 条 / 库中 ${hkexRules.length} 条）===`);
  hkexRules.forEach((r) => {
    console.log(
      `  ${String(r.ruleId).padEnd(28)}` +
      `status=${String(r.status || '-').padEnd(5)}` +
      `jur=${String(r.jurisdiction).padEnd(7)}` +
      `isListedOnly=${String(r.isListedOnly || false).padEnd(6)}` +
      `listingLoc=${String(r.listingLocation || '-').padEnd(4)}` +
      `scope=${String(r.companyScope || 'ANY').padEnd(10)}` +
      `base=${String(r.baseDateType).padEnd(18)}` +
      `dueOffset=${String(r.dueDateOffset)}`
    );
  });
  if (missingInDb.length) {
    console.log(`⚠️  预设里有但库中缺失的 HKEX 规则: ${missingInDb.join(', ')}（需先跑 initPresetRules）`);
  }

  const activeRules = hkexRules.filter((r) => r.status !== '停用');
  const activeRuleIds = activeRules.map((r) => r.ruleId);
  console.log(`启用中规则 ${activeRules.length} 条（ensureCompanyReminders 将按这批 ruleId 生成）`);

  // ---------- 3. 逐公司预览：公司 × 规则 × 到期日 ----------
  const plan = [];
  for (const company of targets) {
    const rows = [];
    for (const rule of activeRules) {
      const notApplicable = ruleApplicability(rule, company);
      if (notApplicable) {
        rows.push({ rule, kind: 'not_applicable', reason: notApplicable });
        continue;
      }
      if (rule.baseDateType === 'trigger') {
        rows.push({ rule, kind: 'trigger' });
        continue;
      }
      const dueDate = calcDueDate(rule, company);
      if (!dueDate) {
        rows.push({ rule, kind: 'blocked', reason: '无法计算到期日（公司缺基础日期字段）' });
        continue;
      }
      const existing = await ComplianceReminder.findOne({
        company: company._id, rule: rule._id, dueDate,
      }).lean();
      if (existing) {
        rows.push({ rule, kind: 'exists', dueDate });
        continue;
      }
      rows.push({ rule, kind: 'will_create', dueDate });
    }
    plan.push({ company, rows });
  }

  console.log('\n=== 3. 生成计划（公司 × 规则 × 到期日）===');
  let totalCreate = 0;
  for (const { company, rows } of plan) {
    const create = rows.filter((r) => r.kind === 'will_create');
    totalCreate += create.length;
    console.log(
      `\n--- ${company.name}` +
      ` [${company.stockCode || '无代码'}] reg=${company.registrationNumber} jur=${company.jurisdiction} ---`
    );
    console.log(`    将新增 ${create.length} 条 / 已存在 ${rows.filter((r) => r.kind === 'exists').length} 条 / ` +
      `不适用 ${rows.filter((r) => r.kind === 'not_applicable').length} 条 / ` +
      `触发式 ${rows.filter((r) => r.kind === 'trigger').length} 条 / ` +
      `无法计算 ${rows.filter((r) => r.kind === 'blocked').length} 条`);
    rows.forEach((r) => {
      const tag = {
        will_create: '➕新增',
        exists: '＝已有',
        not_applicable: '⛔不适用',
        trigger: '⏱触发式',
        blocked: '⚠️无法计算',
      }[r.kind];
      console.log(
        `    ${tag.padEnd(12)}${String(r.rule.ruleId).padEnd(28)}` +
        `${String(r.rule.ruleName || '').slice(0, 22).padEnd(24)}` +
        `due=${String(ymd(r.dueDate)).padEnd(12)}${r.reason ? '原因=' + r.reason : ''}`
      );
    });
  }
  console.log(`\n合计将新增 ${totalCreate} 条 HKEX 提醒`);

  // 同到期日重叠提示（例如 HKEX_CAY_NN3 与既有 HK_NN3_AR 同为「成立周年日+42天」）
  console.log('\n=== 4. 与既有提醒「同到期日」重叠检查（仅提示，不阻断）===');
  for (const { company, rows } of plan) {
    const existingAll = await ComplianceReminder.find({ company: company._id }).lean();
    const byDue = new Map();
    existingAll.forEach((r) => {
      const k = ymd(r.dueDate);
      if (!byDue.has(k)) byDue.set(k, []);
      byDue.get(k).push(r.ruleId || r.sourceRuleId || '(手动)');
    });
    let printed = false;
    rows.filter((r) => r.kind === 'will_create').forEach((r) => {
      const overlap = byDue.get(ymd(r.dueDate)) || [];
      if (overlap.length) {
        printed = true;
        console.log(`  ⚠️  ${company.name}: ${r.rule.ruleId} due=${ymd(r.dueDate)} 与既有 [${overlap.join(', ')}] 同日`);
      }
    });
    if (!printed) console.log(`  ${company.name}: 无同到期日重叠`);
  }

  // ---------- 5. 只读复验模式（--verify）或 apply 后的复验 ----------
  if (VERIFY_ONLY && !APPLY) {
    await printHkexSummary(targets, ComplianceReminder);
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log('\n[只读模式] 未写库。确认计划无误后加 --apply 执行（会先备份到 .workbuddy/backups/）。');
    await printHkexSummary(targets, ComplianceReminder);
    await mongoose.disconnect();
    return;
  }

  // ---------- 6. 备份 → 生成 ----------
  const existingReminders = await ComplianceReminder.find({ company: { $in: targets.map((c) => c._id) } }).lean();
  const file = backup('hkex-reminders-before', {
    generatedAt: new Date().toISOString(),
    operation: 'ensureCompanyReminders for HKEX_* rules',
    ruleIds: activeRuleIds,
    companies: targets,
    reminders: existingReminders,
  });
  console.log(`\n📦 已备份 ${targets.length} 家公司 + ${existingReminders.length} 条既有提醒: ${file}`);

  console.log('\n=== 5. 执行生成（ensureCompanyReminders）===');
  for (const company of targets) {
    const res = await ensureCompanyReminders(company._id, activeRuleIds);
    console.log(`  ${company.name}: created=${res.created} skipped=${res.skipped} blocked=${res.blocked}`);
    if (res.reasons && res.reasons.length) {
      const grouped = {};
      res.reasons.forEach((r) => { grouped[r.reason] = (grouped[r.reason] || 0) + 1; });
      console.log(`      未生成原因: ${Object.entries(grouped).map(([k, v]) => `${k}×${v}`).join(', ')}`);
    }
  }

  await printHkexSummary(targets, ComplianceReminder);
  await mongoose.disconnect();
}

/**
 * 只读打印每家目标公司的 HKEX_ 提醒分布（复验用）。
 * @param {Array<object>} targets 公司 lean 文档
 * @param {object} ComplianceReminder ComplianceReminder model
 * @returns {Promise<void>}
 */
async function printHkexSummary(targets, ComplianceReminder) {
  console.log('\n=== 复验：各公司 HKEX_ 提醒 ===');
  for (const company of targets) {
    const rows = await ComplianceReminder.find({ company: company._id, ruleId: /^HKEX_/ })
      .sort({ ruleId: 1 }).lean();
    console.log(`\n  ${company.name} [${company.stockCode || '无代码'}] → ${rows.length} 条`);
    rows.forEach((r) => console.log(`    ${String(r.ruleId).padEnd(28)} due=${ymd(r.dueDate)}  ${String(r.title || '').slice(0, 34)}`));
  }
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
