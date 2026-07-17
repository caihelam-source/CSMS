/**
 * 收尾四项 · 任务3 & 任务4 本地一键验证脚本（测试库）
 * ─────────────────────────────────────────────────────────────────
 * 在【测试库】上执行：
 *   Task 3：连真实后端逻辑，调用与 POST /api/admin/generate-reminders
 *           完全相同的 generateFixedReminders()，验证生成数量 / dueDate /
 *           去重（二次调用 generated=0）。
 *   Task 4：跑 migrate-jurisdiction DRY RUN 看残留，--apply 时清理并检查。
 *
 * 用法（在本机 Claw 根目录执行）：
 *   # 1) 先把 .env 的 MONGODB_URI 指向【测试库】，例如同集群的 claw_test：
 *   #    mongodb+srv://caihelam_db_user:<pw>@csms-cluster0.83kh9al.mongodb.net/claw_test
 *   #    （绝不能是 claw_prod）
 *   # 2) 运行（DRY RUN + 生成验证，不清理）：
 *   node scripts/verify-e2e-testdb.cjs --seed-demo --reset-demo
 *   # 3) 确认无误后，加 --apply 真正清理：
 *   node scripts/verify-e2e-testdb.cjs --seed-demo --reset-demo --apply
 *   # 注：--reset-demo 会清空 companies + compliancereminders 后重新种入 3 家 demo，
 *   #     便于在测试库反复重跑得到干净结果。
 *
 * 安全：
 *   - URI 库名含 prod|production|live|主 直接拒绝（除非 --i-know-this-is-prod）。
 *   - --seed-demo 仅在公司集合为空时插入 3 家 demo 公司，便于看到非零生成。
 *   - migrate 的实际写入由 scripts/migrate-jurisdiction.js --apply 完成（复用已审查逻辑）。
 */

const mongoose = require('mongoose');
const path = require('path');
const { execFileSync } = require('child_process');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const APPLY = process.argv.includes('--apply');
const SEED_DEMO = process.argv.includes('--seed-demo');
const RESET_DEMO = process.argv.includes('--reset-demo');
const FORCE_PROD = process.argv.includes('--i-know-this-is-prod');

if (!MONGO_URI) {
  console.error('❌ 未设置 MONGODB_URI（请先指向测试库，绝不能是 claw_prod）');
  process.exit(1);
}

const dbName = (MONGO_URI.split('/').pop() || '').split('?')[0];
if (/prod|production|live|主/i.test(dbName) && !FORCE_PROD) {
  console.error(`❌ 拒绝执行：URI 指向疑似生产库 "${dbName}"。若要强行（不推荐）请追加 --i-know-this-is-prod`);
  process.exit(1);
}

const modelsDir = path.join(__dirname, '..', 'server', 'models');
const Company = require(path.join(modelsDir, 'Company'));
const ComplianceRule = require(path.join(modelsDir, 'ComplianceRule'));
const ComplianceReminder = require(path.join(modelsDir, 'ComplianceReminder'));
const User = require(path.join(modelsDir, 'User'));
const { initPresetRules } = require(path.join(__dirname, '..', 'server', 'services', 'complianceService'));
const { generateFixedReminders } = require(path.join(__dirname, '..', 'server', 'services', 'reminderGenerator'));

function runMigrate(extraArgs) {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'migrate-jurisdiction.js'), ...extraArgs], {
    env: { ...process.env, MONGODB_URI: MONGO_URI },
    encoding: 'utf8',
  });
  console.log(out);
}

async function ensureAdmin() {
  const admin = await User.findOne({ role: 'admin' });
  if (admin) { console.log('· admin 已存在:', admin.email); return; }
  const u = await User.create({ name: 'Test Admin', email: 'admin@claw.test', password: 'Admin@1234', role: 'admin' });
  console.log('· 已创建 admin:', u.email, '/ Admin@1234');
}

async function seedDemo() {
  const cnt = await Company.countDocuments();
  if (cnt > 0) { console.log(`· 已有 ${cnt} 家公司，跳过 demo 种子（加 --reset-demo 可清空重建）`); return; }
  await Company.insertMany([
    { name: 'Demo HK Ltd', registrationNumber: 'HK-DEMO-001', jurisdiction: 'HK', status: 'active', brExpiryDate: new Date('2026-08-01'), financialYearEnd: { day: 31, month: 3 }, incorporationDate: new Date('2020-06-15') },
    { name: 'Demo BVI Inc', registrationNumber: 'BVI-DEMO-002', jurisdiction: 'BVI', status: 'active', financialYearEnd: { day: 30, month: 6 }, bviRelevantActivity: 'fund', incorporationDate: new Date('2019-03-10') },
    { name: 'Demo Cayman Ltd', registrationNumber: 'KY-DEMO-003', jurisdiction: 'Cayman', status: 'active', financialYearEnd: { day: 31, month: 12 }, incorporationDate: new Date('2018-11-20') },
  ]);
  console.log('· 已插入 3 家 demo 公司 (HK/BVI/Cayman)');
}

async function main() {
  console.log('\n========== E2E 验证（测试库）==========');
  console.log('目标数据库:', dbName);
  console.log('=======================================\n');

  await mongoose.connect(MONGO_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 15000 });
  await initPresetRules();
  await ensureAdmin();
  if (SEED_DEMO) {
    if (RESET_DEMO) {
      await Company.deleteMany({});
      await ComplianceReminder.deleteMany({});
      console.log('· 已清空 companies + compliancereminders 集合（--reset-demo）');
    }
    await seedDemo();
  }

  const ruleCount = await ComplianceRule.countDocuments();
  const companyCount = await Company.countDocuments();
  console.log(`\n集合规模: 规则 ${ruleCount} 条, 公司 ${companyCount} 家\n`);

  // ── Task 3 ──
  console.log('──────── Task 3: generate-reminders (第 1 次) ────────');
  const r1 = await generateFixedReminders();
  console.log('返回:', JSON.stringify(r1));

  const samples = await ComplianceReminder.aggregate([
    { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'co' } },
    { $unwind: '$co' },
    { $project: { jur: '$co.jurisdiction', name: '$co.name', rule: '$ruleId', due: '$dueDate', year: 1 } },
    { $limit: 30 },
  ]);
  console.log('\n样本提醒（公司管辖区 | 规则 | dueDate(年)）：');
  for (const s of samples) {
    const d = s.due ? new Date(s.due).toISOString().slice(0, 10) : 'n/a';
    const flag = ['BVI_ANNUAL_FEE', 'CAY_ANNUAL_RETURN', 'HK_BR_RENEW'].includes(s.rule) ? '  ← 重点' : '';
    console.log(`  ${s.jur.padEnd(8)} | ${s.rule.padEnd(18)} | ${d} (${s.year})${flag}`);
  }

  console.log('\n──────── Task 3: generate-reminders (第 2 次，验证去重) ────────');
  const r2 = await generateFixedReminders();
  console.log('返回:', JSON.stringify(r2), r2.generated === 0 ? '✅ 去重生效' : '⚠️ generated 非 0，请检查');

  // ── Task 4 ──
  console.log('\n──────── Task 4: jurisdiction 迁移 DRY RUN ────────');
  runMigrate([]);
  if (APPLY) {
    console.log('\n──────── Task 4: jurisdiction 迁移 --apply ────────');
    runMigrate(['--apply']);
    console.log('\n──────── Task 4: 复查（DRY RUN）────────');
    runMigrate([]);
  } else {
    console.log('\n[提示] 未加 --apply，未执行清理。确认 DRY RUN 无误后加 --apply 重跑本脚本。');
  }

  await mongoose.disconnect();
  console.log('\n✅ 验证脚本结束');
}

main().catch(async (e) => {
  console.error('验证失败:', e.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
