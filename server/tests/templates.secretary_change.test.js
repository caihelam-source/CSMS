// 集成测试：验证新增「公司秘书变更 (secretary_change)」类别及两份预设模板
//   - 公司秘书辞任信（Mr Pang / 离职秘书签署）
//   - 公司秘书同意出任函（Mr Lin / 新任秘书签署）
//
// 使用 mongodb-memory-server 真实数据库 + 真实 express 路由做端到端验证，
// 不依赖任何上游实现重写，仅独立验证行为是否符合预期。
//
// 运行：node --test server/tests/templates.secretary_change.test.js
// （需设置 MONGOMS_MD5_CHECK=false 以规避沙箱对 .md5 文件的 safe-delete 拦截）
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'qa-cosec-test-secret';
process.env.MONGOMS_MD5_CHECK = 'false';

const templateRoutes = require('../routes/templates');
const User = require('../models/User');
const Company = require('../models/Company');
const DocumentTemplate = require('../models/DocumentTemplate');

// ── 被测对象常量 ──
const RESIGN_NAME = '公司秘书辞任信';
const CONSENT_NAME = '公司秘书同意出任函';

// 辞任信声明变量（与 routes/templates.js getPresetTemplates() 保持一致）
const RESIGN_VARS = [
  '出具日期', '公司名称', '公司中文名', '生效日期',
  '辞任原因', '辞任秘书姓名', '辞任秘书中文名',
];
// 同意出任函声明变量
const CONSENT_VARS = [
  '出具日期', '公司名称', '注册地址', '生效日期', '同意出任秘书姓名',
  '国籍', '香港身份证号', '通讯地址', '联系电话', '电子邮箱',
];

let mongo, app, server, baseUrl, token;
let resignId, consentId, companyId;

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function call(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON（理论上不会） */ }
  return { status: res.status, json, text };
}

describe('secretary_change 预设模板端到端验证', () => {
  before(async () => {
    // 默认按版本自动下载/使用缓存二进制（CI 友好）；
    // 本地若沙箱拦截二进制清理，可设置 MONGOMS_SYSTEM_BINARY 指向已解压的 mongod 跳过下载。
    const binaryOpts = process.env.MONGOMS_SYSTEM_BINARY
      ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
      : { version: '7.0.14' };
    mongo = await MongoMemoryServer.create({ binary: binaryOpts });
    await mongoose.connect(mongo.getUri());

    const user = await User.create({
      name: 'QA Tester', email: 'qa@test.com', password: 'secret123', role: 'secretary',
    });
    token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET);

    const company = await Company.create({
      name: 'Test Co Ltd',
      nameChinese: '測試有限公司',
      registeredAddress: { street: '1/F', city: 'Central', country: 'Hong Kong' },
      registrationNumber: 'HK-123456',
    });
    companyId = company._id.toString();

    app = express();
    app.use(express.json());
    app.use('/api/templates', templateRoutes);
    await new Promise((r) => { server = app.listen(0, r); });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/templates`;

    // 初始化预设模板
    await call('POST', '/initialize');

    // 取出两份新模板的 id，供后续用例复用
    const list = await call('GET', '/');
    const all = list.json.templates;
    resignId = all.find((t) => t.name === RESIGN_NAME)._id;
    consentId = all.find((t) => t.name === CONSENT_NAME)._id;
  });

  after(async () => {
    await server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
  });

  test('预设初始化：数据库中存在两份 secretary_change 预设模板', { serial: true }, async () => {
    const list = await call('GET', '/?category=secretary_change');
    assert.strictEqual(list.status, 200);
    const names = list.json.templates.map((t) => t.name);
    assert.ok(names.includes(RESIGN_NAME), `应包含「${RESIGN_NAME}」`);
    assert.ok(names.includes(CONSENT_NAME), `应包含「${CONSENT_NAME}」`);
    // 均为预设
    for (const t of list.json.templates) {
      assert.strictEqual(t.isPreset, true);
      assert.strictEqual(t.category, 'secretary_change');
    }
  });

  test('initialize 幂等：重复调用不重复插入', { serial: true }, async () => {
    const before = await DocumentTemplate.countDocuments({ category: 'secretary_change', isPreset: true });
    const r = await call('POST', '/initialize');
    assert.strictEqual(r.status, 200);
    const afterCount = await DocumentTemplate.countDocuments({ category: 'secretary_change', isPreset: true });
    assert.strictEqual(afterCount, before, '重复初始化不应新增预设');
  });

  test('辞任信详情：字段与变量声明完整', { serial: true }, async () => {
    const r = await call('GET', `/${resignId}`);
    assert.strictEqual(r.status, 200);
    const t = r.json.template;
    assert.strictEqual(t.name, RESIGN_NAME);
    assert.strictEqual(t.category, 'secretary_change');
    assert.strictEqual(t.isPreset, true);
    const keys = t.variables.map((v) => v.key).sort();
    assert.deepStrictEqual(keys, [...RESIGN_VARS].sort());
  });

  test('同意出任函详情：字段与变量声明完整', { serial: true }, async () => {
    const r = await call('GET', `/${consentId}`);
    assert.strictEqual(r.status, 200);
    const t = r.json.template;
    assert.strictEqual(t.name, CONSENT_NAME);
    assert.strictEqual(t.category, 'secretary_change');
    const keys = t.variables.map((v) => v.key).sort();
    assert.deepStrictEqual(keys, [...CONSENT_VARS].sort());
  });

  test('变量一致性：声明变量与 content 内 {{占位符}} 一一对应（辞任信）', { serial: true }, async () => {
    const r = await call('GET', `/${resignId}`);
    const content = r.json.template.content;
    const placeholders = [...new Set((content.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
    const declared = r.json.template.variables.map((v) => v.key);
    assert.deepStrictEqual(
      placeholders.sort(),
      declared.sort(),
      'content 中的 {{占位符}} 必须与声明的 variables 完全一致（无孤儿/缺失）',
    );
  });

  test('变量一致性：声明变量与 content 内 {{占位符}} 一一对应（同意出任函）', { serial: true }, async () => {
    const r = await call('GET', `/${consentId}`);
    const content = r.json.template.content;
    const placeholders = [...new Set((content.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
    const declared = r.json.template.variables.map((v) => v.key);
    assert.deepStrictEqual(placeholders.sort(), declared.sort());
  });

  test('变量 source 标记：公司字段 source=company，其余 source=manual', { serial: true }, async () => {
    const r = await call('GET', `/${resignId}`);
    const byKey = Object.fromEntries(r.json.template.variables.map((v) => [v.key, v.source]));
    assert.strictEqual(byKey['公司名称'], 'company');
    assert.strictEqual(byKey['公司中文名'], 'company');
    assert.strictEqual(byKey['出具日期'], 'manual');
    assert.strictEqual(byKey['辞任秘书姓名'], 'manual');
  });

  test('render 辞任信：填入全部 manualVars 后无残留占位符', { serial: true }, async () => {
    const manualVars = {
      出具日期: '30 June 2026',
      生效日期: '1 July 2026',
      公司名称: 'Test Co Ltd',
      公司中文名: '測試有限公司',
      辞任原因: 'to pursue other personal commitments',
      辞任秘书姓名: 'Pang Chi Wai',
      辞任秘书中文名: '彭志伟',
    };
    const r = await call('POST', `/${resignId}/render`, { manualVars });
    assert.strictEqual(r.status, 200);
    const html = r.json.html;
    assert.strictEqual(html.includes('{{'), false, '渲染后不应残留任何 {{ 占位符');
    // 固定文案保留
    assert.ok(html.includes('Letter of Resignation'));
    assert.ok(html.includes('Resignation as company secretary'));
    // 变量值已正确注入
    assert.ok(html.includes('Pang Chi Wai'));
    assert.ok(html.includes('彭志伟'));
    assert.ok(html.includes('1 July 2026'));
  });

  test('render 辞任信：传入 companyId 自动填充公司字段', { serial: true }, async () => {
    const r = await call('POST', `/${resignId}/render`, {
      companyId,
      manualVars: { 出具日期: '30 June 2026', 生效日期: '1 July 2026', 辞任原因: 'x', 辞任秘书姓名: 'A', 辞任秘书中文名: '甲' },
    });
    assert.strictEqual(r.status, 200);
    const html = r.json.html;
    assert.ok(html.includes('Test Co Ltd'), '公司名称应自动填充');
    assert.ok(html.includes('測試有限公司'), '公司中文名应自动填充');
  });

  test('render 同意出任函：填入全部 manualVars 后无残留占位符', { serial: true }, async () => {
    const manualVars = {
      出具日期: '1 July 2026',
      生效日期: '2 July 2026',
      公司名称: 'Test Co Ltd',
      注册地址: '1/F, Central, Hong Kong',
      同意出任秘书姓名: 'Lin Ka Ho',
      国籍: 'Chinese',
      香港身份证号: 'A123456(7)',
      通讯地址: '2/F, Wan Chai, HK',
      联系电话: '+852 2345 6789',
      电子邮箱: 'lin@example.com',
    };
    const r = await call('POST', `/${consentId}/render`, { manualVars });
    assert.strictEqual(r.status, 200);
    const html = r.json.html;
    assert.strictEqual(html.includes('{{'), false, '渲染后不应残留任何 {{ 占位符');
    assert.ok(html.includes('Consent to Act'));
    assert.ok(html.includes('Lin Ka Ho'));
    assert.ok(html.includes('A123456(7)'));
    assert.ok(html.includes('lin@example.com'));
    // 同意出任函含变量表格，逐项应被填充
    assert.ok(html.includes('2/F, Wan Chai, HK'));
    assert.ok(html.includes('+852 2345 6789'));
  });

  test('render 同意出任函：companyId 自动填充注册地址', { serial: true }, async () => {
    const r = await call('POST', `/${consentId}/render`, {
      companyId,
      manualVars: {
        出具日期: '1 July 2026', 生效日期: '2 July 2026', 同意出任秘书姓名: 'Lin Ka Ho',
        国籍: 'Chinese', 香港身份证号: 'A123456(7)', 通讯地址: 'addr', 联系电话: 'tel', 电子邮箱: 'e@m.com',
      },
    });
    assert.strictEqual(r.status, 200);
    const html = r.json.html;
    assert.ok(html.includes('1/F, Central, Hong Kong'), '注册地址应自动填充为公司地址文本');
    assert.strictEqual(html.includes('[object Object]'), false, '注册地址不应渲染为 [object Object]');
  });

  test('render 部分填充：仅手动变量被替换，未提供变量保留为占位符', { serial: true }, async () => {
    // 只提交一个 manualVar，其余声明变量（含公司字段未传 companyId）应保持 {{}}
    const r = await call('POST', `/${resignId}/render`, { manualVars: { 辞任秘书姓名: 'Only Me' } });
    assert.strictEqual(r.status, 200);
    const html = r.json.html;
    assert.ok(html.includes('Only Me'));
    // 未提供的手动变量仍是占位符
    assert.ok(html.includes('{{出具日期}}'), '未提供的手动变量应保留占位符');
    assert.ok(html.includes('{{生效日期}}'), '未提供的手动变量应保留占位符');
    assert.ok(html.includes('{{公司名称}}'), '未传 companyId 时公司字段应保留占位符');
  });

  test('render 未知模板 id 返回 404', { serial: true }, async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const r = await call('POST', `/${fakeId}/render`, { manualVars: {} });
    assert.strictEqual(r.status, 404);
  });

  test('删除预设模板返回 403（不可删除）', { serial: true }, async () => {
    const r = await call('DELETE', `/${resignId}`);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.json.message, '预设模板不可删除');
    // 确认未被删
    const still = await DocumentTemplate.findById(resignId);
    assert.ok(still, '预设模板应仍存在');
  });
});
