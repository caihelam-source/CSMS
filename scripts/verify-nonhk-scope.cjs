/* 临时验证：证明「在港注册非香港公司」的 HK 规则并行适用 + NAR1/NN3 互斥。验证完即删。 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ruleApplicability } = require('../server/services/complianceService');
const PRESET_RULES = require('../server/services/presetRules');

const byId = (id) => PRESET_RULES.find((r) => r.ruleId === id);
const hkAR = byId('HK_AR_42');        // NAR1, jurisdiction=HK, companyScope=HK_LOCAL
const nn3 = byId('HK_NN3_AR');        // NN3,  jurisdiction=ALL, companyScope=HK_NON_HK
const brRenew = byId('HK_BR_RENEW');  // BR 续期, jurisdiction=HK
const caymanRule = PRESET_RULES.find((r) => r.jurisdiction === 'Cayman') || { ruleId: 'CAYMAN_X', jurisdiction: 'Cayman' };
const bviRule = PRESET_RULES.find((r) => r.jurisdiction === 'BVI') || { ruleId: 'BVI_X', jurisdiction: 'BVI' };

const companies = [
  { label: '① 香港本地公司', c: { name: 'HK Ltd', jurisdiction: 'HK', nonHongKongCompany: false } },
  { label: '② 开曼成立·在港注册（注册非香港公司）', c: { name: 'Cayman HK-listed', jurisdiction: 'Cayman', nonHongKongCompany: true, isListed: true, listingLocation: 'HK' } },
  { label: '③ 纯开曼公司（不在港注册）', c: { name: 'Pure Cayman', jurisdiction: 'Cayman', nonHongKongCompany: false } },
  { label: '④ BVI 成立·在港注册', c: { name: 'BVI in HK', jurisdiction: 'BVI', nonHongKongCompany: true } },
];

const rules = [
  ['HK_AR_42 (NAR1)', hkAR],
  ['HK_NN3_AR (NN3)', nn3],
  ['HK_BR_RENEW (BR)', brRenew],
  [`${caymanRule.ruleId} (Cayman)`, caymanRule],
  [`${bviRule.ruleId} (BVI)`, bviRule],
];

let fail = 0;
for (const { label, c } of companies) {
  console.log('\n' + label);
  for (const [rname, rule] of rules) {
    if (!rule) { console.log(`  ${rname.padEnd(24)} — 预设中不存在，跳过`); continue; }
    const reason = ruleApplicability(rule, c);
    console.log(`  ${rname.padEnd(24)} ${reason ? '✗ 不适用 (' + reason + ')' : '✓ 适用'}`);
  }
}

console.log('\n=== 断言 ===');
const assert = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fail++; };

const hkLocal = companies[0].c;
const caymanInHk = companies[1].c;
const pureCayman = companies[2].c;
const bviInHk = companies[3].c;

assert(ruleApplicability(hkAR, hkLocal) === null, '① HK 本地公司 → NAR1 适用');
assert(ruleApplicability(nn3, hkLocal) === 'requires_non_hk_registration', '① HK 本地公司 → NN3 不适用（互斥）');

assert(ruleApplicability(nn3, caymanInHk) === null, '② 开曼在港注册 → NN3 适用');
assert(ruleApplicability(hkAR, caymanInHk) === 'hk_local_only', '② 开曼在港注册 → NAR1 不适用（互斥）');
assert(ruleApplicability(brRenew, caymanInHk) === null, '② 开曼在港注册 → 香港 BR 续期【并行】适用');
assert(ruleApplicability(caymanRule, caymanInHk) === null, '② 开曼在港注册 → 开曼本地规则【并行】适用');

assert(ruleApplicability(nn3, pureCayman) === 'requires_non_hk_registration', '③ 纯开曼 → NN3 不适用');
assert(ruleApplicability(hkAR, pureCayman) === 'jurisdiction_mismatch', '③ 纯开曼 → NAR1 不适用');
assert(ruleApplicability(brRenew, pureCayman) === 'jurisdiction_mismatch', '③ 纯开曼 → 香港 BR 不适用');
assert(ruleApplicability(caymanRule, pureCayman) === null, '③ 纯开曼 → 开曼本地规则适用');

assert(ruleApplicability(nn3, bviInHk) === null, '④ BVI 在港注册 → NN3 适用');
assert(ruleApplicability(hkAR, bviInHk) === 'hk_local_only', '④ BVI 在港注册 → NAR1 不适用');
assert(ruleApplicability(bviRule, bviInHk) === null, '④ BVI 在港注册 → BVI 本地规则【并行】适用');

console.log(fail === 0 ? '\n✅ 全部断言通过' : `\n❌ ${fail} 条断言失败`);
process.exit(fail === 0 ? 0 : 1);
