# CHANGELOG · 2026-07-19 同步包

本包随 `SYNC-2026-07-19.md` 一同生成，用于 **B → A 电脑无缝接续**。

## 本包包含的文档（deliverables/gstack/）
- `preview-dashboard-csms-2026-07-18.html` — Dashboard 风格预览 **v5.1**（全尺寸流体自适应，单文件零依赖）★ 看效果用
- `impl-handoff-dashboard-2026-07-18.md` — 给代码团队的实现移交说明书（9 章 + 10 条验收标准）★ **Wave 0 开工依据**
- `design-spec-csms-lumina-v2-2026-07-18.md` — Dashboard 设计规范 v2（基于真实源码的一屏原则 L0/L1/L2）
- `design-spec-csms-lumina-2026-07-18.md` — 设计规范 v1
- `design-unify-csms-lumina-2026-07-18.md` — 统一改造可行性评估
- `design-review-csms-2026-07-18.md` — 设计审查

## 本包包含的源码改动
- **无 `client/` 业务代码改动**（本轮仅设计预览 + 文档，未动真实代码）。

## 还包含
- 项目全部每日记忆日志（`.workbuddy/memory/*.md`，排除 SECRETS）+ 项目 `MEMORY.md`
- 用户级记忆 `~/.workbuddy/MEMORY.md`（跨机同步习惯等）

## 同步方法（A 电脑）
1. 将 `SYNC-2026-07-19.md` 发到 A 电脑 **CSMS 项目聊天框**（单文件即可，文件夹发不了）。
2. 说一句：**"请按同步包还原"**。
3. A 的 WorkBuddy 自动把每个 `§§F|<项目相对路径>|§§ … §§/F§§` 块写回对应路径、`§§U|§§ … §§/U§§` 块写回用户级记忆。
4. **凭证 `SECRETS.md` 不随包传输** —— A 电脑需各自维护（生产 MONGODB_URI / R2_* / VITE_API_BASE / GitHub PAT）。
