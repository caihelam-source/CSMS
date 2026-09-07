# Claw 前端部署指南（claw-web / Render static）

> 适用：所有落在 `client/` 的前端改动（底部 Tab / 左滑操作 / 动效层 / 移动上传等）。
> 后端（`claw-api`）改动不在此文档范围。

## 当前事实（2026-09-07 实证）
- 本地 `main` = `github/main` 已同步（7 处前端 commit 全部已 push）。
- **旧 GitHub→Render 自动部署 webhook 已失效**（API key 被 revoke，401）。因此 **push 不会自动 build**，线上仍是旧构建。
- 证据：线上 `claw-web` 的 CSS hash ≠ 本地刚构建的 dist CSS hash（Render 域名可达，可抓取比对）。
- 结论：要做到"改完即上线"，必须主动触发一次部署。

## 一次性解决方案：Render Deploy Hook
Deploy Hook 是独立于 webhook 的机制——POST 它一次即触发部署，不受旧 webhook 死活影响。

### 第 1 步：生成 Hook（你做一次，永久有效）
1. 打开 https://dashboard.render.com
2. 进入服务 **`claw-web`**（static site，非 claw-api）
3. 左侧 **Settings** → 滚动到底部 **Deploy Hook** 卡片
4. 点 **Generate Deploy Hook**，复制整条 URL（形如 `https://api.render.com/deploy/srv-XXXX?key=YYYY`）

### 第 2 步：把 URL 交给 AI
- 把整条 URL 发给我，我会写入 `.workbuddy/memory/SECRETS.md`（已被 gitignore，不会进 GitHub）。
- 之后每次部署我只需执行：`node scripts/deploy-claw-web.cjs`

### 第 3 步：触发 + 验证
- AI 执行脚本 POST Hook → Render 拉取 `main` 最新 commit → 重建发布 `./dist`（约 1–2 分钟）。
- 验证：比对线上 `claw-web` 的 CSS hash 是否等于本地 `client/dist/index.html` 中的 hash。

## 备选：Manual Deploy（不生成 Hook 也能用）
Render Dashboard → `claw-web` → **Manual Deploy** → 选分支 `main` → 确认。
render.yaml 中 claw-web 构建命令：
```
cd .. && npm install && cd client && rm -rf dist node_modules/.vite && npm install && npm run build
staticPublishPath: ./dist
```

## 本地构建门禁（提交前自检）
```bash
cd client && CODEBUDDY_SAFE_DELETE_ENABLED=0 node node_modules/vite/bin/vite.js build
```
须 0 error（仅 chunk 体积提示属正常）。
