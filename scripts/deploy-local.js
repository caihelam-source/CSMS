#!/usr/bin/env node
/**
 * scripts/deploy-local.js — 本地一键部署（开发 / 演示用，非生产）
 *
 * 流程（严格遵循红线：先迁移旧 HTML，后 /initialize 写 9 预设）：
 *   1. 确保 MongoDB 在 27017（未运行则 docker run claw-mongo；已运行则跳过）
 *   2. seed-admin        创建/复用管理员账号（默认 admin@example.com / admin123）
 *   3. 迁移旧 HTML        migrateHtmlTemplates.cjs --dry-run 核对 → 真跑写库
 *   4. 启动后端 API       node server/index.js（PORT 默认 5000）
 *   5. 登录 admin 拿 token POST /api/auth/login
 *   6. 初始化 9 预设      POST /api/templates/initialize（含可编辑 archiveNote）
 *   7. 完成；--with-client 可同时起前端
 *
 * 用法：
 *   node scripts/deploy-local.js [--skip-mongo] [--skip-migrate] [--with-client]
 *                               [--port 5000] [--client-port 5173]
 *   环境变量（可选）：MONGODB_URI / JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD
 *
 * 说明：
 *   - 默认 MONGODB_URI=mongodb://localhost:27017/company-secretary
 *   - 若本机已有 MongoDB 在 27017，加 --skip-mongo 跳过 docker
 *   - 生产部署走 Render + MongoDB Atlas，见 docs/ 部署文档
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const getOpt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`用法: node scripts/deploy-local.js [选项]
选项:
  --skip-mongo      假定 MongoDB 已在 27017 运行，跳过 docker 启动
  --skip-migrate    跳过旧 HTML 模板迁移（仅初始化 9 预设）
  --with-client     初始化完成后同时启动前端（端口 --client-port）
  --port <n>        后端端口（默认 5000）
  --client-port <n> 前端端口（默认 5173，仅 --with-client 时生效）
  -h, --help        显示本帮助
环境变量: MONGODB_URI / JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD`);
  process.exit(0);
}

const SKIP_MONGO = hasFlag('--skip-mongo');
const SKIP_MIGRATE = hasFlag('--skip-migrate');
const WITH_CLIENT = hasFlag('--with-client');
const PORT = String(getOpt('--port', '5000'));
const FRONTEND_PORT = String(getOpt('--client-port', '5173'));
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/company-secretary';
const JWT_SECRET = process.env.JWT_SECRET || 'claw-local-dev-jwt-secret';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const step = (n, s) => console.log(`\n\x1b[36m[${n}/7]\x1b[0m ${s}`);
const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const warn = (s) => console.log(`  \x1b[33m!\x1b[0m ${s}`);
const fail = (s) => { console.error(`  \x1b[31m✗\x1b[0m ${s}`); process.exit(1); };

function waitForTcp(host, port, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      const sock = net.connect(Number(port), host);
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tryOnce, 1000);
      });
    };
    tryOnce();
  });
}

function waitForHttp(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      fetch(url)
        .then((r) => (r.ok || r.status < 500 ? resolve(r) : retry()))
        .catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tryOnce, 1000);
      }
    };
    tryOnce();
  });
}

function run(cmd, cmdArgs, env) {
  console.log(`  $ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (r.error) fail(`${cmd} 无法启动: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} 退出码 ${r.status}`);
}

async function main() {
  // 1. MongoDB
  step('1/7', '准备 MongoDB');
  let mongoUp = false;
  try { await waitForTcp('127.0.0.1', 27017, 2000); mongoUp = true; } catch { mongoUp = false; }

  if (mongoUp) {
    ok('MongoDB 已在 27017 运行，跳过启动');
  } else if (SKIP_MONGO) {
    fail('MongoDB 未运行，但指定了 --skip-mongo。请先启动 MongoDB 或去掉该参数。');
  } else {
    const docker = spawnSync('docker', ['--version'], { stdio: 'ignore' });
    if (docker.error) fail('未检测到 docker，请安装 Docker Desktop 后重试，或手动起 MongoDB 并加 --skip-mongo.');
    const vol = path.resolve(ROOT, '.mongo-data').replace(/\\/g, '/');
    spawnSync('docker', ['rm', '-f', 'claw-mongo'], { stdio: 'ignore' });
    const runR = spawnSync('docker', ['run', '-d', '--name', 'claw-mongo', '-p', '27017:27017', '-v', `${vol}:/data/db`, 'mongo'], { stdio: 'inherit' });
    if (runR.status !== 0) fail('docker run mongo 失败（挂载路径有误？可手动起 MongoDB 后加 --skip-mongo）');
    console.log('  等待 MongoDB 就绪...');
    await waitForTcp('127.0.0.1', 27017, 120000);
    ok('MongoDB 已启动（数据目录 .mongo-data）');
  }

  // 2. seed-admin
  step('2/7', '创建管理员账号');
  run('node', ['server/scripts/seed-admin.js'], { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD });
  ok(`管理员就绪: ${ADMIN_EMAIL}`);

  // 3. 迁移旧 HTML（红线：先迁移，后 /initialize）
  step('3/7', '迁移旧 HTML 模板');
  if (SKIP_MIGRATE) {
    warn('已跳过 --skip-migrate（仅初始化 9 预设，旧 HTML 不转换）');
  } else {
    console.log('  --- dry-run 核对（只出台账，不写库）---');
    run('node', ['scripts/migrateHtmlTemplates.cjs', '--dry-run'], { MONGODB_URI });
    console.log('  --- 真实迁移写库 ---');
    run('node', ['scripts/migrateHtmlTemplates.cjs'], { MONGODB_URI });
    ok('旧 HTML 迁移完成');
  }

  // 4. 启动后端
  step('4/7', '启动后端 API');
  const serverEnv = {
    ...process.env,
    PORT,
    MONGODB_URI,
    JWT_SECRET,
    CLIENT_URL: `http://localhost:${FRONTEND_PORT}`,
  };
  const server = spawn('node', ['server/index.js'], { cwd: ROOT, env: serverEnv, stdio: 'inherit' });
  server.on('exit', (code) => { if (code && code !== 0) warn(`后端进程退出 code=${code}`); });
  console.log(`  等待 http://localhost:${PORT}/api/health ...`);
  await waitForHttp(`http://localhost:${PORT}/api/health`, 60000);
  ok(`后端已就绪 (http://localhost:${PORT})`);

  // 5. 登录拿 token
  step('5/7', '登录 admin 拿 token');
  const loginRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginJson = await loginRes.json();
  if (!loginJson.success || !loginJson.token) fail(`登录失败: ${JSON.stringify(loginJson)}`);
  const token = loginJson.token;
  ok(`已获取 admin token（角色 ${loginJson.user && loginJson.user.role}）`);

  // 6. 初始化 9 预设
  step('6/7', '初始化 9 个预设模板（含可编辑 archiveNote）');
  const initRes = await fetch(`http://localhost:${PORT}/api/templates/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const initJson = await initRes.json();
  if (!initJson.success) fail(`/initialize 失败: ${JSON.stringify(initJson)}`);
  ok(`预设写入完成: deleted=${initJson.deleted}, upserted=${initJson.upserted}`);

  // 7. 完成
  step('7/7', '完成');
  console.log(`\n\x1b[32m✅ 本地部署完成\x1b[0m`);
  console.log(`   后端:   http://localhost:${PORT}`);
  console.log(`   登录:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  let client = null;
  if (WITH_CLIENT) {
    console.log(`\n   启动前端（端口 ${FRONTEND_PORT}，连真实后端 http://localhost:${PORT}）...`);
    client = spawn('npm', ['run', 'client:dev'], {
      cwd: ROOT,
      env: { ...process.env, VITE_API_URL: `http://localhost:${PORT}` },
      stdio: 'inherit',
    });
    console.log(`   前端:   http://localhost:${FRONTEND_PORT}/templates`);
  } else {
    console.log(`\n   前端请另开终端运行: \x1b[36mnpm run client:dev\x1b[0m`);
    console.log(`   访问:   http://localhost:${FRONTEND_PORT}/templates`);
  }

  console.log('\n   按 Ctrl+C 停止（会一并结束后端' + (client ? ' / 前端' : '') + '）。\n');

  const cleanup = () => {
    try { server.kill(); } catch (e) { void e; }
    if (client) try { client.kill(); } catch (e) { void e; }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  setInterval(() => {}, 1 << 30); // 保持前台运行
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
