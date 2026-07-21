# CHANGELOG - 2026-07-20

## 会议通知 / 纪要 Tab 功能完善与 bug 修复（MeetingDetail.jsx）

用户反馈：会议通知和会议纪要两个 Tab 功能按钮不一致，编辑一次后预览消失。

### 修复项
| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 编辑保存后 HTML 预览消失 | `saveNoticeEdit` / `saveMinutesEdit` 写回时设 `html: undefined` 清空了模板 | 改为保留原 `html` 字段，仅更新 `text` |
| 2 | 纪要 Tab 缺「重新生成」 | 通知有、纪要漏 | 纪要按钮栏补齐「重新生成」（与通知对称） |
| 3 | 两个 Tab 都缺「保存 Word」 | 未实现 | 新增 `downloadWord()`：HTML-Word 兼容 `.doc` 下载（无需额外依赖） |
| 4 | 编辑模式无预览入口 | 预览按钮条件 `!editingNotice && html` 过严 | 预览在查看态常驻；编辑态用「完成编辑」退出后预览 |

### 修复后两个 Tab 按钮组（完全一致）
`复制文案` · `编辑 / 完成编辑` · `重新生成` · `保存Word` · `预览HTML`

### 验证
- ESLint 0 error
- vite build：本次修复代码已写入，构建门禁待跑（被用户打断，需 `rm -rf dist` 后重 build）

---

## 项目文档同步更新（为整体搬迁做准备）
- `README.md` → 重写到 v5.2（移除 Directors 独立页/模型，反映统一人员中枢 + 会议闭环 + 双来源签署 + 暗色 + 移动端 + 搜索）
- `PROJECT_ROADMAP.md` → 更新到 v5.2（v1-v5 完成态 + M1/M2/M3/M4 规划）
- `TECH_DESIGN.md` → 追加 §8 v5.2 增量章节
- `DEPLOY-FULLSTACK.md` → 移除 CNB，加 `push-no-git.cjs` 说明
- `package.json` → version 2.0.0 → 5.2.0
- **新增 `MIGRATION.md`** → 整体搬迁指南（关键：`.workbuddy/` 被 gitignore，密钥/记忆需随目录 `cp -R` 带走，不可只 `git clone`）

---

## 当前整体状态（2026-07-20）
- **v5.2 已交付**：会议闭环 + 文件管理 + 移动端 + 签署增强 + 会议 Tab 修复
- **待办（高优先）**：
  - 🔴 Atlas 活密码轮换（曾泄露风险）
  - 🔴 M1 后端迁移 `migrate-v5.js --apply`（legacy 数据待合并，需先备份库 + DBA 复核）
- **ESLint / vite build 门禁**：v5.2 四增量模块阶段 0 error；本次会议修复代码已写入待 build 验证
