/**
 * 模板路由集成测试（node:test + mongodb-memory-server）。
 * 覆盖：
 *   - 5 个写接口（POST /, PUT /:id, DELETE /:id, POST /:id/duplicate, POST /initialize）
 *     的鉴权由 adminAuth 换为 editorAuth（admin || secretary），viewer 应 403。
 *   - POST /:id/resolve 正确接收并透传 { companyId, directorIds, meetingId }。
 */
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-routes';

const { startTestDb, stopTestDb } = require('./testDb');
const User = require('../models/User');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const Meeting = require('../models/Meeting');
const router = require('../routes/templates');

/** 构造一个能通过 assertValidDocSchema 的最小 docSchema。 */
function validDocSchema() {
  return {
    schemaVersion: 1,
    layoutMode: 'custom',
    meta: { docTitle: '测试文档' },
    fields: [
      { key: 'companyName', label: '公司', type: 'text', source: 'company', fieldPath: 'name' },
      { key: 'board', label: '董事', type: 'text', source: 'director', fieldPath: 'boardList' },
      { key: 'mdate', label: '会议日期', type: 'text', source: 'meeting', fieldPath: 'meeting.date' },
    ],
    rules: [],
    layout: { sections: [{ type: 'paragraph', segments: [{ var: 'companyName', blank: '＿＿＿＿' }] }] },
  };
}

test('templates routes: editorAuth 权限 + resolve 收参', async () => {
  await startTestDb();
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/templates', router);

    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/templates`;

    const admin = await User.create({ name: 'Admin', email: 'admin@t.co', password: 'secret1', role: 'admin' });
    const secretary = await User.create({ name: 'Sec', email: 'sec@t.co', password: 'secret1', role: 'secretary' });
    const viewer = await User.create({ name: 'View', email: 'view@t.co', password: 'secret1', role: 'viewer' });

    const sign = (u) => jwt.sign({ userId: u._id }, process.env.JWT_SECRET);
    const adminToken = sign(admin);
    const secToken = sign(secretary);
    const viewerToken = sign(viewer);
    const authH = (t) => ({ Authorization: `Bearer ${t}` });

    // 1) editorAuth：viewer 调 POST / 应 403
    let res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(viewerToken) },
      body: JSON.stringify({ name: 'X', docSchema: validDocSchema() }),
    });
    assert.strictEqual(res.status, 403, 'viewer 写模板应被 403（editorAuth）');

    // 2) editorAuth：secretary 调 POST / 应 201
    res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(secToken) },
      body: JSON.stringify({ name: '秘书创建', category: 'other', docSchema: validDocSchema() }),
    });
    assert.strictEqual(res.status, 201, 'secretary 应可创建模板（editorAuth）');
    const created = await res.json();
    assert.ok(created.template && created.template._id, '创建响应应包含 template._id');
    const tplId = created.template._id;

    // 3) editorAuth：admin 调 PUT /:id 应 200
    res = await fetch(`${base}/${tplId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH(adminToken) },
      body: JSON.stringify({ name: 'Admin改名' }),
    });
    assert.strictEqual(res.status, 200, 'admin 应可更新模板（editorAuth）');

    // 4) editorAuth：viewer 调 DELETE /:id 应 403
    res = await fetch(`${base}/${tplId}`, {
      method: 'DELETE',
      headers: authH(viewerToken),
    });
    assert.strictEqual(res.status, 403, 'viewer 删除应被 403（editorAuth）');

    // 5) editorAuth：secretary 调 POST /:id/duplicate 应 201
    res = await fetch(`${base}/${tplId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(secToken) },
      body: JSON.stringify({ name: '副本' }),
    });
    assert.strictEqual(res.status, 201, 'secretary 应可复制模板（editorAuth）');

    // 6) editorAuth：viewer 调 POST /initialize 应 403
    res = await fetch(`${base}/initialize`, {
      method: 'POST',
      headers: authH(viewerToken),
    });
    assert.strictEqual(res.status, 403, 'viewer 初始化应被 403（editorAuth）');

    // 7) resolve 收参：admin 透传 directorIds + meetingId，校验解析透传
    const company = await Company.create({ name: '会议公司' });
    const d1 = await Personnel.create({ name: '董事甲', nric: 'P9', roles: ['director'] });
    const d2 = await Personnel.create({ name: '董事乙', nric: 'P10', roles: ['director'] });
    const meeting = await Meeting.create({
      title: '测试会议',
      scheduledAt: new Date('2026-05-01T09:00:00Z'),
      agenda: [{ item: '议程一' }],
      company: company._id,
    });

    res = await fetch(`${base}/${tplId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(adminToken) },
      body: JSON.stringify({ companyId: null, directorIds: [d1._id, d2._id], meetingId: meeting._id }),
    });
    assert.strictEqual(res.status, 200, 'resolve 应 200');
    const payload = await res.json();
    assert.strictEqual(payload.success, true);
    assert.ok(
      payload.values.board && payload.values.board.includes('董事甲') && payload.values.board.includes('董事乙'),
      'resolve 应透传 directorIds 并解析 boardList'
    );
    assert.strictEqual(payload.values.mdate, '2026-05-01', 'resolve 应透传 meetingId 并解析 meeting.date');
    assert.ok(payload.values.companyName === '' || payload.values.companyName === undefined, 'companyId 为 null 时公司变量应为空');

    // 8) resolve 无参时 director/meeting 应为空串（不报错）
    res = await fetch(`${base}/${tplId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(adminToken) },
      body: JSON.stringify({}),
    });
    const payload2 = await res.json();
    assert.strictEqual(payload2.values.board, '', '无 directorIds 时 board 应为空串');
    assert.strictEqual(payload2.values.mdate, '', '无 meetingId 时 mdate 应为空串');

    server.close();
  } finally {
    await stopTestDb();
  }
});
