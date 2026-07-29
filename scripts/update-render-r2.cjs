#!/usr/bin/env node
/**
 * 把 Cloudflare R2 的 5 个环境变量批量写入 Render claw-api 服务，并触发重新部署。
 * 用法: RENDER_API_KEY=rnd_xxx node scripts/update-render-r2.cjs
 * 凭证从 .workbuddy/memory/SECRETS.md 解析，不落明文到日志。
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const KEY = process.env.RENDER_API_KEY;

if (!KEY) {
  console.error('❌ 缺少 RENDER_API_KEY 环境变量。\n   用法: RENDER_API_KEY=rnd_xxx node scripts/update-render-r2.cjs');
  process.exit(1);
}

const secretsPath = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md');
if (!fs.existsSync(secretsPath)) {
  console.error('❌ 找不到', secretsPath);
  process.exit(1);
}
const txt = fs.readFileSync(secretsPath, 'utf8');
function grab(key) {
  const re = new RegExp('\\*\\*' + key + '\\*\\*:?\\s*`?([^`\\n]+)`?');
  const m = txt.match(re);
  return m ? m[1].trim() : null;
}

const R2_VARS = {
  R2_ENDPOINT: grab('R2_ENDPOINT'),
  R2_ACCESS_KEY_ID: grab('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: grab('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: grab('R2_BUCKET_NAME'),
  R2_PUBLIC_URL: grab('R2_PUBLIC_URL'),
};
const missing = Object.entries(R2_VARS).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('❌ SECRETS.md 缺少 R2 变量:', missing.join(', '));
  process.exit(1);
}

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!res.ok) {
    console.error('❌ API', res.status, p, JSON.stringify(json).slice(0, 400));
    process.exit(1);
  }
  return json;
}

(async () => {
  const list = await api('/services?limit=100');
  const arr = Array.isArray(list) ? list : (list.data || []);
  const wrapper = arr.find((s) => s.service && s.service.name === 'claw-api')
              || arr.find((s) => s.name === 'claw-api');
  if (!wrapper) {
    console.error('❌ 未找到 claw-api 服务。确认 API key 绑定了正确账号。');
    process.exit(1);
  }
  const svc = wrapper.service || wrapper;
  const svcId = svc.id;
  console.log('✓ 找到服务:', svc.name, '(' + svcId + ')');

  for (const [key, value] of Object.entries(R2_VARS)) {
    await api(`/services/${svcId}/env-vars/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
    console.log('✓ PUT', key);
  }

  // 改 env var 后必须显式触发重新部署（Render 不会自动重部署）
  const dep = await api(`/services/${svcId}/deploys`, { method: 'POST' });
  console.log('✓ 已触发重新部署:', (dep.id || JSON.stringify(dep).slice(0, 60)));
  console.log('  部署完成后验证：上传一个文件再预览/下载，或直接 curl 测试。');
})();
