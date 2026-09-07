#!/usr/bin/env node
/**
 * deploy-claw-web.cjs — 触发 claw-web (Render static) 的一次性部署
 *
 * 背景：旧 GitHub→Render 自动部署 webhook 已失效（API key 被 revoke, 401），
 * push 不再自动 build。改用 Render 的 "Deploy Hook" 机制：POST 该 URL 即触发
 * 一次部署（拉取 GitHub main 最新 commit 并重建发布 ./dist）。
 *
 * Hook URL 来源（优先级）：
 *   1. 环境变量 RENDER_DEPLOY_HOOK
 *   2. 项目 gitignored 机密文件 .workbuddy/memory/SECRETS.md 中的
 *      "https://api.render.com/deploy/..." 行
 *
 * 用法：
 *   node scripts/deploy-claw-web.cjs
 *   RENDER_DEPLOY_HOOK="https://api.render.com/deploy/srv-XXX?key=YYY" node scripts/deploy-claw-web.cjs
 *
 * 退出码：0=已触发(202) 1=请求失败 2=找不到 Hook URL
 */
const fs = require('fs')
const path = require('path')

function resolveHook() {
  if (process.env.RENDER_DEPLOY_HOOK) return process.env.RENDER_DEPLOY_HOOK.trim()
  const secPath = path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md')
  if (fs.existsSync(secPath)) {
    const txt = fs.readFileSync(secPath, 'utf8')
    const m = txt.match(/https:\/\/api\.render\.com\/deploy\/[^\s)`]+/)
    // 跳过文档示例占位（srv-XXXX / key=YYYY / <HOOK_URL> 等），只认真实 Hook
    if (m && !/XXXX|YYYY|<placeholder>|<HOOK_URL>/.test(m[0])) return m[0]
  }
  return null
}

const hook = resolveHook()
if (!hook) {
  console.error('[deploy] 未找到 Render Deploy Hook URL。')
  console.error('[deploy] 请在 Render Dashboard → claw-web → Settings → Deploy Hook 生成，')
  console.error('[deploy] 把整条 URL 发给 AI 写入 .workbuddy/memory/SECRETS.md，或设 RENDER_DEPLOY_HOOK 环境变量。')
  process.exit(2)
}

console.log('[deploy] 触发 Deploy Hook:', hook.replace(/\?key=.*/, '?key=***'))
fetch(hook, { method: 'POST' })
  .then((r) => {
    if (r.ok || r.status === 202) {
      console.log(`[deploy] ✅ 已触发部署 (HTTP ${r.status})。Render 约 1-2 分钟重建，完成后访问 https://claw-web.onrender.com`)
      process.exit(0)
    }
    console.error(`[deploy] ⚠️ Hook 返回非成功状态 HTTP ${r.status}`)
    process.exit(1)
  })
  .catch((e) => {
    console.error('[deploy] ❌ 触发失败:', e.message)
    process.exit(1)
  })
