// seed-admin-local.cjs — 本机一键创建 Claw 生产库管理员
// 用途：从 .workbuddy/memory/SECRETS.md 自动抽取 Atlas 生产 MONGODB_URI（不落明文），
//       再调用 server/scripts/seed-admin.js 创建/更新管理员。
// 注意：必须在能直连 MongoDB Atlas 的网络环境运行（沙箱 egress 拦截 mongodb.net，勿在沙箱跑）。
//
// 用法（在仓库根目录执行）：
//   node scripts/seed-admin-local.cjs --email vincentlin@example.com --name "Vincent Lin" --password "你的强密码"
//   # 覆盖已存在管理员：加 --force
//   # 不传参则用默认 admin@example.com / admin123
//
// 依赖：仓库根的 .workbuddy/memory/SECRETS.md（gitignored，含 Atlas 生产 URI）

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SECRETS = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');

function extractAtlasUri() {
  if (!fs.existsSync(SECRETS)) {
    console.error('❌ 找不到', SECRETS, '（需本机有 SECRETS.md）');
    process.exit(1);
  }
  const text = fs.readFileSync(SECRETS, 'utf8');
  const lines = text.split('\n');
  // 优先匹配标注 production/atlas/prod 的 mongodb+srv 行
  let hit = lines.find((l) => /mongodb\+srv/.test(l) && /production|atlas|prod/i.test(l));
  if (!hit) hit = lines.find((l) => /mongodb\+srv/.test(l));
  if (!hit) {
    console.error('❌ SECRETS.md 中未找到 mongodb+srv 连接串');
    process.exit(1);
  }
  const m = hit.match(/mongodb\+srv:[^\s"']+/);
  if (!m) {
    console.error('❌ 无法从行中提取 MONGODB_URI:', hit.slice(0, 40));
    process.exit(1);
  }
  return m[0];
}

function parseArgs(argv) {
  const out = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') out.force = true;
    else if (a === '--email') out.email = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--password') out.password = argv[++i];
  }
  return out;
}

const uri = extractAtlasUri();
const args = parseArgs(process.argv.slice(2));

const env = {
  ...process.env,
  MONGODB_URI: uri,
  ADMIN_EMAIL: args.email || 'admin@example.com',
  ADMIN_NAME: args.name || 'Administrator',
  ADMIN_PASSWORD: args.password || 'admin123',
};
if (args.force) env.ADMIN_FORCE = 'true';

console.log('→ 使用 Atlas 生产 URI（已隐藏密码）');
console.log(`→ 管理员: ${env.ADMIN_EMAIL} / ${env.ADMIN_NAME}`);

const res = spawnSync(
  process.execPath,
  [path.join(ROOT, 'server', 'scripts', 'seed-admin.js')],
  { stdio: 'inherit', env }
);
process.exit(res.status ?? 1);
