# Claw（CSMS）全量优化计划 — 2026-08-11

> 范围：对 `client/src`（61 个源文件）、`server`（44 个 js）、构建配置（`vite.config.js`/`package.json`/`tailwind.config.js`）、路由查询模式、依赖树与 UX/可访问性做一次系统性扫描，定位可优化点，按 P0/P1/P2 产出带 `file:line` 引用的详细计划。
> 视角：全栈性能 + 代码质量 + 用户体验架构（UX Architect）。
> 说明：本计划为**只读扫描的产物**，未改动任何代码；落地需另开实施任务。

---

## 0. 扫描方法论与已确认的良好实践（先说好的）

扫描已确认以下**已经做得不错**、不应回退：

| 项 | 状态 | 证据 |
|---|---|---|
| 路由级代码分割 | ✅ 已做 | `client/src/App.jsx:8-28` 全部 `lazy(() => import(...))` + `<Suspense>` |
| MongoDB 索引覆盖 | ✅ 良好 | 各模型 `*.index()` 齐全（Company/Document/Meeting/Task/SignTask/ComplianceReminder/Personnel/AuditLog 均有复合/文本索引） |
| 列表接口部分分页 | ✅ 部分 | `companies.js:58`、`personnel.js:74`、`resultsTimetable.js:532`、`audit.js:21`、`search.js:140` 已分页 |
| 统一错误边界 | ✅ 有 | `components/ErrorBoundary.jsx`，路由级 `resetKey={pathname}` |
| 加载/空态组件 | ✅ 有 | `UIHelpers.jsx` 提供 `LoadingSpinner`/`EmptyState`/`PageHeader` |
| 命令面板/全局搜索 | ✅ 有 | `CommandPalette.jsx` / `GlobalSearch.jsx` |
| 路由鉴权 | ✅ 有 | `ProtectedRoute` / `AdminRoute`（`App.jsx:52-65`）+ `scope` 中间件 |

---

## 1. 前端构建 / 依赖（Bundle & Deps）

### 1.1 `vite.config.js` 无 vendor 拆分与预加载 — P2
- **位置**：`client/vite.config.js:28-36`（`build.rollupOptions` 仅有 `onwarn`，无 `output.manualChunks`）
- **问题**：路由虽 lazy，但所有页面共享一份 vendor，且重依赖（docx / pdf-lib / xlsx）未单独成 chunk；无 `<link rel="prefetch">` 预取相邻路由。
- **建议**：
  - 加 `manualChunks`：react/react-router 拆 `react-vendor`；`docx`→`docx-vendor`；`pdf-lib`+`jspdf`→`pdf-vendor`；`xlsx`+`jszip`→`xlsx-vendor`。
  - 对高频相邻路由（如 Company→CompanyDetail）加 `import(/* webpackPrefetch */)` 或 `<link rel="prefetch">`。
- **收益**：首屏 vendor 缓存命中率提升、重依赖按需加载更干净。
- **工作量**：S（0.5 天）。

### 1.2 死依赖 `core-js`、`react-window` 未被引用 — P1/P2
- **位置**：`client/package.json:14`（`core-js`）、`:26`（`react-window`）
- **扫描证据**：`grep` 全 `client/src` 对 `react-window`/`core-js`/`lodash` 引用 = **0 命中**。
- **问题**：
  - `core-js` 在 Vite（esbuild）现代构建里完全多余，纯增安装体积。
  - `react-window`（^2.2.7）本是用于大列表虚拟化的利器，却既未使用、又让大列表裸奔（见 2.1）。
- **建议**：删除 `core-js`；**启用 `react-window`** 虚拟化 Companies/Personnel/Tasks 列表（见 2.1），否则删除。
- **工作量**：XS（删依赖）+ 见 2.1。

### 1.3 跨栈三套 PDF 库并存 — P2
- **位置**：前端 `client/package.json:17`（`jspdf`）、`:21`（`pdf-lib`）；后端 `package.json:30`（`pdfkit`）
- **问题**：`jspdf`+`jspdf-autotable` 与 `pdf-lib` 在前端并存；后端另有 `pdfkit`+`docxtemplater`+`pizzip`。功能重叠，包体冗余。
- **建议**：评估合并——前端统一用 `pdf-lib`（已用于签名/文档预览），`jspdf` 若仅用于导出可迁移；后端 PDF 生成收敛到单一库。
- **工作量**：M（需回归测试导出功能）。

---

## 2. 前端运行时性能（Runtime）

### 2.1 大列表「全量取数 + 全量渲染」，未虚拟化 — **P1（高影响）**
- **位置**：`client/src/pages/Companies.jsx:69-81`（`getAll()` → `useSearchFilter` 客户端过滤 → 全量 `filtered.map` 渲染）；`Personnel.jsx`、`Tasks.jsx` 同模式（后端对这些 list 路由也无分页，见 3.2）。
- **问题**：
  - 前端从不传分页参数，即便后端 `companies.js`/`personnel.js` 已支持 `usePaging`，也等于全量拉取。
  - 上千条公司/人员/任务时：首屏拉全量 JSON + 全量 DOM 渲染 → 卡顿、内存高、滚动掉帧。
  - `react-window` 已依赖却未用（见 1.2）。
- **建议（二选一，推荐 A）**：
  - **A. 客户端虚拟化**：用 `react-window` 的 `FixedSizeList` 包裹列表行，抽取 `<CompanyRow>` 等行组件；数据仍全量但仅渲染可视区。
  - **B. 服务端分页**：列表接口加 `page/limit`（见 3.2），前端分页取数 + 无限滚动。
- **收益**：大列表滚动/交互从 O(n) DOM 降到可视区量级。
- **工作量**：M（每列表页 0.5–1 天）。

### 2.2 列表行组件缺 `React.memo` — P1
- **位置**：`Companies.jsx` / `Personnel.jsx` / `Tasks.jsx` 行渲染（无 `React.memo` 包裹）。
- **问题**：父组件任意 state 变更（如搜索框 `onChange`、弹窗开关）触发**整列表重渲染**，条数越多越明显。
- **建议**：抽取行组件 `const CompanyRow = React.memo(({c, onEdit}) => ...)`，传稳定 `key` + 记忆化回调（`useCallback`）。
- **工作量**：S。

### 2.3 派生数据未包 `useMemo` — P2
- **位置**：`Companies.jsx:55` `useScopedItems(companies, ...)` 每次渲染对全量数组重算且无 `useMemo`；`Companies(2)`/`Tasks(3)`/`Personnel(3)` 的 `useMemo/useCallback` 极少（对比 `CompanyDetail(20)`/`MeetingDetail(19)`）。
- **建议**：对 `filtered`、`scoped`、`汇总计数` 等派生值统一 `useMemo`；`useScopedItems` 内部 memoize。
- **工作量**：S。

### 2.4 巨型组件未拆分 — P1（可维护性）/ P2（性能）
- **位置**：`pages/AdminPanel.jsx`(1627 行)、`pages/CompanyDetail.jsx`(1626)、`pages/MeetingDetail.jsx`(1474)、`pages/ResultsTimetable.jsx`(805)、`components/DocumentManager.jsx`(682)。
- **问题**：单文件多 Tab/多职责、hooks 密集 → 任意状态变更触发大范围 re-render；构建单 chunk 大；新人难维护。
- **建议**：按 Tab/Section 拆子组件 + 自定义 hooks（如 `useCompanyTasks`、`useMeetingSignatures`、`useRuleLibrary`），状态下沉到子组件，父仅持布局与选中态。
- **收益**：re-render 作用域收窄、单文件可测试、并行开发不冲突。
- **工作量**：L（分阶段，每组件 1–2 天）。

---

## 3. 后端性能（API / DB）

### 3.1 所有只读查询未用 `.lean()` — **P1（高收益、低风险）**
- **位置**：覆盖 `auth.js`、`companies.js`、`companyEntries.js`、`companyRegister.js`、`complianceRules.js`、`complianceReminders.js`、`documents.js`、`meetings.js`、`tasks.js`、`search.js` 等全部 `.find`/`.populate`（grep 命中 0 处 `.lean()`）。
- **问题**：Mongoose 默认返回完整 Document（带 getter/setter/变更追踪/原型链），列表/详情只读场景水合成本高，随数据量线性放大。
- **建议**：所有 GET/列表/详情查询链式加 `.lean()`，返回纯 JS 对象；需后续 `save()` 的写场景保留 Document。
- **收益**：读路径 CPU/内存显著下降，响应更快。
- **工作量**：S（机械批量，建议脚本化替换 + 测试）。
- **风险**：`.lean()` 后丢失实例方法/虚拟字段，需确认这些查询不依赖 Document 方法（写路径已排除）。

### 3.2 列表接口缺分页 — P1
- **位置**（list handler 无 `skip/limit`）：`routes/tasks.js`、`routes/meetings.js`、`routes/documents.js`、`routes/signTasks.js`、`routes/complianceReminders.js`、`routes/complianceRules.js`。
- **已分页**：`companies.js:58`、`personnel.js:74`、`resultsTimetable.js:532`、`audit.js:21`、`search.js:140`。
- **问题**：这些 list 随数据增长返回全量 + 多 `.populate()`，既慢又撑大响应体；与前端 2.1 互为因果。
- **建议**：统一分页契约 `{ page, limit, total, pages }`，默认 `limit=50`；前端 2.1 配合。
- **工作量**：M（6 个 list handler，各 0.5 天 + 前端分页取数）。

### 3.3 无 HTTP 压缩中间件 — P1
- **位置**：`server/index.js`（grep `compression` = 0 命中）。
- **建议**：`npm i compression`，在 `server/index.js` 路由前 `app.use(compression())`。
- **收益**：JSON / 静态响应 gzip，真实后端首屏更快、带宽更省。
- **工作量**：XS（5 分钟）。

### 3.4 `companyEntries.js` 逐条 populate — P2（需确认无循环内 N+1）
- **位置**：`routes/companyEntries.js:47-48, 65-66, 120, 150, 167` 保存/查重后 `await entry.populate(...)`。
- **判断**：当前为单文档 post-save populate，**可接受**；风险仅在「列表接口循环内逐条 populate」才构成 N+1。建议列表走查询期一次性 `.populate().lean()`，并排查是否仍有循环内 `await findById/populate`。
- **工作量**：S（确认 + 收敛）。

---

## 4. 后端生产卫生 / 安全

### 4.1 `mongodb-memory-server` 误置生产依赖 — **P0/P1（部署风险）**
- **位置**：根 `package.json:26`（`dependencies` 而非 `devDependencies`）。
- **问题**：该包 `npm install` 时会**下载 MongoDB 二进制**。Render 等部署环境安装阶段会触发下载（慢/偶发失败/污染生产镜像），而它仅测试用。
- **建议**：移到 `devDependencies`（根 `package.json` 与/或 `server` 侧）。
- **工作量**：XS（1 行 + 重新安装验证）。
- **优先级理由**：属部署链路隐患，归 P0/P1 高位。

### 4.2 缺安全中间件 — P2
- **位置**：`server/index.js`、`server/middleware/auth.js`（grep `helmet`/`rateLimit` = 0 命中）。
- **问题**：无 `helmet` 安全头；`/api/auth/login` 无限流（暴力破解风险）；CORS 可能过宽。
- **建议**：`app.use(helmet())`；登录/注册加 `express-rate-limit`（如 10 次/15 分钟）；CORS `origin` 白名单取 `process.env.CLIENT_URL`。
- **工作量**：S。

### 4.3 跨栈 PDF 库冗余 — P2（同 1.3）

---

## 5. 代码质量 / 可维护性

### 5.1 TODO 空实现 — P2
- **位置**：`client/src/pages/CompanyDetail.jsx:1197` `onDownload={() => {} /* TODO: generate ROS Word */ }`。
- **建议**：补 ROS Word 生成，或改为禁用态 + tooltip「即将推出」，避免「点了没反应」。
- **工作量**：S/M（取决于 ROS 模板复杂度）。

### 5.2 `console.error/warn` 散落 catch — P2
- **位置**：`AdminPanel.jsx:1190/1201/1210`、`MeetingDetail.jsx:445`、`Tasks.jsx:146`、`DocumentManager.jsx:129`、`utils/fileAccess.js:55/85/99/109`、`services/index.js:45/49` 等。
- **建议**：封装 `utils/logger.js`（开发 console；生产可接 Sentry/日志服务），避免生产噪声、统一格式。
- **工作量**：S。

### 5.3 遗留模型混淆 — P2
- **位置**：`server/models/DirectorEntry.js`、`ShareholderEntry.js`（与统一 `Personnel` 并行；working memory 已记生产库 0 条）。
- **建议**：确认无引用后删除或加 `@deprecated` 注释 + 路由下线，减少认知负担。
- **工作量**：S。

---

## 6. UX / 可访问性（专家视角）

### 6.1 Modal 可访问性缺口 — P2
- **位置**：`client/src/components/Modal.jsx:30-56`（Dialog 节点）。
- **缺失**：`role="dialog"`、`aria-modal="true"`、`aria-labelledby`（关联 title）、**焦点陷阱（focus trap）**、关闭后焦点归还、关闭按钮 `aria-label`。
- **已有**：Esc 关闭、body overflow 锁定、Portal 到 body（好评）。
- **建议**：加 dialog 语义属性 + 简单 focus trap（打开时聚焦首个可聚焦元素，Tab 循环，关闭归还触发元素）；关闭按钮加 `aria-label="关闭"`。
- **工作量**：S。

### 6.2 加载/空/错误态规范不统一 — P2
- **问题**：部分页用 `LoadingSpinner`/`EmptyState`，但提交态、详情骨架屏、接口错误态不一致（有的仅靠 `toast`）。
- **建议**：沉淀 `Skeleton`/`ErrorState` 组件，统一三态规范（列表/详情/表单）。
- **工作量**：S。

### 6.3 信息架构 / 工作流断点（体验主线）— P1
- **已有诊断文档**：`E:/Claw/.workbuddy/ux-architecture-redesign.md`（B1–B7 断点 + Phase 0–3 路线图）。
- **核心断点回顾**：
  - B1 Meetings 不是 CompanyDetail 一级 Tab（实体中枢未闭环）
  - B2 业绩排期不回流 Company/Compliance
  - B3 模板静态库无下游（生成后不落 Task/Document）
  - B4 合规闭环 Rules→Reminder→Task→Document 不通
  - B5 规则库锁 Admin
  - B6 导航语义混用
  - B7 移动端底部 Tab 藏高频
- **建议**：落地该文档 Phase 0（纯前端 IA 调整，低风险）→ Phase 1–3（回写落库/工作流向导）。
- **工作量**：L（分阶段）。

---

## 7. 优先级路线图（Roadmap）

### P0 / 部署风险（立即）
- [ ] **4.1** `mongodb-memory-server` → `devDependencies`

### P1（本迭代重点，高 ROI）
- [ ] **3.1** 全只读查询加 `.lean()`（脚本化 + 测试）
- [ ] **3.2** tasks/meetings/documents/signTasks/complianceReminders/complianceRules 列表加分页
- [ ] **3.3** 加 `compression` 中间件
- [ ] **2.1** 大列表虚拟化（`react-window`）或改服务端分页
- [ ] **2.2** 列表行 `React.memo`
- [ ] **2.4** 巨型组件拆分（先 AdminPanel / CompanyDetail）
- [ ] **6.3** 落地 UX 重构文档 Phase 0

### P2（打磨，可排期）
- [ ] **1.1** `vite.config.js` manualChunks + 预取
- [ ] **1.2** 删 `core-js`；启用/移除 `react-window`
- [ ] **1.3 / 4.3** PDF 库合并
- [ ] **2.3** 派生数据 `useMemo`
- [ ] **3.4** `companyEntries` populate 收敛 + 排查 N+1
- [ ] **4.2** helmet / rate-limit / CORS 白名单
- [ ] **5.1** ROS Word TODO 实现或禁用态
- [ ] **5.2** 统一 `logger`
- [ ] **5.3** 遗留模型清理
- [ ] **6.1** Modal 可访问性
- [ ] **6.2** 三态组件规范

---

## 8. 快速见效清单（Quick Wins，合计约 1–1.5 天）
1. **3.3** compression（5 min）
2. **4.1** mongodb-memory-server 移 devDeps（5 min）
3. **3.1** 全查询 `.lean()`（机械批量，0.5 天 + 测试）
4. **1.2** 删 `core-js` 死依赖（2 min）
5. **2.2** 列表行 `React.memo`（0.5 天）
6. **6.1** Modal aria + focus trap（0.5 天）

---

## 9. 验证方式（落地时）
- **前端**：`npm run build` 0 报错（硬门禁）；Lighthouse 跑分对比（首屏/可交互时间）；大列表（造 1000+ 条）滚动帧率。
- **后端**：对改动路由跑 `autocannon`/`wrk` 压测对比 `.lean()` 前后 P95；分页接口返回 `total/pages` 校验。
- **回归**：`vitest` + 现有 `server/tests/*` 全绿；ESLint 0 Error。
- **UX**：键盘可达性走查（Tab/Esc/focus trap）；移动端断点走查。

---
*附录：扫描命令摘要（只读，未改码）*
- 结构：`wc -l` 统计 61 前端源文件 / 44 后端文件
- 反模式 grep：`console.*|debugger`、`TODO|FIXME`、`react-window|core-js|lodash`、`\.lean\(`、`\.skip\(|\.limit\(`、`compression|helmet|rateLimit`
- 依赖核对：`client/package.json`、`package.json`（根）
- 配置核对：`client/vite.config.js`、`App.jsx`、`Modal.jsx`、`Companies.jsx`
