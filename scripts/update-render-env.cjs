#!/usr/bin/env node
/**
 * 用 Atlas 新密码更新 Render 上 claw-api 的 MONGODB_URI 环境变量。
 *
 * 背景：render.yaml 中 MONGODB_URI 是 sync:false，Blueprint 不会从 git 同步，
 * 生产值只能由 Render 控制台或 Render API 设置。本脚本通过 Render REST API
 * 直接 PATCH claw-api 服务的 env-var，改完 Render 会自动重新部署。
 *
 * 用法：
 *   RENDER_API_KEY=rnd_xxxxxxxx node scripts/update-render-env.cjs
 *
 * 说明：
 *   - 新密码从 .workbuddy/memory/SECRETS.md 自动读取（已 gitignore，不会泄露），
 *     不在命令行/日志里明文出现。
 *   - 只更新 MONGODB_URI 一个 key，不动其他 env var。
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const KEY = process.env.RENDER_API_KEY;

if (!KEY) {
  console.error('❌ 缺少 RENDER_API_KEY 环境变量。\n   用法: RENDER_API_KEY=rnd_xxx node scripts/update-render-env.cjs');
  process.exit(1);
}

// 1. 从 SECRETS.md 提取 MONGODB_URI（隐藏密码后打印）
const secretsPath = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md');
if (!fs.existsSync(secretsPath)) {
  console.error('❌ 找不到', secretsPath);
  process.exit(1);
}
const txt = fs.readFileSync(secretsPath, 'utf8');
const m = txt.match(/mongodb\+srv:\/\/\S+/) || txt.match(/mongodb:\/\/\S+/);
if (!m) {
  console.error('❌ SECRETS.md 中未找到 MONGODB_URI');
  process.exit(1);
}
const uri = m[0].replace(/\s+/g, '');
const masked = uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
console.log('✓ 已从 SECRETS.md 读取 MONGODB_URI:', masked);

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    ...opts,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
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
  // 2. 找��� claw-api 服务（Render 返回结构为 [{ cursor, service: { id, name, ... } }]）
  const list = await api('/services?limit=100');
  const arr = Array.isArray(list) ? list : (list.data || []);
  const wrapper = arr.find((s) => s.service && s.service.name === 'claw-api')
              || arr.find((s) => s.name === 'claw-api');
  if (!wrapper) {
    console.error('❌ 未在当前 Render 账号下找到 claw-api 服务。确认 API key 是否正确、是否绑定了正确账号。');
    process.exit(1);
  }
  const svc = wrapper.service || wrapper;
  const svcId = svc.id;
  console.log('✓ 找到服务:', svc.name, '(' + svcId + ')');

  // 3. PUT 单个 env var：/services/{id}/env-vars/{key}（Render v1 正确端点，body 为单对象）
  await api(`/services/${svcId}/env-vars/MONGODB_URI`, {
    method: 'PUT',
    body: JSON.stringify({ key: 'MONGODB_URI', value: uri }),
  });

  console.log('✓ 已更新 claw-api 的 MONGODB_URI。Render 将自动重新部署。');
  console.log('  部署进度: https://dashboard.render.com/  →  claw-api  →  Events/Deployments');
  console.log('  恢复后建议验证: curl -s https://claw-api-5zq7.onrender.com/api/health');
})();
