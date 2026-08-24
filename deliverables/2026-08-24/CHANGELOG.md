# CHANGELOG · 2026-08-24

## 本次交付物
- **任务多参与者增量（CSMS）**：T01–T09 + Q5(响应式) + Q6(completer 审计) 全覆盖。
- 已提交本地 `7ebec58`（9 文件、+999 行），**未 push** —— 因本机（E 盘环境）网络不通 GitHub（`fetch` 报 `Connection was reset`，`push` 挂起无响应）。
- 设计文档（PRD 增量 + 架构增量）位于 `deliverables/software-csms-task-participants/`，**已随提交 `7ebec58` 入库**。

## 改动的代码文件（7 个，均在提交 7ebec58 中）
- 修改：`client/src/components/TaskForm.jsx`、`client/src/pages/TaskDetail.jsx`、`client/src/pages/Tasks.jsx`、`server/models/Task.js`、`server/routes/tasks.js`
- 新增：`client/src/components/UserMultiSelect.jsx`、`server/tests/tasks.participants.test.js`

## 跨机同步方法（本机网络不通 GitHub，需另一台能联网的机器 push）
### ① git bundle —— 传提交，用于 push 部署（主用）
文件：`deliverables/2026-08-24/task-participants-2026-08-24.bundle`（25K，已 `git bundle verify` 通过）

在能联网的机器上（需已有 CSMS 仓库，且与 `caihelam-source/CSMS` 同源）：
```bash
# 把 bundle 拷到该机 CSMS 仓库目录后：
git fetch task-participants-2026-08-24.bundle HEAD
# 或 git pull task-participants-2026-08-24.bundle HEAD
git push github HEAD:main        # 落地即触发 Render 自动部署 claw-api + claw-web
```
- bundle 基准 = 缓存的 `github/main` `b960c87`，仅含 1 个提交 `7ebec58`。
- 若另一台机器 `github/main` 与 `b960c87` 不一致（有人推过）：先 `git fetch github main` 对齐，再 fetch bundle。

### ② SYNC 同步包 —— 传记忆 + 当日文档上下文
文件：`deliverables/2026-08-24/SYNC-2026-08-24.md`

把此 `.md` 发到另一台电脑的项目聊天框，说「请按同步包还原」，对方 WorkBuddy 按分隔符写回：
- `§§F|` 项目内文件（`.workbuddy/memory/2026-08-24.md`、`.workbuddy/memory/MEMORY.md` 等）
- `§§U|` 用户级记忆 `~/.workbuddy/MEMORY.md`

⚠️ 同步包**不含源码**（源码走 bundle）、**不含 SECRETS.md**。还原会覆盖目标机的同名记忆文件。

## 质量门禁结果（已验证）
- 后端集成测试：**13/13 通过**（修正 1 个测试断言后）
- 前端 ESLint：**0 error**
- 前端 vite build：**0 报错**（仅 chunk >500kB 体积警告，非错误）

## 待办（联网机器上执行）
1. `git push github HEAD:main` —— `render.yaml` 未设 `autoDeploy:false`，**push 即触发 Render 自动部署** claw-api / claw-web，无灰度。
2. 若 `push` 报 `401/403`：GitHub PAT 约 2026-08-15 过期，需重生成 classic token（`repo` 权限），更新 git credential 或 `.workbuddy/memory/SECRETS.md` 后再推。
3. 提交作者身份：`caihelam-source <caihe.lam@gmail.com>`（本仓库统一用此身份，勿用 `Vincent <vincent@example.com>`）。
