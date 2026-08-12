/**
 * 模板预填解析测试（node:test）。
 * 覆盖：director / meeting 解析 + company / system 行为不变。
 * 纯函数部分无需数据库；resolveValues 的 director/meeting 端到端走 mongodb-memory-server。
 */
const test = require('node:test');
const assert = require('node:assert');

const {
  resolveValues,
  resolveDirectorValue,
  resolveMeetingValue,
  resolveCompanyValue,
  resolveSystemValue,
} = require('../services/templateResolver');
const { startTestDb, stopTestDb } = require('./testDb');
const Personnel = require('../models/Personnel');
const Meeting = require('../models/Meeting');
const Company = require('../models/Company');

test('resolveDirectorValue: name / count / boardList / 空数据', () => {
  const directors = [
    { name: '张三', roles: ['director'] },
    { name: '李四', roles: ['director', 'chairman'] },
  ];
  assert.strictEqual(resolveDirectorValue(directors, 'director.name'), '张三、李四');
  assert.strictEqual(resolveDirectorValue(directors, 'director.count'), '2');
  assert.strictEqual(
    resolveDirectorValue(directors, 'boardList'),
    '张三（director）、李四（director/chairman）'
  );
  // 无 nameChinese 时回退到 name，拼接风格与 director.name 一致
  assert.strictEqual(resolveDirectorValue(directors, 'director.chineseName'), '张三、李四');
  assert.strictEqual(resolveDirectorValue(directors, 'director.unknown'), '');
  assert.strictEqual(resolveDirectorValue([], 'director.name'), '');
  assert.strictEqual(resolveDirectorValue(null, 'director.name'), '');
});

test('resolveMeetingValue: title / date / agenda / 空数据', () => {
  const meeting = {
    title: '董事会',
    scheduledAt: new Date('2026-03-28T10:00:00Z'),
    agenda: [{ item: 'A' }, { item: 'B' }],
  };
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.title'), '董事会');
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.date'), '2026-03-28');
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.scheduledAt'), '2026-03-28');
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.agenda'), 'A、B');
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.unknown'), '');
  assert.strictEqual(resolveMeetingValue(null, 'meeting.title'), '');
});

test('resolveCompanyValue / resolveSystemValue 行为不变', () => {
  const company = {
    name: '示例公司',
    registeredAddress: { street: '中环', city: '香港' },
    financialYearEnd: { day: 31, month: 12 },
  };
  assert.strictEqual(resolveCompanyValue(company, 'name'), '示例公司');
  assert.strictEqual(resolveCompanyValue(company, 'company.name'), '示例公司');
  assert.strictEqual(resolveCompanyValue(company, 'registeredAddress'), '中环、香港');
  assert.strictEqual(resolveCompanyValue(company, 'financialYearEnd'), '12月31日');
  assert.strictEqual(resolveCompanyValue(null, 'name'), '');

  const now = new Date('2026-08-06T00:00:00Z');
  assert.strictEqual(resolveSystemValue('today', null, now), '2026-08-06');
  assert.strictEqual(resolveSystemValue('year', null, now), '2026');
});

test('resolveValues: company/system 在无 companyId 时行为不变（system 仍解析，company 为空）', async () => {
  const template = {
    variables: [
      { key: 'c1', source: 'company', fieldPath: 'name' },
      { key: 's1', source: 'system', fieldPath: 'today' },
      { key: 'm1', source: 'manual', fieldPath: '' },
    ],
  };
  const now = new Date('2026-08-06T00:00:00Z');
  const { values, autoFilled } = await resolveValues(template, { now });
  // company 无数据 → 不出现；system 仍解析
  assert.strictEqual(values.c1, undefined);
  assert.strictEqual(values.s1, '2026-08-06');
  assert.ok(!autoFilled.includes('m1'));
});

test('resolveValues: director/meeting 经 directorIds + meetingId 端到端解析', async () => {
  await startTestDb();
  try {
    const d1 = await Personnel.create({ name: '王五', nric: 'P1', roles: ['director'] });
    const d2 = await Personnel.create({ name: '赵六', nric: 'P2', roles: ['director'] });
    const company = await Company.create({
      name: '测试公司',
      links: [
        { linkModel: 'Personnel', link: d1._id, roles: ['director'] },
        { linkModel: 'Personnel', link: d2._id, roles: ['director'] },
      ],
    });
    const meeting = await Meeting.create({
      title: '临时股东大会',
      scheduledAt: new Date('2026-05-01T09:00:00Z'),
      agenda: [{ item: '讨论议案' }],
      company: company._id,
    });

    const template = {
      variables: [
        { key: 'board', source: 'director', fieldPath: 'boardList' },
        { key: 'cnt', source: 'director', fieldPath: 'director.count' },
        { key: 'names', source: 'director', fieldPath: 'director.name' },
        { key: 'mdate', source: 'meeting', fieldPath: 'meeting.date' },
        { key: 'mtitle', source: 'meeting', fieldPath: 'meeting.title' },
        { key: 'magenda', source: 'meeting', fieldPath: 'meeting.agenda' },
      ],
    };

    const { values } = await resolveValues(template, {
      directorIds: [d1._id, d2._id],
      meetingId: meeting._id,
    });

    assert.strictEqual(values.cnt, '2');
    assert.ok(values.names.includes('王五') && values.names.includes('赵六'));
    assert.ok(values.board.includes('王五') && values.board.includes('赵六'));
    assert.strictEqual(values.mdate, '2026-05-01');
    assert.strictEqual(values.mtitle, '临时股东大会');
    assert.strictEqual(values.magenda, '讨论议案');
  } finally {
    await stopTestDb();
  }
});

test('resolveValues: 无 directorIds 时按公司 links 聚合出董事', async () => {
  await startTestDb();
  try {
    const d1 = await Personnel.create({ name: '钱七', nric: 'P3', roles: ['director'] });
    const d2 = await Personnel.create({ name: '孙八', nric: 'P4', roles: ['director'] });
    const company = await Company.create({
      name: '聚合公司',
      links: [
        { linkModel: 'Personnel', link: d1._id, roles: ['director'] },
        { linkModel: 'Personnel', link: d2._id, roles: ['director'] },
      ],
    });
    const template = {
      variables: [{ key: 'cnt', source: 'director', fieldPath: 'director.count' }],
    };
    const { values } = await resolveValues(template, { companyId: company._id });
    assert.strictEqual(values.cnt, '2');
  } finally {
    await stopTestDb();
  }
});
