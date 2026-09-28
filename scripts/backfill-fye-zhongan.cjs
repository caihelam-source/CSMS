#!/usr/bin/env node
/**
 * backfill-fye-zhongan.cjs — 为 3 家众安系在港上市主体回填 financialYearEnd
 *
 * 背景（2026-09-28）：
 *   2026-09-11 的 generate-hkex-reminders 落地了 6 条 HKEX_ 提醒，但 8 条以
 *   financialYearEnd 为锚点的 HKEX 规则（中报/季报/年报/禁售期/董事会通知）对这 3 家
 *   全部 blocked(missing_field) —— 因为库中 financialYearEnd 为空。
 *   经港交所 2025 年度业绩公告核实，3 家财年截止日均为 12 月 31 日：
 *     - Zhong An Group Limited           00672  reg=38403862
 *     - China New City Group Limited     01321  reg=ENT-CHINANEWCITYGROUPL
 *     - Zhong An Intelligent Living Serv. 02271  reg=73240801
 *   故回填 { month: 12, day: 31 } 为有源可查的正确数据，非猜测。
 *
 * 设计取舍（与 fix-zhongan-stockcode.cjs 一致）：
 *   - 按 registrationNumber 精确定位，不改其它公司
 *   - 写库前完整备份到 .workbuddy/backups/
 *   - 默认 dry-run，--apply 才写
 *   - 幂等：若已是 {12,31} 则跳过
 *
 * 用法：
 *   node scripts/backfill-fye-zhongan.cjs          # dry-run（列出当前值 + 将如何修改）
 *   node scripts/backfill-fye-zhongan.cjs --apply  # 备份后写库
 *
 * 注意：需要出网，Bash 请用 dangerouslyDisableSandbox: true。
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

// 3 家众安系在港上市主体（registrationNumber 精确定位）
const TARGETS = [
  { reg: '38403862', name: 'Zhong An Group Limited (00672)' },
  { reg: 'ENT-CHINANEWCITYGROUPL', name: 'China New City Group Limited (01321)' },
  { reg: '73240801', name: 'Zhong An Intelligent Living Service Limited (02271)' },
];
const NEW_FYE = { month: 12, day: 31 };

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

function fyeStr(fye) {
  if (!fye || fye.month == null || fye.day == null) return '- (缺)';
  return `${fye.month}/${fye.day}`;
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  console.log('✅ 已连接 Atlas:', mongoose.connection.db.databaseName);

  const regs = TARGETS.map((t) => t.reg);
  const companies = await Company.find({ registrationNumber: { $in: regs } })
    .select('name registrationNumber jurisdiction isListed listingLocation stockCode financialYearEnd')
    .lean();
  const byReg = new Map(companies.map((c) => [c.registrationNumber, c]));

  console.log(`\n=== 目标公司（${TARGETS.length} 家，命中 ${companies.length} 家）===`);
  const plan = [];
  for (const t of TARGETS) {
    const c = byReg.get(t.reg);
    if (!c) {
      console.log(`  ❌ 未找到 reg=${t.reg} (${t.name})`);
      continue;
    }
    const already = c.financialYearEnd && c.financialYearEnd.month === 12 && c.financialYearEnd.day === 31;
    console.log(
      `  ${String(c.name).slice(0, 40).padEnd(42)}` +
      `reg=${String(c.registrationNumber).padEnd(26)}` +
      `fye=${fyeStr(c.financialYearEnd).padEnd(10)}` +
      `${already ? '✅已是12/31' : '➕将设为12/31'}`
    );
    plan.push({ company: c, already });
  }

  const toWrite = plan.filter((p) => !p.already);
  if (!toWrite.length) {
    console.log('\n✅ 3 家 FYE 均已为 12/31，无需修改。');
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log(
      `\n[只读模式] 将修改 ${toWrite.length} 家（其余已正确）。确认无误后加 --apply 执行（会先备份）。`
    );
    await mongoose.disconnect();
    return;
  }

  // 备份将被修改的文档
  const file = backup('fye-backfill-before', {
    generatedAt: new Date().toISOString(),
    operation: 'set financialYearEnd={month:12,day:31}',
    targets: toWrite.map((p) => ({ _id: p.company._id, name: p.company.name, before: p.company.financialYearEnd })),
  });
  console.log(`\n📦 已备份修改前文档: ${file}`);

  for (const { company } of toWrite) {
    const res = await Company.updateOne(
      { _id: company._id },
      { $set: { financialYearEnd: NEW_FYE } }
    );
    console.log(`  ✏️  ${company.name} (reg=${company.registrationNumber}) matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  // 复验
  const after = await Company.find({ registrationNumber: { $in: regs } })
    .select('name registrationNumber financialYearEnd').lean();
  console.log('\n=== 复验 ===');
  after.forEach((c) => console.log(`  ${String(c.name).slice(0, 40).padEnd(42)}fye=${fyeStr(c.financialYearEnd)}`));

  await mongoose.disconnect();
  console.log('\n✅ 回填完成。下一步：运行 node scripts/generate-hkex-reminders.cjs --apply 落地 24 条 HKEX 提醒。');
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
