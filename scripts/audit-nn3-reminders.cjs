#!/usr/bin/env node
/**
 * audit-nn3-reminders.cjs — 审计（并可清理）因 HK_NN3_AR 规则 jurisdiction='ALL'
 * 且 condition 不被引擎执行 而误生成的 NN3 提醒。
 *
 * 背景（2026-09-10）：
 *   HK_NN3_AR 预设规则原为 jurisdiction:'ALL'，其 `condition` 字段只是展示说明，
 *   引擎从不解析 → NN3 提醒此前对全库所有公司生成（含香港本地公司、纯 BVI/开曼公司）。
 *   修复方案：引入结构化字段 companyScope（ANY/HK_LOCAL/HK_NON_HK），
 *   HK_NN3_AR 收口为 HK_NON_HK。引擎已收口（不再新增），但库里已生成的脏数据仍在。
 *
 * 判定标准（脏数据）：
 *   A. NN3 提醒（ruleId/sourceRuleId = 'HK_NN3_AR'）且 公司 nonHongKongCompany !== true
 *      → 该公司不是在港注册的非香港公司，不该有 NN3
 *   B. NAR1 提醒（ruleId/sourceRuleId = 'HK_AR_42'）且 公司 nonHongKongCompany === true
 *      → 该公司是注册非香港公司，应为 NN3 而非 NAR1（互斥）
 *
 * 用法：
 *   node scripts/audit-nn3-reminders.cjs            # 只读审计（默认）
 *   node scripts/audit-nn3-reminders.cjs --apply    # 落盘备份后执行清理
 *   node scripts/audit-nn3-reminders.cjs --limit 20 # 审计报告最多打印 N 行
 *
 * 安全：--apply 会先把待删文档完整导出到 .workbuddy/backups/ 再删除。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const APPLY = process.argv.includes('--apply');
const LIMIT_IDX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_IDX > -1 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : 30;

const ROOT = path.resolve(__dirname, '..');

function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  const secretsPath = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');
  if (!fs.existsSync(secretsPath)) throw new Error('找不到 SECRETS.md');
  const txt = fs.readFileSync(secretsPath, 'utf8');
  const m = txt.match(/mongodb\+srv:\/\/\S+/);
  if (!m) throw new Error('SECRETS.md 里找不到 MONGODB_URI');
  return m[0];
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const uri = readMongoUri();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  console.log('✅ 已连接 Atlas:', db.databaseName);

  // ---------- 1. 规则集合：判断后端是否已部署新代码 ----------
  const rulesCol = db.collection('compliancerules');
  const totalRules = await rulesCol.countDocuments();
  const withScope = await rulesCol.countDocuments({ companyScope: { $exists: true } });
  console.log('\n=== 1. 规则集合（判断后端部署状态）===');
  console.log(`规则总数: ${totalRules}`);
  console.log(`含 companyScope 字段: ${withScope}  ${withScope > 0 ? '→ 新代码已 upsert，后端已部署新逻辑 ✅' : '→ 后端仍是旧代码 ⚠️（仅数据层，引擎未生效）'}`);

  const nn3Rule = await rulesCol.findOne({ ruleId: 'HK_NN3_AR' });
  const nar1Rule = await rulesCol.findOne({ ruleId: 'HK_AR_42' });
  console.log(`HK_NN3_AR: companyScope=${nn3Rule ? (nn3Rule.companyScope ?? '(无)') : '规则不存在'}`);
  console.log(`HK_AR_42 : companyScope=${nar1Rule ? (nar1Rule.companyScope ?? '(无)') : '规则不存在'}`);

  // ---------- 2. 提醒分布 ----------
  const remCol = db.collection('compliancereminders');
  const compCol = db.collection('companies');

  const dist = await remCol.aggregate([
    { $group: { _id: '$sourceRuleId', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();
  console.log('\n=== 2. 提醒按来源规则分布 ===');
  dist.forEach((d) => console.log(`  ${String(d._id ?? '(空)').padEnd(22)} ${d.n}`));

  // ---------- 3. 脏数据识别 ----------
  const nn3Ids = ['HK_NN3_AR'];
  const nar1Ids = ['HK_AR_42'];

  const nn3Reminders = await remCol.find({
    $or: [{ sourceRuleId: { $in: nn3Ids } }, { ruleId: { $in: nn3Ids } }],
  }).toArray();
  const nar1Reminders = await remCol.find({
    $or: [{ sourceRuleId: { $in: nar1Ids } }, { ruleId: { $in: nar1Ids } }],
  }).toArray();

  console.log(`\nNN3 提醒总数: ${nn3Reminders.length}`);
  console.log(`NAR1 提醒总数: ${nar1Reminders.length}`);

  const companyIds = [...new Set([...nn3Reminders, ...nar1Reminders].map((r) => String(r.company)))];
  const companies = await compCol.find({ _id: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ name: 1, nameChinese: 1, jurisdiction: 1, nonHongKongCompany: 1, isListed: 1 })
    .toArray();
  const cmap = new Map(companies.map((c) => [String(c._id), c]));

  // A 类脏：NN3 但公司不是 nonHongKongCompany
  const dirtyA = nn3Reminders.filter((r) => {
    const c = cmap.get(String(r.company));
    return !c || c.nonHongKongCompany !== true;
  });
  // B 类脏：NAR1 但公司是 nonHongKongCompany（应为 NN3）
  const dirtyB = nar1Reminders.filter((r) => {
    const c = cmap.get(String(r.company));
    return c && c.nonHongKongCompany === true;
  });

  console.log('\n=== 3. 脏数据识别 ===');
  console.log(`A 类（NN3 但公司 nonHongKongCompany !== true）: ${dirtyA.length} 条`);
  console.log(`B 类（NAR1 但公司是 nonHongKongCompany，应为 NN3）: ${dirtyB.length} 条`);

  const printList = (title, list) => {
    console.log(`\n--- ${title}（最多 ${LIMIT} 行）---`);
    list.slice(0, LIMIT).forEach((r) => {
      const c = cmap.get(String(r.company));
      console.log(
        `  ${r._id}  ${String(c?.name ?? '(公司缺失)').slice(0, 34).padEnd(36)}` +
        `jur=${String(c?.jurisdiction ?? '?').padEnd(8)}nonHK=${String(c?.nonHongKongCompany ?? false).padEnd(6)}` +
        `due=${String(r.dueDate ?? '').slice(0, 10)}  ${String(r.title ?? '').slice(0, 26)}`
      );
    });
    if (list.length > LIMIT) console.log(`  ... 还有 ${list.length - LIMIT} 条`);
  };
  if (dirtyA.length) printList('A 类明细', dirtyA);
  if (dirtyB.length) printList('B 类明细', dirtyB);

  // ---------- 4. 合规缺失（补生成）提示 ----------
  const nonHkCompanies = await compCol.find({ nonHongKongCompany: true }).toArray();
  const nonHkIds = new Set(nonHkCompanies.map((c) => String(c._id)));
  const hasNN3 = new Set(nn3Reminders.map((r) => String(r.company)));
  const missingNN3 = nonHkCompanies.filter((c) => !hasNN3.has(String(c._id)));
  console.log('\n=== 4. 注册非香港公司 NN3 覆盖检查 ===');
  console.log(`nonHongKongCompany=true 的公司: ${nonHkCompanies.length}`);
  console.log(`其中尚无 NN3 提醒: ${missingNN3.length}`);
  missingNN3.slice(0, LIMIT).forEach((c) => console.log(`  - ${c.name} (${c.jurisdiction}) ${c._id}`));

  // ---------- 5. 执行清理 ----------
  const dirty = [...dirtyA, ...dirtyB];
  if (!APPLY) {
    console.log(`\n[只读模式] 待清理合计 ${dirty.length} 条。加 --apply 执行（会先落盘备份）。`);
    await mongoose.disconnect();
    return;
  }
  if (dirty.length === 0) {
    console.log('\n无需清理。');
    await mongoose.disconnect();
    return;
  }

  const backupDir = path.join(ROOT, '.workbuddy', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `nn3-dirty-backup-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(dirty, null, 2), 'utf8');
  console.log(`\n📦 已备份 ${dirty.length} 条到: ${backupFile}`);

  const dirtyIds = dirty.map((r) => r._id);
  const res = await remCol.deleteMany({ _id: { $in: dirtyIds } });
  console.log(`🗑️  已删除 ${res.deletedCount} 条脏提醒`);

  const remainNN3 = await remCol.countDocuments({ $or: [{ sourceRuleId: { $in: nn3Ids } }, { ruleId: { $in: nn3Ids } }] });
  console.log(`✅ 剩余 NN3 提醒: ${remainNN3}（应仅属于 nonHongKongCompany=true 的公司）`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
