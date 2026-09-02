const { classifyNameRelation, normalizeCompanyName } = require('../server/utils/companyNameNormalize');
const cases = [
  // 真实场景：target.nameChinese 通常空着（这就是 bug），source 把中文塞了进来
  { src: 'HuiJun (International) Holdings Ltd',      tgt: 'HUIJUN (INTERNATIONAL) HOLDINGS LIMITED', srcCn: '匯駿控股', tgtCn: '' },
  { src: 'Easy Rich Corporation Ltd',                 tgt: 'EASY RICH CORPORATION LIMITED',         srcCn: '順富興業', tgtCn: '' },
  // 真曾用名 — 业务改名
  { src: 'OldCo Holdings Limited',                    tgt: 'NewCo Holdings Limited',                srcCn: null,       tgtCn: null },
  // 纯中文匹配 — 字符串完全相同
  { src: '順富興業',                                  tgt: '',                                      srcCn: '順富興業', tgtCn: '順富興業' },
  // 真曾用名 — 主体差异（不同中间部分）
  { src: 'ABC Limited',                               tgt: 'XYZ Holdings Limited',                 srcCn: null,       tgtCn: null },
];
let pass = 0, fail = 0;
const expect = [
  'identical', 'identical', 'different', 'chinese', 'different',
];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const r = classifyNameRelation(
    { name: c.src, nameChinese: c.srcCn },
    { name: c.tgt, nameChinese: c.tgtCn },
  );
  const ok = r === expect[i];
  console.log(`[${ok ? 'OK ' : 'FAIL'}] case ${i}: src=${c.src} tgt=${c.tgt} → ${r} (expect ${expect[i]})`);
  if (ok) pass++; else fail++;
}
console.log('\nsummary: ' + pass + ' pass / ' + fail + ' fail');
console.log('normalize("HuiJun (International) Holdings Ltd")      = ' + JSON.stringify(normalizeCompanyName('HuiJun (International) Holdings Ltd')));
console.log('normalize("HUIJUN (INTERNATIONAL) HOLDINGS LIMITED")  = ' + JSON.stringify(normalizeCompanyName('HUIJUN (INTERNATIONAL) HOLDINGS LIMITED')));
process.exit(fail ? 1 : 0);
