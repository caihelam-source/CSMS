# CSMS PR 代码审查清单（Code Review Checklist）

> 每个 PR 提审前，Author 自测一遍；Reviewer 逐条确认。勾选 `[x]` 表示已确认通过。
> 配套标准：[CODE_REVIEW_STANDARD.md](./CODE_REVIEW_STANDARD.md)
> 默认需 ≥1 Reviewer；**A 类（契约）或 E 类（安全）变更需 ≥2 人审**。

---

## A. 前后端契约一致性（最高频缺陷，必查）

- [ ] **A.1 字段名四处一致**：`schema` ↔ 路由(req/res) ↔ 前端 `service` ↔ 前端组件 对同一字段命名完全一致。
  - 重点雷区：`fileSize` vs `size`、`mimeType` vs `mimetype`、`fileName` vs `name`。（事故 A：公司文件 0KB / 预览失效）
- [ ] **A.2 枚举四处同步**：新增/修改的枚举值（`Document.type`、`signStatus`、`scope` 等）在 `schema 定义` + `路由校验` + `前端常量(DOC_TYPE_CODE 等)` + `UI 选项` 四处同步。（事故 C：CTC 400）
- [ ] **A.3 响应结构对齐**：API 返回与 `wrap()`/`normalize()` 的 `{success,entity}` / `{data:{data}}` 约定对齐，前端 service 正确使用返回结构。
- [ ] **A.4 文件上传/替换一致**：物理文件 key、元数据字段、版本号逻辑前后端一致（`upload` vs `replaceFile`）。

## B. 错误处理与可观测性

- [ ] **B.1 无静默回退**：`catch` 后不得静默切换到 mock/另一数据源而不留痕；确需降级必须 `console.warn`/日志 + 明确 UI 提示。（事故 B：401 被 mock 掩盖）
- [ ] **B.2 错误区分度**：401/403/5xx 有明确、区分度提示（「登录失效请重登」「服务启动中请稍候」「参数错误」），**不得统一吞成「登录超时」**。（事故 D）
- [ ] **B.3 请求超时**：所有外部请求（axios 等）设置合理 `timeout`，冷启动/弱网有友好提示。
- [ ] **B.4 关键日志**：关键路径有日志便于定位，且不打印密钥/令牌。

## C. 认证与授权

- [ ] **C.1 模式分明**：`VITE_USE_MOCK` 切换清晰；真实模式下绝不使用 `demo-token` 假装成功。（事故 B/D）
- [ ] **C.2 401 处理**：前端 401 处理不误伤正常流程；登录态失效有清晰引导而非跳 demo 误导。
- [ ] **C.3 权限中间件**：`scopeMiddleware` 等对敏感路由（文件 view/download、管理操作）生效。

## D. 数据安全与幂等

- [ ] **D.1 替换 vs 新建语义**：`replaceFile`（就地替换）与 `upload`（新建）语义清晰，不重复产生实体。（事故 E：签署 3 文件）
- [ ] **D.2 删除/迁移护栏**：删除/迁移类操作有备份守卫（参考 `migrate-v5.js`、`cleanup-sign-duplicates.js`）。
- [ ] **D.3 关联同步**：关联实体（如 `Task.sourceDocumentId`）的级联/编辑同步同一实体，编辑即同步文档库。

## E. 安全

- [ ] **E.1 无密钥进 git**：`SECRETS.md` 已 gitignore；无密码/令牌/PAT 硬编码。
- [ ] **E.2 凭据轮换同步**：Atlas / R2 / GitHub PAT 等轮换后，**部署环境变量同步更新**并验证。（事故 D：Atlas 密码未轮换后端起不来）
- [ ] **E.3 输入校验**：文件名、查询参数等用户输入在落地前校验/转义，防注入/路径穿越。

## F. 部署与配置

- [ ] **F.1 无占位符**：`client/.env.production`、`render.yaml` 中**无** `your-claw-api.onrender.com` / `example.com` 等占位符；`VITE_API_BASE` 指向真实地址。（事故 F）
- [ ] **F.2 部署配置一致**：`render.yaml` 的 `plan`、healthCheck、环境变量与运营策略一致。
- [ ] **F.3 冷启动应对**：免费套餐冷启动有 timeout / 保活 / 升级决策。

## G. 质量门禁（强制，自动）

- [ ] **G.1 ESLint 0 error**：`node node_modules/eslint/bin/eslint.js .` 通过（warning 不阻塞）。现有 flat config 含 `react/jsx-no-undef`、`no-undef`。
- [ ] **G.2 vite build 0 error**：前端构建无报错。
- [ ] **G.3 验证证据**：新增功能附手动验证记录或测试；关键修复附「复现→修复→验证」三步证据。

---

## Reviewer 签字栏

| 项 | 确认 |
|----|------|
| Reviewer 1 | □ 已逐条勾选，Approve / Change Request |
| Reviewer 2（仅 A/E 类必填） | □ 已逐条勾选，Approve / Change Request |
| 门禁结果 | ESLint: ___ 　vite build: ___ |
| 部署后验证 | □ 已走查关键路径 |
