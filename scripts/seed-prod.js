/**
 * seed-prod.js — 往生产库灌入演示业务数据（公司 + 人员 + 任职关联中枢）
 * ─────────────────────────────────────────────────────────────────
 * 所有演示数据均以 DEMO- 前缀标记（人员 nric=DEMO-NRIC-*，公司 registrationNumber=DEMO-*），
 * 以便 `--clear` 精准删除、绝不误伤真实数据。
 *
 * 用法（PowerShell）:
 *   $env:MONGODB_URI = "mongodb+srv://user:pwd@host/claw_prod?retryWrites=true&w=majority"
 *   node scripts/seed-prod.js                 # DRY RUN：仅打印将创建的数量，不写库
 *   node scripts/seed-prod.js --apply --i-know-this-is-prod   # 清空旧 DEMO- 后写入（幂等，可重复跑）
 *   node scripts/seed-prod.js --clear --i-know-this-is-prod   # 清空所有 DEMO- 演示数据
 *
 * 安全：默认 DRY RUN 不写库；写/删操作在生产库需 --i-know-this-is-prod。
 * 注意：mongoose Model.aggregate() 返回可 await 的 Aggregation（await 即得数组），
 *       不能用 .toArray()（那是原生 driver 集合的方法）—— 旧版因此报错并 process.exit 冲掉写入。
 */

const mongoose = require('mongoose');
const path = require('path');
const Company = require(path.join(__dirname, '..', 'server', 'models', 'Company'));
const Personnel = require(path.join(__dirname, '..', 'server', 'models', 'Personnel'));

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary';
const DRY_RUN = !process.argv.includes('--apply') && !process.argv.includes('--clear');
const DO_APPLY = process.argv.includes('--apply');
const DO_CLEAR = process.argv.includes('--clear');
const FORCE = process.argv.includes('--i-know-this-is-prod');

function assertSafeToWrite() {
  const dbName = (MONGO_URI.split('/').pop() || '').toLowerCase();
  if (/prod|production|live|主/.test(dbName) && !FORCE) {
    throw new Error(
      `检测到疑似生产库 "${dbName}"。确认要操作请追加 --i-know-this-is-prod。\n` +
      `强烈建议先 mongodump 备份。`,
    );
  }
}

const toDate = (s) => (s ? new Date(s) : undefined);

// ── 演示人员（nric 全部 DEMO- 前缀）────────────────────────────────
const PERSONNEL = [
  { key: 'p1', name: '施金帆', nric: 'DEMO-NRIC-P1', nationality: '中国' },
  { key: 'p2', name: '施南路', nric: 'DEMO-NRIC-P2', nationality: '中国' },
  { key: 'p3', name: '施中安 (施侃成)', nric: 'DEMO-NRIC-P3', nationality: '中国' },
  { key: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'DEMO-NRIC-P4', nationality: '中国' },
  { key: 'p5', name: '林友耀 (LAM YAU YIU)', nric: 'DEMO-NRIC-P5', nationality: '中国' },
  { key: 'p6', name: '金建榮 (JIN JIANRONG)', nric: 'DEMO-NRIC-P6', nationality: '中国' },
  { key: 'p7', name: '袁淵 (YUAN YUAN)', nric: 'DEMO-NRIC-P7', nationality: '中国' },
  { key: 'p8', name: '陳靜 (CHEN JING)', nric: 'DEMO-NRIC-P8', nationality: '中国' },
  { key: 'p9', name: '须成发 (XU CHENGFA)', nric: 'DEMO-NRIC-P9', nationality: '中国' },
  { key: 'p10', name: '施中安 (SHI ZHONGAN)', nric: 'DEMO-NRIC-P10', nationality: '中国' },
];

// ── 演示公司（registrationNumber 全部 DEMO- 前缀）─────────────────────
// links 用 ref 键引用 PERSONNEL.key 或 COMPANY.key，apply 时替换为真实 _id。
const COMPANIES = [
  {
    key: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: 'DEMO-CR-65940948',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    links: [
      { ref: 'p1', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2017-04-21' },
      { ref: 'p2', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2017-04-21' },
      { ref: 'p4', linkModel: 'Personnel', roles: ['secretary'], appointmentDate: '2017-04-21' },
      { ref: 'c6', linkModel: 'Company', roles: ['shareholder'], shares: 1, shareType: 'ordinary' },
    ],
  },
  {
    key: 'c2', name: 'Zhong An Travel Ltd (眾安旅遊)', registrationNumber: 'DEMO-CR-69459923',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    links: [
      { ref: 'p2', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2018-09-28' },
      { ref: 'p4', linkModel: 'Personnel', roles: ['secretary'], appointmentDate: '2018-09-28' },
      { ref: 'c7', linkModel: 'Company', roles: ['shareholder'], shares: 1, shareType: 'ordinary' },
    ],
  },
  {
    key: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: 'DEMO-CR-35387857',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    links: [
      { ref: 'p3', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2010-05-14' },
      { ref: 'p4', linkModel: 'Personnel', roles: ['secretary'], appointmentDate: '2010-05-14' },
      { ref: 'c8', linkModel: 'Company', roles: ['shareholder'], shares: 1, shareType: 'ordinary' },
    ],
  },
  {
    key: 'c4', name: 'Hong Kong Time Honour Property Ltd (香港時駿地産)', registrationNumber: 'DEMO-CR-63822186',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    links: [
      { ref: 'p2', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2021-12-14' },
      { ref: 'p4', linkModel: 'Personnel', roles: ['secretary'], appointmentDate: '2021-12-14' },
      { ref: 'c9', linkModel: 'Company', roles: ['shareholder'], shares: 1, shareType: 'ordinary' },
    ],
  },
  {
    key: 'c5', name: 'Pannix Industrial (Hong Kong) Ltd (佳穎實業)', registrationNumber: 'DEMO-CR-63822047',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    links: [
      { ref: 'p2', linkModel: 'Personnel', roles: ['director'], appointmentDate: '2021-12-14' },
      { ref: 'p4', linkModel: 'Personnel', roles: ['secretary'], appointmentDate: '2021-12-14' },
      { ref: 'c10', linkModel: 'Company', roles: ['shareholder'], shares: 1, shareType: 'ordinary' },
    ],
  },
  // BVI / Cayman 股东公司
  { key: 'c6', name: 'Easy Success Investments Ltd (BVI)', registrationNumber: 'DEMO-BVI-6', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { key: 'c7', name: 'Beyond Horizon Investments Ltd (BVI)', registrationNumber: 'DEMO-BVI-7', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { key: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: 'DEMO-CR-62264234', type: 'public_limited', status: 'active', jurisdiction: 'Cayman', links: [] },
  { key: 'c9', name: 'Time Honour Global Ltd (BVI)', registrationNumber: 'DEMO-BVI-9', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { key: 'c10', name: 'First Achiever Holdings Ltd (BVI)', registrationNumber: 'DEMO-BVI-10', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
];

// ── 统计关联总数（用于 DRY RUN 报告）─────────────────────────────────
const totalLinks = COMPANIES.reduce((n, c) => n + (c.links ? c.links.length : 0), 0);

async function doClear() {
  const r1 = await Personnel.deleteMany({ nric: /^DEMO-/ });
  const r2 = await Company.deleteMany({ registrationNumber: /^DEMO-/ });
  console.log(`🧹 已清空演示数据：Personnel 删除 ${r1.deletedCount}，Company 删除 ${r2.deletedCount}（仅 DEMO- 前缀）`);
}

async function doApply() {
  // ① 先建所有人员，建立 key -> _id 映射
  const pMap = {};
  for (const p of PERSONNEL) {
    const doc = await Personnel.create({ name: p.name, nric: p.nric, nationality: p.nationality });
    pMap[p.key] = doc._id;
    console.log(`  ✓ personnel ${p.name} -> ${doc._id}`);
  }
  // ② 建所有公司（先不带 links），建立 key -> _id 映射
  const cMap = {};
  for (const c of COMPANIES) {
    const doc = await Company.create({
      name: c.name, registrationNumber: c.registrationNumber,
      type: c.type, status: c.status, jurisdiction: c.jurisdiction,
    });
    cMap[c.key] = doc._id;
    console.log(`  ✓ company ${c.name} -> ${doc._id}`);
  }
  // ③ 回填 links（引用真实 _id）。update 默认不跑 schema validators，故 link 为 undefined 也不会报错——此处 pMap 应有值
  for (const c of COMPANIES) {
    if (!c.links || !c.links.length) continue;
    const built = c.links.map((l) => ({
      linkModel: l.linkModel,
      link: l.linkModel === 'Personnel' ? pMap[l.ref] : cMap[l.ref],
      roles: l.roles,
      shares: l.shares,
      shareType: l.shareType,
      appointmentDate: toDate(l.appointmentDate),
    }));
    await Company.findByIdAndUpdate(cMap[c.key], { links: built }, { runValidators: false });
  }
  // ④ 验证落库（用 countDocuments 而非聚合，避免再踩 aggregate.toArray 坑）
  const persCount = await Personnel.countDocuments({ nric: /^DEMO-/ });
  const compCount = await Company.countDocuments({ registrationNumber: /^DEMO-/ });
  const linksAgg = await Company.aggregate([
    { $match: { registrationNumber: /^DEMO-/ } },
    { $project: { n: { $size: { $ifNull: ['$links', []] } } } },
    { $group: { _id: 0, total: { $sum: '$n' } } },
  ]);
  const totalCompanyLinks = linksAgg[0] ? linksAgg[0].total : 0;
  console.log(`✅ 演示数据已写入：Personnel ${persCount}、Company ${compCount}、Company.links ${totalCompanyLinks}`);
  if (persCount !== PERSONNEL.length) {
    console.warn(`⚠️ 警告：Personnel 落库数 ${persCount} 不等于期望 ${PERSONNEL.length}，请检查 Personnel 模型/连接`);
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  if (!DRY_RUN) assertSafeToWrite();

  if (DO_CLEAR) {
    console.log('🧹 CLEAR 模式：清空 DEMO- 演示数据');
    await doClear();
  } else if (DO_APPLY) {
    console.log('✍️  APPLY 模式：先清空旧 DEMO- 再写入（幂等，可重复跑）');
    await doClear();
    await doApply();
  } else {
    console.log('🔍 DRY RUN 模式（不写库）');
    console.log(`   将创建 Personnel: ${PERSONNEL.length}`);
    console.log(`   将创建 Company:   ${COMPANIES.length}`);
    console.log(`   将创建 Links:     ${totalLinks}`);
    console.log('\n   运行 `node scripts/seed-prod.js --apply --i-know-this-is-prod` 真实写入。');
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  mongoose.disconnect().catch(() => undefined).finally(() => process.exit(1));
});
