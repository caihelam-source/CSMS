/**
 * 模板变量 fieldPath 白名单测试（node:test，无需数据库）。
 * 覆盖：DIRECTOR_FIELD_PATHS / MEETING_FIELD_PATHS 的完整性、不可变性与白名单约束力。
 */
const test = require('node:test');
const assert = require('node:assert');

const { DIRECTOR_FIELD_PATHS, MEETING_FIELD_PATHS } = require('../services/templateResolverPaths');
const { resolveDirectorValue, resolveMeetingValue } = require('../services/templateResolver');

test('DIRECTOR_FIELD_PATHS: 含全部约定字段且为冻结对象', () => {
  assert.ok(Object.isFrozen(DIRECTOR_FIELD_PATHS), 'DIRECTOR_FIELD_PATHS 应被冻结');
  for (const key of [
    'director.name',
    'director.chineseName',
    'director.nric',
    'director.role',
    'director.count',
    'boardList',
  ]) {
    assert.ok(key in DIRECTOR_FIELD_PATHS, `DIRECTOR_FIELD_PATHS 应含 ${key}`);
  }
});

test('MEETING_FIELD_PATHS: 含全部约定字段且为冻结对象', () => {
  assert.ok(Object.isFrozen(MEETING_FIELD_PATHS), 'MEETING_FIELD_PATHS 应被冻结');
  for (const key of ['meeting.title', 'meeting.date', 'meeting.scheduledAt', 'meeting.agenda']) {
    assert.ok(key in MEETING_FIELD_PATHS, `MEETING_FIELD_PATHS 应含 ${key}`);
  }
});

test('白名单约束力: 未知 fieldPath 解析为空串（防止越权访问）', () => {
  const directors = [{ name: '张三', roles: ['director'] }];
  assert.strictEqual(resolveDirectorValue(directors, 'director.hacked'), '');
  assert.strictEqual(resolveDirectorValue(directors, '__proto__'), '');
  assert.strictEqual(resolveDirectorValue(directors, 'constructor'), '');

  const meeting = { title: 'X', scheduledAt: new Date('2026-01-01T00:00:00Z') };
  assert.strictEqual(resolveMeetingValue(meeting, 'meeting.hacked'), '');
  assert.strictEqual(resolveMeetingValue(meeting, '__proto__'), '');
});
