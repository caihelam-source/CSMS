# CSMS 代码审查标准与流程（Code Review Standard & Process）

> 适用范围：Claw / CSMS（React + Vite 前端 / Express + MongoDB Atlas + R2 后端，Render 部署）
> 维护者：开发团队　最后更新：2026-07-24
> 配套文件：[CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md)（每个 PR 勾选）

---

## 0. 为什么需要这套机制（来自本项目的真实事故）

CSMS 在 2026-07 连续暴露出一批「上线后才发现、且表象都很像『登录超时/失效』」的缺陷。复盘后发现：这些缺陷**不是随机的**，而是同一类「链路未被任何一道关卡拦住」的可预防问题。本标准的每一条规则，都对应下面至少一个真实事故。

| # | 事故（生产表象） | 根因 | 本应被哪类审查拦截 |
|---|------------------|------|--------------------|
| A | 公司文件显示 0KB，预览/下载全失效 | 后端 `documents.js` 写 `size`/`mimetype`，但 schema 与前端用的是 `fileSize`/`mimeType`，字段名三处不一致 | 前后端契约一致性 |
| B | 真实模式下 CTC 发起 401，但任务「看似建了」 | `wrap()` 在真实 API 失败时**静默回退 mock**，假成功掩盖了 401/500 | 错误处理 / 禁止静默回退 |
| C | 发起 CTC 报 400 | `Document.type` 枚举漏了 `'ctc'`，路由校验直接拒 | 前后端契约 / 枚举同步 |
| D | 任何操作都提示「登录超时/失效」 | 登录链路 4 个断点叠加：① `VITE_API_BASE` 是占位符；② Atlas 密码未轮换后端起不来；③ 免费套餐冷启动无 timeout；④ 401 即清 token 跳登录，demo 回退误导 | 认证授权 / 部署配置 / 错误处理 |
| E | 单个待签文件出现 3 份（源/假签/真签） | 业务分叉逻辑错误，发起即建「假签」文档 | 业务语义 / 数据幂等 |
| F | 部署后前端打到不存在的 API 域名一直转圈 | 生产 env `VITE_API_BASE=https://your-claw-api.onrender.com` 占位符从未替换 | 部署配置审查 |

**核心结论**：CSMS 的风险高度集中在「前后端契约」与「失败可见性」两块。审查机制必须把这两条作为最高优先级，而不是泛泛的「代码风格」。

---

## 1. 审查原则

1. **契约先行（Highest Priority）**：任何涉及 API 字段、枚举、响应结构、文档模型的改动，必须先确认「schema ↔ 路由 ↔ 前端 service ↔ 前端组件」四处一致，再谈逻辑。
2. **失败必须显式（No Silent Fallback）**：禁止 `catch` 后静默回退到另一套数据源（如 mock）而不留痕；失败要么抛出明确错误，要么显式降级 + 日志记录。
3. **门禁前置**：所有检查尽量自动化、左移——push 前 ESLint + vite build 已是强制门禁，新增检查应优先做成自动门禁而非靠人肉。
4. **安全左移**：密钥、密码、Atlas/R2 凭据只走环境变量，绝不进 git；任何凭据轮换必须同步更新部署环境变量。
5. **缺陷回灌**：每一个生产缺陷关闭时，必须回灌一条审查清单项（见 §6），让机制自我进化。
6. **小步提交、可独立回滚**：单个 PR 只解决一个明确目标，便于 review 与 bisect。

---

## 2. 角色与职责

| 角色 | 职责 | 人数要求 |
|------|------|----------|
| **Author（提交者）** | 自审（§4 步骤 1）、跑通本地门禁、填写 PR 模板、对缺陷提供验证证据 | 1 |
| **Reviewer（审查者）** | 逐条勾选 [审查清单](./CODE_REVIEW_CHECKLIST.md)、对契约/安全变更重点把关、给出 Approve / Change Request | 普通 PR ≥1；契约或安全变更 **≥2**（双人审） |
| **Maintainer（合并者）** | 确认门禁通过、合并后触发 Render 部署、在部署环境验证关键路径 | 轮值 |

> 注：当前项目为单人主导 + AI 协作模式。AI 可承担「自审 + 清单勾选 + 门禁执行」角色，但**契约类与安全类变更必须由人类最终 Approve**（AI 无法访问 Render/Atlas 控制台）。

---

## 3. 审查清单（核心，按类别）

完整可勾选版见 [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md)。类别如下：

### A. 前后端契约一致性（本项目最高频缺陷，必查）
- [ ] 字段命名在 **schema ↔ 路由(req/res) ↔ 前端 service ↔ 前端组件** 四处完全一致（`fileSize` 不能一边 `size`，`mimeType` 不能一边 `mimetype`）。
- [ ] 新增/修改的**枚举值**（`Document.type`、`signStatus`、`scope` 等）在 schema 定义、路由校验、前端类型/常量（`DOC_TYPE_CODE` 等）、UI 选项四处同步。
- [ ] API 请求体与 `wrap()`/`normalize()` 的 `{success,entity}` / `{data:{data}}` 约定对齐；前端 service 返回结构被组件正确使用。
- [ ] 文件上传/替换：物理文件 key、元数据字段、版本号逻辑前后端一致。

### B. 错误处理与可观测性（对应事故 B/D）
- [ ] **无静默回退**：`catch` 后不得静默切换到 mock/另一数据源而不记录；确需降级必须 `console.warn`/日志 + 明确的 UI 提示。
- [ ] 401/403/5xx 前端有明确、区分度的提示（「登录失效请重登」「服务启动中请稍候」「参数错误」），**不得统一吞成「登录超时」**。
- [ ] 所有外部请求（axios 等）设置合理 `timeout`，冷启动/弱网有友好提示。
- [ ] 关键路径有日志，便于事后定位（不打印密钥）。

### C. 认证与授权（对应事故 D）
- [ ] JWT 有效期、刷新机制合理；前端 401 处理不误伤正常流程。
- [ ] **演示/真实模式分明**：`VITE_USE_MOCK` 切换清晰；真实模式下绝不使用 `demo-token` 假装成功。
- [ ] 权限中间件（如 `scopeMiddleware`）对敏感路由（文件 view/download、管理操作）生效。

### D. 数据安全与幂等（对应事故 E）
- [ ] 「就地替换」(`replaceFile`) 与「新建」(`upload`) 语义清晰，不重复产生文档。
- [ ] 删除/迁移类操作有备份守卫（参考 `migrate-v5.js`、`cleanup-sign-duplicates.js` 的护栏）。
- [ ] 关联实体（如 `Task.sourceDocumentId`）的级联/同步逻辑正确，编辑即同步同一实体。

### E. 安全（对应事故 D/F 的凭据面）
- [ ] 无密钥/密码/令牌进 git（`SECRETS.md` 已 gitignore）。
- [ ] Atlas / R2 / GitHub PAT 等凭据轮换后，**部署环境变量同步更新**并验证。
- [ ] 用户输入（文件名、查询参数）在落地前做校验/转义，防注入/路径穿越。

### F. 部署与配置（对应事故 D/F）
- [ ] 生产 env（`client/.env.production`、`render.yaml`）**无占位符**（如 `your-claw-api.onrender.com`）；`VITE_API_BASE` 指向真实地址。
- [ ] `render.yaml` 的 `plan`、healthCheck、环境变量与当前运营策略一致。
- [ ] 免费套餐冷启动有应对（timeout / 保活 / 升级决策）。

### G. 质量门禁（已有，强制）
- [ ] `node node_modules/eslint/bin/eslint.js .` **0 error**（warning 不阻塞）。现有 flat config 已含 `react/jsx-no-undef`、`no-undef`，可拦未导入组件/变量白屏。
- [ ] `vite build` **0 报错**。
- [ ] 新增功能附手动验证记录或测试；关键修复附复现→修复→验证三步证据。

---

## 4. 审查流程（Process）

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ 1. 自审     │→  │ 2. 本地门禁  │→  │ 3. 提审(PR)  │→  │ 4. 清单勾选  │→  │ 5. 批准+推送 │
│ Author      │   │ eslint+build │   │ 填模板       │   │ Reviewer     │   │ 门禁→部署    │
└─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                                                                                    │
                                                                                    ▼
                                                                          ┌──────────────────┐
                                                                          │ 6. 部署后验证     │
                                                                          │ 关键路径走查      │
                                                                          └──────────────────┘
```

**步骤 1 — 自审（Author）**
- 对照 [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) 自测，重点先验契约类（A）与错误处理类（B）。
- 本地跑 ESLint + vite build，确保 0 error。

**步骤 2 — 本地门禁（自动）**
- ESLint flat config（`eslint.config.js`）已分 server/client 两套规则。
- 推送脚本 `scripts/push-no-git.cjs` 内置 `execSync(eslint .)`，非零退出即 abort 推送——**这是最后一道人肉之外的硬门禁**。

**步骤 3 — 提审（PR）**
- 单个 PR 单一目标；填写 PR 模板（目标 / 契约变更点 / 验证证据 / 风险）。
- 契约类或安全类变更，PR 描述必须显式标注「需双人审」。

**步骤 4 — 清单勾选（Reviewer）**
- 逐条勾选审查清单；对 A（契约）、C（认证）、E（安全）项必须给出具体确认（如「已核对 schema 与前端字段四处一致」）。
- 任一必查项不通过 → `Change Request`，附具体文件:行号。

**步骤 5 — 批准与推送（Maintainer）**
- 门禁通过 → 运行 `push-no-git.cjs`（GitHub Git Data API，绕过沙箱无 git，自动触发 Render build+deploy）。
- 契约/安全变更需两个 Approve。

**步骤 6 — 部署后验证**
- 在 Render 部署环境走查关键路径（登录、文件预览/下载、签署闭环）。
- 若生产再现缺陷 → 回到 §6 回灌清单。

---

## 5. 门禁工具链（现状 + 建议）

**已有（强制，勿退化）**
- `eslint.config.js`：flat config，server(commonjs+recommended) / client(ESM+JSX，`react/jsx-no-undef` + `no-undef`)。
- `scripts/push-no-git.cjs`：推送前 `execSync(eslint .)`，失败即 abort。
- `vite build`：部署构建，须 0 报错。
- `client/vite.config.js`：`vite-plugin-checker` 开发期实时标红（不扰部署 build）。

**建议增量（按优先级）**
1. **P1 契约 diff 检查**：在 `push-no-git.cjs` 中加一步「扫描 `DOC_TYPE_CODE` / 枚举常量是否在 schema 与前端都存在」，把事故 C 变成自动拦截。
2. **P1 占位符扫描**：构建前 grep `client/.env.production` 与 `render.yaml` 是否含 `your-` / `example.com` 等占位符，命中即 fail。
3. **P2 Pre-commit hook**：用 husky/lint-staged 把 ESLint 前置到本地提交，减少「推送才被发现」。
4. **P2 CI**：GitHub Actions 在 PR 上跑 ESLint + build + 占位符扫描，作为第二道独立验证（不依赖本地 `push-no-git`）。
5. **P2 静默回退扫描**：静态扫描 `catch` 块中调用 mock / 默认成功分支，标记为需人工确认（对应事故 B）。

---

## 6. 缺陷回灌机制（Lessons Learned）

> 规则：每个生产缺陷在关闭时，必须在此表追加一行（或更新已有行），并同步到 [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) 对应类别。机制靠此自我进化。

| 缺陷 | 触发审查项（类别） | 状态 | 自动拦截？ |
|------|-------------------|------|-----------|
| A 字段名不一致 | A.1 四处字段一致 | 已修复(e3ad5e4) | 建议 P1 契约 diff |
| B 静默回退 mock | B.1 无静默回退 | 已修复 | 建议 P2 静态扫描 |
| C 枚举漏 ctc | A.2 枚举四处同步 | 已修复 | 建议 P1 契约 diff |
| D 登录链路断点 | C / F 认证与部署 | 部分(P1 代码待做，P0 控制台待你操作) | 建议 P1 占位符扫描 |
| E 签署 3 文件 | D.1 替换 vs 新建语义 | 已修复(cc422d8) | 人工 |
| F API 占位符 | F.1 无占位符 | 待 P1 代码+你核对控制台 | 建议 P1 占位符扫描 |

---

## 7. PR 模板（建议直接用于 `.github/PULL_REQUEST_TEMPLATE.md`）

```markdown
## 目标
<!-- 这个 PR 解决什么问题，单一目标 -->

## 契约变更点（若有，必填）
<!-- 涉及哪些字段/枚举/API？四处(schema/路由/service/组件)是否一致？ -->
- [ ] 已核对前后端契约四处一致
- [ ] 枚举/常量在 schema 与前端同步

## 验证证据
<!-- 复现 → 修复 → 验证 三步，附截图或命令输出 -->
- 本地 ESLint：0 error
- vite build：0 error
- 手动验证：

## 风险与回滚
<!-- 影响范围、如何回滚 -->

## 审查清单
<!-- 链接 CODE_REVIEW_CHECKLIST.md，逐条勾选 -->
```

---

## 8. 附则

- 本标准为**活文档**，随缺陷回灌持续更新；重大修订需团队（含人类 Maintainer）确认。
- AI 协作模式下，AI 可执行自审、清单勾选、门禁运行，但**契约类与安全类变更的最终 Approve 必须由人类作出**。
- 与现有质量门禁（`eslint.config.js`、`push-no-git.cjs`、vite build）构成「自动门禁 + 人工审查」双层防线，二者不可互相替代。
