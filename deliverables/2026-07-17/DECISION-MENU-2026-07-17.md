# CSMS v5 决策清单（✅ 已全部拍板锁定）

> 交付总监：齐活林（Qi）｜ 日期：2026-07-17 ｜ **状态：8/8 决策已锁定，设计冻结**
> 拍板人：Vincent（vc）｜ 锁定时间：2026-07-17 23:19
> 来源：整合自《ARCH-ROADMAP-2026-07-17.md》(E1–E5) + 《ARCH-MOBILE-WECHAT-2026-07-17.md》(D-W1/2/3)
> 说明：共 **8 个决策**全部采用推荐档并由 vc 补充细节；另 5 个 UX 决策（D1–D5）此前已定稿。下方表格为**已锁定的选择 + 选型理由**，供实现与验收引用。

---

## 主题一：身份与权限地基（决定"真实后端能不能管"）

### ✅ E1. 种子管理员机制 → 选 A：CLI `seed-admin` + 零用户兜底
- 实现：`scripts/seed-admin.cjs` 读 `ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME` 生成 System Admin；库为空（无任意 User）时首登录兜底。
- 约束：兜底仅在 `NODE_ENV !== 'production'` 或显式 `--allow-first-register` 时生效，防公开环境被抢注。

### ✅ E2. 注册开放策略 → 选 A：关闭公开注册 + invite-token（vc 具象化为标准运营流程）
- 实现：`ALLOW_PUBLIC_REGISTER=false`；开放 `POST /api/v1/auth/invite`（仅 admin/GroupAdmin）下发绑定角色+权限的 token，经邮件发给指定人。
- vc 补充的标准流程（即 E2-A 完整展开）：**System Admin → 建多个 Group Admin → Group Admin 定向发邮件邀请 → 后台预置权限**。与 E5 的 5 角色 + 权限矩阵天然衔接。

### ✅ E5. RBAC 细粒度 → 选 A（rev2，vc 具象化为"权限矩阵 + 行级权限"）
> 原推荐为"4 角色 + 服务端矩阵"；vc 将其升级为 **5 角色 + 动态 Scope（行级权限）+ 审计日志**，方向不变、维度更贴合集团化管理。

**角色模型（5 角色，最小可用集非上限）：**
| 角色 | 职责 | 数据范围 |
|------|------|---------|
| `system_admin`（超管） | 管系统，不管具体业务 | 全量（含用户/权限配置） |
| `group_admin`（集团管理员） | 管特定集团内人员/权限/数据 | `accessibleCompanies` 数组指定 |
| `company_secretary`（公司秘书） | 管单家公司事务 | 本司 + 关联 |
| `auditor`（审计） | 只读 | 默认按 scope；可单独授权跨集团读财务（需审批） |
| `member`（普通成员） | 基础查阅 | 按 scope 最小化 |

**范围机制（行级权限 / Row-Level Security）：**
- `Personnel` 模型增加 `accessibleCompanies: [ObjectId]` 字段；
- 封装**全局 Query Filter 中间件**：所有 `list`/`read` Company、Document、Meeting 等操作时，自动注入 `find({ _id: { $in: currentUser.accessibleCompanies } })`（超管/审计特例除外）；
- 例：管理员 A 的 `accessibleCompanies=['A']` → 查 Company 自动 `IN ['A']`；管理员 B `['A','B']` → 看 A、B 两家。

**权限矩阵 + 审计（满足"举证"刚需）：**
- 后台提供可视化权限矩阵 UI，Group Admin 可勾选能力（如：能否删文档、能否发起签署）；
- 全量操作写 **AuditLog**（谁/何时/把谁的权限从 X 改到 Y），金融/合规系统强制要求；
- Wave 0 必须包含审计日志基础能力。

**优点**：极度灵活、符合集团化管理习惯、数据安全合规。
**缺点**：后端查询逻辑稍复杂（须始终携带权限过滤条件）——可通过全局中间件收敛，不在每处散写。

**Wave 0 须增加的实现项（vc 明确列出）：**
1. `Personnel` Schema 加 `accessibleCompanies: [ObjectId]`；
2. 封装全局 Query Filter 中间件，自动注入权限过滤；
3. 简易后台管理页（MVP），允许 System Admin 给他人分配 `accessibleCompanies`。

---

## 主题二：部署架构与数据隔离

### ✅ E3. 多实体/多租户 → 选 A：单库 + `company` 过滤（方案甲）
- 现在用单库 + `company` 字段 + `scopeByCompany`/全局 Query Filter 中间件（呼应 E5 行级权限）；物理多租户延后。
- 3 家同集团逻辑隔离已够用，迁移成本低。

### ✅ E4. 移动端形态 → 选 A：PWA（不建原生 App）
- manifest + service worker 渐进增强；随 Web 部署即更新、离线能力够用；无双端维护负担。

---

## 主题三：手机 + 微信端

### ✅ D-W1. 微信端路径 → 选 A：先做 H5-in-WeChat，小程序延后到 M4
- 复用 90% 现有 React 代码，周级上线；原生小程序（B）作为 M4 增量，两路共享同一 JWT/SignTask 状态。

### ✅ D-W2. 微信身份绑定 → 选 A：openid 静默登录 + 账号绑定 + invite 兜底
- `snsapi_base` 取 openid → 已绑 User 静默签 JWT 直进；未绑走"CSMS 账号绑定"；新用户走 invite 兜底（呼应 E2 关公开注册）。

### ✅ D-W3. PWA 离线缓存范围 → 选 A：壳 + 元数据，签字原文不整量离线
- 离线缓存应用壳 + 最近查看的纪要/提醒/文档元数据；签字 PDF 原文不整量离线（仅短期预签名 URL，恢复网络即失效），防丢机泄露（CFO 手机含 3 家签字件）。

---

## 已定稿、无需再选的 UX 决策（D1–D5，此前已锁定）
- **D1** 会议纪要自动建 SignTask → 生成后弹窗请用户确认（非静默），防漏建/错建
- **D2** 直接签署 → 另存副本（新文件带 `(signed)`/`(ctc)` 后缀，原文件保留），非覆盖
- **D3** 归档锁定 → 可解除 + 审计日志（解除写 AuditLog：谁/何时/为何），非硬锁死
- **D4** 文件分类 → 产品定最小枚举（6 大类）+ 用户可扩展子类，存 Category 集合
- **D5** 搜索范围 → 首版只搜元数据，PDF 内文检索列二期

---

## 锁定结论（设计冻结）
- 8/8 决策全部采用推荐档，E5 由 vc 升级为 rev2（5 角色 + 动态 Scope + 审计矩阵）。
- E2/E5 100% 兼容原始推荐，vc 补充为"邀请制分级管理 + RBAC 行级权限"的完整运营/数据结构展开。
- **下一步**：按 SOP 拉起 Wave 0（地基与安全），实现清单见《PROGRAM-ROLLUP-PLAN-2026-07-17.md》Wave 0 章节 + 本文件 E5 rev2 的三项增量。
