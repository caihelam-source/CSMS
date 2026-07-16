/**
 * Claw 秘书管理系统 — 端到端回归测试
 *
 * 用法:
 *   node scripts/e2e-regression.js
 *
 * 说明:
 *   - 使用 mongodb-memory-server 在内存中启动真实 MongoDB（无需 Docker / 本地安装）
 *   - 启动真实 Express 服务 (server/index.js)，通过 HTTP 跑全模块回归
 *   - 覆盖: 鉴权、13 大模块 CRUD、股东/董事条目、ROM/ROD PDF 生成
 *
 * 退出码: 0 = 全部通过, 1 = 有失败
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}/api`;
const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function logResult(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}  ->  ${detail}`);
  }
}

function request(method, urlPath, { token, body, isBuffer } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(
      BASE + urlPath,
      { method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let parsed = raw;
          if (!isBuffer) {
            try { parsed = JSON.parse(raw.toString()); } catch { parsed = raw.toString(); }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    if (data) req.write(data);
    req.end();
  });
}

// 兼容多种响应体包裹格式, 提取创建后的 id
function extractId(body) {
  return (
    body?.company?._id ||
    body?.data?._id ||
    body?._id ||
    body?.personnel?._id ||
    body?.director?._id ||
    body?.document?._id ||
    body?.meeting?._id ||
    body?.task?._id ||
    body?.reminder?._id ||
    body?.signTask?._id ||
    null
  );
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    const r = await request('GET', '/health');
    if (r.status === 200) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log('\n🚀 启动内存 MongoDB...');
  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  console.log('   MongoDB URI:', mongoUri);

  console.log('🚀 启动后端服务 (真实 Express + Mongoose)...');
  const serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGODB_URI: mongoUri,
      JWT_SECRET: 'e2e-test-secret',
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
    },
  });
  serverProc.on('error', (e) => console.error('[spawn-error]', e.message));
  serverProc.stdout.on('data', (d) => process.env.E2E_VERBOSE && console.log('[server]', d.toString()));
  serverProc.stderr.on('data', (d) => console.error('[server-err]', d.toString()));

  const healthy = await waitForHealth();
  if (!healthy) {
    console.error('❌ 服务未能在 20s 内就绪');
    serverProc.kill();
    await mongo.stop();
    process.exit(1);
  }
  console.log('✅ 服务就绪\n');

  // ── 1. 鉴权 ──────────────────────────────────────────────
  console.log('【鉴权】');
  const reg = await request('POST', '/auth/register', {
    body: { name: 'E2E Tester', email: 'e2e@test.com', password: 'test1234', role: 'admin' },
  });
  logResult('注册返回 token', reg.status === 201 && reg.body.token, `status=${reg.status}`);
  const token = reg.body.token;

  const login = await request('POST', '/auth/login', {
    body: { email: 'e2e@test.com', password: 'test1234' },
  });
  logResult('登录返回 token', login.status === 200 && login.body.token, `status=${login.status}`);

  const me = await request('GET', '/auth/me', { token });
  logResult('GET /auth/me 鉴权通过', me.status === 200, `status=${me.status}`);

  const noToken = await request('GET', '/companies');
  logResult('无 token 被拒(401)', noToken.status === 401, `status=${noToken.status}`);

  // ── 2. Companies ─────────────────────────────────────────
  console.log('\n【Companies】');
  const coCreate = await request('POST', '/companies', {
    token,
    body: {
      name: 'Test Co Ltd', nameChinese: '测试有限公司', registrationNumber: 'CR-001',
      jurisdiction: 'HK', status: 'active', isListed: false,
    },
  });
  logResult('创建公司', coCreate.status === 201, `status=${coCreate.status}`);
  const companyId = extractId(coCreate.body);

  const coList = await request('GET', '/companies', { token });
  logResult('公司列表', coList.status === 200, `status=${coList.status}`);
  const coGet = await request('GET', `/companies/${companyId}`, { token });
  logResult('获取单公司', coGet.status === 200, `status=${coGet.status}`);
  const coUpdate = await request('PUT', `/companies/${companyId}`, { token, body: { status: 'dormant' } });
  logResult('更新公司', coUpdate.status === 200, `status=${coUpdate.status}`);
  const coStats = await request('GET', '/companies/stats/dashboard', { token });
  logResult('Dashboard 统计', coStats.status === 200, `status=${coStats.status}`);

  // ── 3. Personnel ─────────────────────────────────────────
  console.log('\n【Personnel】');
  const pCreate = await request('POST', '/personnel', {
    token, body: { name: 'John Doe', type: 'individual', roles: ['director'], email: 'john@test.com' },
  });
  logResult('创建人员', pCreate.status === 201, `status=${pCreate.status}`);
  const personnelId = extractId(pCreate.body);

  const pList = await request('GET', '/personnel', { token });
  logResult('人员列表', pList.status === 200, `status=${pList.status}`);

  // ── 4. Company Links (v5.0 统一关联, 读时聚合) ─────────────
  console.log('\n【Company Links】');
  const linkAdd = await request('POST', `/companies/${companyId}/links`, {
    token, body: { linkModel: 'Personnel', link: personnelId, roles: ['director'], appointmentDate: '2024-01-01' },
  });
  logResult('新增公司关联(link)', linkAdd.status === 201, `status=${linkAdd.status}`);

  const revLinks = await request('GET', `/companies/reverse-links?personnelId=${personnelId}`, { token });
  const revArr = revLinks.body.links || [];
  logResult('反查人员关联公司', revLinks.status === 200 && revArr.length >= 1, `status=${revLinks.status}, links=${revArr.length}`);

  const linkId = revArr[0]?._id;
  if (linkId) {
    const linkUpd = await request('PUT', `/companies/${companyId}/links/${linkId}`, { token, body: { roles: ['director', 'shareholder'] } });
    logResult('更新公司关联', linkUpd.status === 200, `status=${linkUpd.status}`);
    const linkDel = await request('DELETE', `/companies/${companyId}/links/${linkId}`, { token });
    logResult('删除公司关联', linkDel.status === 200, `status=${linkDel.status}`);
  } else {
    logResult('更新公司关联', false, '未取到 linkId');
    logResult('删除公司关联', false, '未取到 linkId');
  }

  // ── 5. Company Entries (股东/董事条目) ───────────────────
  console.log('\n【Company Entries】');
  const sh = await request('POST', `/companies/${companyId}/shareholder-entries`, {
    token, body: { holderType: 'individual', holderRef: personnelId, shares: 100, sharePercentage: 50 },
  });
  logResult('添加股东条目', sh.status === 201, `status=${sh.status}`);

  const shList = await request('GET', `/companies/${companyId}/shareholder-entries`, { token });
  logResult('股东条目列表', shList.status === 200, `status=${shList.status}`);

  const de = await request('POST', `/companies/${companyId}/director-entries`, {
    token, body: { personnelRef: personnelId, position: 'Director', appointmentDate: '2024-01-01' },
  });
  logResult('添加董事条目', de.status === 201, `status=${de.status}`);

  const deList = await request('GET', `/companies/${companyId}/director-entries`, { token });
  logResult('董事条目列表', deList.status === 200, `status=${deList.status}`);

  // ── 6. ROM / ROD PDF 生成 ────────────────────────────────
  console.log('\n【ROM / ROD PDF】');
  const rom = await request('GET', `/companies/${companyId}/rom`, { token, isBuffer: true });
  logResult('生成 ROM PDF', rom.status === 200 && rom.body.length > 100, `status=${rom.status}, bytes=${rom.body.length || 0}`);

  const rod = await request('GET', `/companies/${companyId}/rod`, { token, isBuffer: true });
  logResult('生成 ROD PDF', rod.status === 200 && rod.body.length > 100, `status=${rod.status}, bytes=${rod.body.length || 0}`);

  // ── 7. Documents ─────────────────────────────────────────
  console.log('\n【Documents】');
  const docCreate = await request('POST', '/documents', {
    token, body: { title: 'Memo', category: 'other', type: 'other' },
  });
  logResult('创建文档', docCreate.status === 201, `status=${docCreate.status}`);
  const docId = extractId(docCreate.body);
  const docList = await request('GET', '/documents', { token });
  logResult('文档列表', docList.status === 200, `status=${docList.status}`);

  // ── 8. Meetings ──────────────────────────────────────────
  console.log('\n【Meetings】');
  const mCreate = await request('POST', '/meetings', {
    token, body: { title: 'Board Meeting', date: '2024-06-01', type: 'board', status: 'scheduled', company: companyId },
  });
  logResult('创建会议', mCreate.status === 201, `status=${mCreate.status}`);
  const mList = await request('GET', '/meetings', { token });
  logResult('会议列表', mList.status === 200, `status=${mList.status}`);

  // ── 9. Tasks ─────────────────────────────────────────────
  console.log('\n【Tasks】');
  const tCreate = await request('POST', '/tasks', {
    token, body: { title: 'Follow up', status: 'pending', dueDate: '2024-12-31', type: 'filing' },
  });
  logResult('创建任务', tCreate.status === 201, `status=${tCreate.status}`);
  const tList = await request('GET', '/tasks', { token });
  logResult('任务列表', tList.status === 200, `status=${tList.status}`);

  // ── 10. Compliance Rules (预设 17 条) ────────────────────
  console.log('\n【Compliance Rules】');
  const crList = await request('GET', '/compliance-rules', { token });
  const crArr = crList.body.rules || crList.body.data || (Array.isArray(crList.body) ? crList.body : []);
  logResult('合规规则列表(含预设)', crList.status === 200 && crArr.length >= 1, `status=${crList.status}, count=${crArr.length}`);
  const ruleId = crArr[0]?._id || crArr[0]?.data?._id;

  // ── 11. Compliance Reminders ─────────────────────────────
  console.log('\n【Compliance Reminders】');
  const remCreate = await request('POST', '/compliance-reminders', {
    token, body: { title: 'Annual Return', dueDate: '2024-12-31', status: '待办', company: companyId, rule: ruleId },
  });
  logResult('创建合规提醒', remCreate.status === 201, `status=${remCreate.status}`);
  const remList = await request('GET', '/compliance-reminders', { token });
  logResult('合规提醒列表', remList.status === 200, `status=${remList.status}`);

  // ── 12. Templates ────────────────────────────────────────
  console.log('\n【Templates】');
  const tmplList = await request('GET', '/templates', { token });
  logResult('模板列表', tmplList.status === 200, `status=${tmplList.status}`);

  // ── 13. Sign Tasks ───────────────────────────────────────
  console.log('\n【Sign Tasks】');
  const stCreate = await request('POST', '/sign-tasks', {
    token, body: { title: 'Sign M&A', document: docId, signers: [{ name: 'Signer A', email: 'a@test.com' }] },
  });
  logResult('创建签署任务', stCreate.status === 201, `status=${stCreate.status}`);
  const stList = await request('GET', '/sign-tasks', { token });
  logResult('签署任务列表', stList.status === 200, `status=${stList.status}`);

  // ── 清理 ─────────────────────────────────────────────────
  console.log('\n🧹 关闭服务与 MongoDB...');
  serverProc.kill();
  await mongo.stop();

  console.log('\n══════════════════════════════════════════════');
  console.log(`  通过: ${passed}   失败: ${failed}`);
  console.log('══════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\n失败项:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  } else {
    console.log('🎉 全部端到端回归测试通过！');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('❌ 测试运行异常:', e);
  process.exit(1);
});
