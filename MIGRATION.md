# 📦 Claw 整体搬迁指南（MIGRATION）

> 目的：把**整个 CSMS 项目**从一个机器 / 目录 / WorkBuddy workspace 完整搬到另一个，**不丢代码、不丢密钥、不丢历史、不丢记忆**。

---

## ⚠️ 最大陷阱：`.workbuddy/` 被 gitignore 忽略

`.gitignore` 第 91 行忽略 `.workbuddy/`，其中包含：

- **`.workbuddy/memory/SECRETS.md`** —— 生产密钥（GitHub PAT / MONGODB_URI / R2_* / VITE_API_BASE），**git 完全不跟踪**
- `.workbuddy/memory/*.md` —— 项目工作记忆（每日日志 + 长期笔记）
- `.workbuddy/skills/` —— 自定义技能
- `.workbuddy/mcp.json` —— MCP 连接器配置

**结论：只靠 `git clone` 或只复制源码目录，密钥和记忆会全部丢失，且无法从版本库恢复（沙箱无 git 可执行文件，删错不能回滚）。**

---

## ✅ 推荐方式：整目录 `cp -r`（带隐藏文件）

最稳妥——一次性把整个项目（含 `.git`、`.workbuddy`、配置）整体复制：

```bash
# Windows (PowerShell)
Copy-Item -Path "C:\Users\Vincent\WorkBuddy\Claw" -Destination "D:\新位置\Claw" -Recurse -Force

# macOS / Linux
cp -R /path/to/Claw /new/path/Claw
```

`cp -R` / `Copy-Item -Recurse` 默认包含以点开头的隐藏目录（`.git`、`.workbuddy`），**不会**漏掉密钥与记忆。

---

## 📋 必须一起搬的文件清单

| 路径 | 为什么必须带 | 风险 |
|------|------------|------|
| `.git/` | 完整提交历史、分支、remote | 丢历史，无法追溯 |
| `.workbuddy/memory/SECRETS.md` | 生产密钥（GitHub PAT 等） | **丢密钥，部署/推送瘫痪** |
| `.workbuddy/memory/*.md` | 项目记忆（日志 + 约定） | 丢上下文 |
| `.workbuddy/skills/` | 自定义技能 | 功能缺失 |
| `.workbuddy/mcp.json` | MCP 连接器 | 集成失效 |
| `.env.example` | 环境变量模板 | 新环境不知要配什么 |
| `scripts/` | 迁移脚本 + 推送脚本 | 无法迁移/部署 |
| `client/` `server/` `package.json` | 源码 | —— |
| `render.yaml` `docker-compose.yml` `Dockerfile` `nginx.conf` | 部署配置 | 部署失败 |

---

## 🚫 不需要搬（目标机器重新生成）

| 路径 | 原因 |
|------|------|
| `node_modules/` `client/node_modules/` | `npm install` 重装 |
| `dist/` `client/dist/` `build/` | `npm run build` 重新构建 |
| `uploads/*`（内容） | 生产文件在 R2；本地上传仅演示 |
| `*.log` `logs/` `build*.log` 等 | 临时日志 |
| `.mongo-data/` `.mongo-test/` | 本地 MongoDB 数据，重新起 |
| `deliverables/` 下的 `.docx` 模板 | 可选（非运行必需，可按需带） |

> 若用 `cp -R` 整目录复制，这些也会一并过来，无害；首次运行 `npm install` 与 `npm run build` 即可。

---

## 🔧 搬完后必须做的 5 步

1. **安装依赖**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 填入 MONGODB_URI / R2_* / VITE_API_BASE 等
   ```
   > 若 `.workbuddy/memory/SECRETS.md` 已随 `.workbuddy` 一起搬来，密钥已在新位置，无需重新申请。

3. **（关键）确认 SECRETS.md 已到位**
   ```bash
   cat .workbuddy/memory/SECRETS.md
   ```
   - 若文件为空 / 丢失：**必须重新生成 GitHub fine-grained PAT**（Repository access 选 `caihelam-source/CSMS`，Permissions → Contents = Read and write），写入 `SECRETS.md`。PAT 有有效期（约 30 天），过期需重生成。
   - ⚠️ PAT 不应进入任何会被 git 跟踪的文件。

4. **启动验证**
   ```bash
   npm run dev          # 后端 :5000 + 前端 :5173（Mock 模式）
   # 或只起前端看效果：
   cd client && npm run dev
   ```

5. **（生产）执行后端数据迁移 `--apply`**（若从 v5.0 之前升级）
   ```bash
   # 先 DRY RUN 确认无破坏
   node scripts/migrate-v5.js
   # 备份 Atlas 库 + DBA 复核后
   node scripts/migrate-v5.js --apply
   ```
   > `--apply` 仅拦库名含 `prod|production|live|主` 的情况；dry-run 对任意 URI 安全。

---

## 🐛 常见搬运事故

| 事故 | 现象 | 修复 |
|------|------|------|
| 只 `git clone` | 新环境无 `.workbuddy/`，推送报 401 | 手动把旧 `.workbuddy/` 复制过去，或重生成 PAT |
| 漏 `.env` | 后端连不上 Atlas | 从 `.env.example` 重建 `.env` |
| 漏 `node_modules` 又没 install | 启动报 module not found | `npm install` + `cd client && npm install` |
| 改 `tailwind.config.js` 后没重启 dev | 预览白屏 | `taskkill` vite 进程后重起 `node node_modules/vite/bin/vite.js --host` |
| `vite build` 报 safe-delete ETIMEDOUT | 清 dist 被拦截 | 先 `node -e "require('fs').rmSync('dist',{recursive:true,force:true})"` 再 build |

---

## ✅ 搬迁自检清单

- [ ] `.git/` 已带（历史完整）
- [ ] `.workbuddy/memory/SECRETS.md` 存在且含有效 PAT
- [ ] `.workbuddy/memory/*.md` 已带
- [ ] `.env.example` 已带
- [ ] `npm install` 成功（根 + client）
- [ ] `npm run dev` 起得来
- [ ] 如需生产：`migrate-v5.js --apply` 已执行

---

<div align="center">
<strong>整目录 cp -R，隐藏文件一起走，密钥记忆不丢手。</strong>
</div>
