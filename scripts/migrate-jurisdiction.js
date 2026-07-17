/**
 * jurisdiction 枚举统一迁移脚本（v5.0 指令#2）
 * ─────────────────────────────────────────────────────────────────
 * 将库中所有 jurisdiction 取值统一为英文枚举：
 *   Company.jurisdiction : 'Hong Kong'→'HK' / 'Cayman Islands'→'Cayman'
 *                          / 'British Virgin Islands'→'BVI' / 'Singapore'→'SG'
 *                          / 其他未知→'OTHER'（'BVI'/'Cayman'/'HK' 已是英文，原样保留）
 *   ComplianceRule.jurisdiction: '香港'→'HK' / '开曼'→'Cayman' / 'BVI'→'BVI'
 *                          / '新加坡'→'SG' / '其他'→'OTHER' / '全部'→'ALL'
 *
 * 背景：此前 Company 存 'Hong Kong'/'Cayman Islands'，规则种子用中文
 * '香港'/'开曼'，Plan B 的成立日计算 switch 用 'HK'/'Cayman'，三套互不匹配，
 * 导致真实 HK/Cayman 公司走兜底逻辑。现统一为英文枚举（见 server/models
 * 的 enum 定义与 presetRules.js）。
 *
 * 用法：
 *   node scripts/migrate-jurisdiction.js                 # DRY RUN（统计，不写入）
 *   node scripts/migrate-jurisdiction.js --apply         # 真实写入（先在备份库验证）
 *
 * 安全策略：
 *   - 默认 DRY RUN，绝不写库。
 *   - 连接库由 MONGODB_URI 指定；疑似生产库需追加 --i-know-this-is-prod。
 *   - 不删除任何文档，仅更新 jurisdiction 字段。
 */

const mongoose = require('mongoose');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'server', 'models');
const Company = require(path.join(modelsDir, 'Company'));
const ComplianceRule = require(path.join(modelsDir, 'ComplianceRule'));

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary';
const DRY_RUN = !process.argv.includes('--apply');

const COMPANY_MAP = {
  'hong kong': 'HK',
  'hk': 'HK',
  'bvi': 'BVI',
  'british virgin islands': 'BVI',
  'cayman': 'Cayman',
  'cayman islands': 'Cayman',
  'singapore': 'SG',
};
const RULE_MAP = {
  // 中文
  '香港': 'HK',
  '开曼': 'Cayman',
  '新加坡': 'SG',
  '其他': 'OTHER',
  '全部': 'ALL',
  // 英文（小写键，统一映射到模型 enum 的正确大小写；Cayman 是首字母大写，不能用 toUpperCase）
  'hk': 'HK',
  'bvi': 'BVI',
  'cayman': 'Cayman',
  'sg': 'SG',
  'other': 'OTHER',
  'all': 'ALL',
};

function mapCompanyJur(raw) {
  if (!raw) return 'HK';
  const key = String(raw).trim().toLowerCase();
  return COMPANY_MAP[key] || (['hk', 'bvi', 'cayman', 'sg', 'other'].includes(key) ? raw.toUpperCase() : 'OTHER');
}
function mapRuleJur(raw) {
  if (!raw) return 'ALL';
  const key = String(raw).trim().toLowerCase();
  // RULE_MAP 已覆盖全部已知取值（含英文小写），未知一律归 OTHER；不再用 toUpperCase（会破坏 Cayman 大小写）
  return RULE_MAP[key] || 'OTHER';
}

// ── 生产库守卫 ─────────────────────────────────────────────
function assertSafeToWrite() {
  const dbName = (MONGO_URI.split('/').pop() || '').toLowerCase();
  const looksProd = /prod|production|live|主/.test(dbName);
  if (looksProd && !process.argv.includes('--i-know-this-is-prod')) {
    throw new Error(
      `检测到疑似生产库 "${dbName}"。若确认要在该库执行，请追加 --i-know-this-is-prod。\n` +
      `强烈建议：先 mongodump 备份，恢复到临时实例后再 --apply。`
    );
  }
}

async function main() {
  console.log(`\n[jurisdiction 迁移] 模式: ${DRY_RUN ? 'DRY RUN（不写入）' : 'APPLY（真实写入）'}`);
  console.log(`连接: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}\n`);

  await mongoose.connect(MONGO_URI);
  if (!DRY_RUN) assertSafeToWrite();

  let companyChanged = 0, companyTotal = 0;
  let ruleChanged = 0, ruleTotal = 0;

  // ---- Company ----
  const companies = await Company.find({}, 'jurisdiction').lean();
  companyTotal = companies.length;
  for (const c of companies) {
    const next = mapCompanyJur(c.jurisdiction);
    if (next !== c.jurisdiction) {
      companyChanged++;
      if (!DRY_RUN) await Company.updateOne({ _id: c._id }, { $set: { jurisdiction: next } });
      if (DRY_RUN) console.log(`  Company ${c._id}: ${c.jurisdiction || '(空)'} → ${next}`);
    }
  }

  // ---- ComplianceRule ----
  const rules = await ComplianceRule.find({}, 'jurisdiction').lean();
  ruleTotal = rules.length;
  for (const r of rules) {
    const next = mapRuleJur(r.jurisdiction);
    if (next !== r.jurisdiction) {
      ruleChanged++;
      if (!DRY_RUN) await ComplianceRule.updateOne({ _id: r._id }, { $set: { jurisdiction: next } });
      if (DRY_RUN) console.log(`  Rule    ${r._id}: ${r.jurisdiction || '(空)'} → ${next}`);
    }
  }

  console.log(`\n汇总:`);
  console.log(`  Company: ${companyTotal} 条，需变更 ${companyChanged} 条`);
  console.log(`  Rule:    ${ruleTotal} 条，需变更 ${ruleChanged} 条`);
  console.log(DRY_RUN ? `\n[DRY RUN] 未写入。确认无误后加 --apply 执行。` : `\n[APPLY] 已写入 ${companyChanged + ruleChanged} 条变更。`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('迁移失败:', e.message);
  try { await mongoose.disconnect(); } catch { /* 忽略断开异常 */ }
  process.exit(1);
});
