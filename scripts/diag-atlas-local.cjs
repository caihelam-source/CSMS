// 本机 Atlas 连接诊断脚本
// 用法: node scripts/diag-atlas-local.cjs
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { execSync } = require('child_process');

const SECRETS = path.resolve(__dirname, '../.workbuddy/memory/SECRETS.md');

function maskUri(uri) {
  return uri.replace(/(mongodb\+srv:\/\/[^:]+:)[^@]+(@.*)/, '$1*****$2');
}

function parseAtlasUri(uri) {
  const m = uri.match(/mongodb\+srv:\/\/([^@]+)@(.+)/);
  if (!m) return null;
  const [user, pass] = m[1].split(':');
  const rest = m[2];
  const host = rest.split('/')[0];
  return { user, pass, host };
}

(async () => {
  console.log('=== Node / 系统时间 ===');
  console.log('Node version:', process.version);
  console.log('System time :', new Date().toISOString());
  try {
    const ntp = execSync('w32tm /stripchart /computer:time.windows.com /dataonly /samples:1', { encoding: 'utf8', timeout: 10000 });
    console.log('NTP offset sample:\n' + ntp.split('\n').slice(0, 5).join('\n'));
  } catch (e) {
    console.log('NTP check skipped:', e.message.split('\n')[0]);
  }

  console.log('\n=== Atlas URI（来自 SECRETS.md）===');
  let uri = '';
  if (!fs.existsSync(SECRETS)) {
    console.log('SECRETS.md 不存在:', SECRETS);
    process.exit(1);
  }
  const text = fs.readFileSync(SECRETS, 'utf8');
  const line = text.split('\n').find(l => /mongodb\+srv/.test(l));
  if (!line) {
    console.log('未找到 mongodb+srv URI');
    process.exit(1);
  }
  uri = (line.match(/mongodb\+srv:[^\s"']+/) || [''])[0];
  console.log('URI:', maskUri(uri));
  const parsed = parseAtlasUri(uri);
  if (!parsed) {
    console.log('URI 解析失败');
    process.exit(1);
  }
  console.log('User :', parsed.user);
  console.log('Pass len:', parsed.pass.length);
  console.log('Pass has special chars (@:/#[]&+?%):', /[@:/?#[\]&+%]/.test(parsed.pass));
  console.log('Host :', parsed.host);

  console.log('\n=== DNS SRV 解析 ===');
  const srvName = `_mongodb._tcp.${parsed.host}`;
  await new Promise((resolve) => {
    dns.resolveSrv(srvName, (err, records) => {
      if (err) {
        console.log('SRV resolve ERROR:', err.code, err.message);
      } else {
        console.log('SRV records:', records.map(r => `${r.name}:${r.port}`).join(', '));
      }
      resolve();
    });
    setTimeout(resolve, 5000);
  });

  console.log('\n=== MongoDB 连接尝试 ===');
  let mongoose;
  try {
    mongoose = require(path.resolve(__dirname, '../server/node_modules/mongoose'));
  } catch (e) {
    console.log('无法加载 server/node_modules/mongoose:', e.message.split('\n')[0]);
    console.log('尝试加载项目根 mongoose...');
    try {
      mongoose = require('mongoose');
    } catch (e2) {
      console.log('也无法加载全局 mongoose:', e2.message.split('\n')[0]);
      process.exit(1);
    }
  }
  console.log('Mongoose version:', mongoose.version);

  mongoose.set('strictQuery', false);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ 连接成功');
    await mongoose.connection.db.admin().ping();
    console.log('✅ ping 成功');
    await mongoose.disconnect();
  } catch (err) {
    console.log('❌ 连接失败:', err.message);
    if (err.reason) console.log('  reason:', err.reason);
  }

  console.log('\n=== 公网 IP（供 Atlas 白名单对照）===');
  try {
    const ip = await fetch('https://api.ipify.org?format=json', { timeout: 5000 }).then(r => r.json());
    console.log('Public IPv4:', ip.ip);
  } catch (e) {
    console.log('获取公网 IP 失败:', e.message);
  }
})();
