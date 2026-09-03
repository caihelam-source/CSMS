const { pickRef } = require('../server/utils/queryAlias');

const cases = [
  // 1. 规范名胜出（防止一请求带两值时静默错乱）
  { q: { company: 'aaa', companyId: 'bbb' },       field: 'company',    expect: 'aaa' },
  // 2. 公司带 companyId 别名（前端 services 习惯）— 必须能解析
  { q: { companyId: 'cmp123' },                     field: 'company',    expect: 'cmp123' },
  // 3. 兼容 personnel/meeting 其它引用型
  { q: { personnelId: 'p9' },                       field: 'personnel',  expect: 'p9' },
  { q: { meetingId: 'm1' },                         field: 'meeting',    expect: 'm1' },
  // 4. 都不在 — undefined（让上层 if 跳过过滤）
  { q: {},                                          field: 'company',    expect: undefined },
  { q: { foo: 'bar' },                              field: 'company',    expect: undefined },
  // 5. 安全：query 为 null/undefined 不崩
  { q: null,                                        field: 'company',    expect: undefined },
  { q: undefined,                                   field: 'company',    expect: undefined },
  // 6. 空字符串不作为有效过滤（防止 URL 写成 ?company= 把全部返回）
  { q: { company: '' },                             field: 'company',    expect: undefined },
  { q: { companyId: '' },                           field: 'company',    expect: undefined },
];

let pass = 0, fail = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const r = pickRef(c.q, c.field);
  const ok = r === c.expect;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] case ${i}: q=${JSON.stringify(c.q)} field=${c.field} → ${JSON.stringify(r)} (expect ${JSON.stringify(c.expect)})`);
  if (ok) pass++; else fail++;
}
console.log('\nsummary: ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail ? 1 : 0);
