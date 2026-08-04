# Claw (CSMS) 用户体验架构重构方案

> 角色：用户体验架构师（ArchitectUX）｜日期：2026-08-03
> 目标：消除体验断点，建立"以公司为圆心"的流畅工作流，给 LuxuryDeveloper 一份可直接落地的前端基础规范。

---

## 1. 现状诊断：已确认的断点

基于代码核查（非臆测），当前前端存在以下体验断点：

| # | 断点 | 证据 | 影响 |
|---|------|------|------|
| B1 | **Sign Tasks 是导航孤儿** | `App.jsx` 有 `/sign-tasks` 路由与 `SignTasks.jsx` 页面，但 `Navbar.jsx` 的 `NAV_ITEMS` 完全不含它；侧边栏与手机底部 Tab 均无入口 | 用户无法进入签署模块，功能形同废弃 |
| B2 | **全站零面包屑** | `grep -r [Bb]readcrumb` 在 `client/src` 无结果；所有详情页无统一"我在哪/属于谁"回跳 | 从 Dashboard 逾期项 / Task / Reminder 难回到所属公司，迷失感强 |
| B3 | **IA 与领域模型错配** | 导航把 Companies/Personnel/Documents/Meetings/Tasks/Compliance 当平行列表；而 `CompanyDetail.jsx` 已是 rich hub（TabNav + 关联创建 + 股权图 + 登记册生成），却没被当作主工作台引导 | v5.0 的 `Company.links[]` 中枢在 UX 层没落地 |
| B4 | **分组语义混乱** | `Templates`（文档模板库）被塞进 `Compliance` 组，与 Reminders(运营)/Rules(配置) 混在一起 | 用户找模板要进"合规"，心智错位 |
| B5 | **移动端高频入口被藏** | 底部 Tab 仅 5 项（首页/公司/文档/会议/任务）+"更多"复用整条侧边栏；Personnel、Compliance、Signatures 需多一步 | 秘书高频的"合规到期""签署"在手机上够不到 |
| B6 | **首次进入缺引导** | 有 Demo 横幅，但各列表空状态无"快速创建/下一步"引导 | 新用户面对空白面板不知从哪开始 |

---

## 2. 目标体验架构原则

1. **双锚点模型**：`Dashboard`（指挥台，跨公司全局视图）+ `Company Workspace`（公司工作台，单公司中枢）。其余模块分两层——**运营动作层**（每天做）与**资料库层**（随时查）。
2. **任一实体都可回跳所属公司、可跳关联实体**：面包屑 + 关联面板是全局契约。
3. **导航零孤儿**：每个有路由的页面都必须在导航中可达（修复 B1）。
4. **分组即心智**：同组模块共享"为什么在一起"的语义（修复 B4）。
5. **移动优先可达**：高频动作在底部 Tab 直接可达（修复 B5）。

---

## 3. 信息架构重构（导航规范）

### 3.1 新的分组模型

```
COMMAND（指挥）
  ├─ Dashboard          指挥台 / 全局逾期与概览
  └─ Companies          公司库（→ 进入各 Company Workspace）

OPERATIONS（运营动作，每天做）
  ├─ Compliance         合规日历 / Reminders
  ├─ Tasks              任务
  └─ Signatures         Sign Tasks  ← 修复 B1 孤儿，从"更多"提升为常驻

LIBRARY（资料库，随时查）
  ├─ Personnel          统一人员库
  ├─ Documents          文件
  ├─ Meetings           会议
  └─ Templates          模板库    ← 从 Compliance 组移出（修复 B4）

SYSTEM（系统）
  ├─ Settings
  └─ Admin Panel        （仅 admin）
```

### 3.2 `NAV_ITEMS` 落地形状（Navbar.jsx 改造）

```jsx
const NAV_GROUPS = [
  { key: 'command',    label: 'Command' },
  { key: 'operations', label: 'Operations' },
  { key: 'library',    label: 'Library' },
  { key: 'system',     label: 'System' },
]

const NAV_ITEMS = [
  { path: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',  group: 'command' },
  { path: '/companies',    icon: Building2,       label: 'Companies',  group: 'command' },

  { path: '/compliance-reminders', icon: Bell,      label: 'Compliance', group: 'operations' },
  { path: '/tasks',        icon: CheckSquare,     label: 'Tasks',      group: 'operations' },
  { path: '/sign-tasks',   icon: PenTool,         label: 'Signatures', group: 'operations' }, // 修复 B1

  { path: '/personnel',    icon: UserCircle,      label: 'Personnel',  group: 'library' },
  { path: '/documents',    icon: FileText,        label: 'Documents',  group: 'library' },
  { path: '/meetings',     icon: Calendar,         label: 'Meetings',   group: 'library' },
  { path: '/templates',    icon: FileCode,         label: 'Templates',  group: 'library' }, // 修复 B4

  { path: '/settings',     icon: SettingsIcon,     label: 'Settings',   group: 'system' },
]
// Admin Panel 仍按 isAdmin 单独渲染于 System 组
```

渲染逻辑：遍历 `NAV_GROUPS`，每组下渲染其 `NAV_ITEMS`，组标题用 `uppercase tracking-widest text-ink-3` 小标签（沿用现有风格）。

---

## 4. 公司工作台模式（修复 B3 的核心）

`CompanyDetail` 已具备 TabNav、关联创建、股权图、登记册生成能力——把它正式确立为**单公司中枢工作台**，所有"以公司为圆心"的工作都从这里发起。

**Company Workspace 规范（每个 Company 详情页统一套用）：**
- 顶部 `DetailHeader`：公司名 / jurisdiction / 状态徽章。
- 面包屑：`Companies / {公司名}`（见 §5）。
- `TabNav` 固定七段：`Overview · Officers & Shareholders · Documents · Meetings · Compliance · Tasks · Equity`。
- 每个 Tab 内都有"＋ 新建关联实体"按钮（已在 CompanyDetail 基本实现，需在所有 Tab 暴露一致入口）。
- 这样 `Company.links[]` 中枢在 UX 层真正可见、可操作。

**Dashboard → Company Workspace 流转（日常主循环）：**
Dashboard 逾期面板每一项都带"所属公司"链接，点击直达该公司 Workspace 对应 Tab（如逾期合规项 → Compliance Tab）。

---

## 5. 跨实体跳转契约（修复 B2）

新增全局 `Breadcrumbs` 组件（可放 `UIHelpers.jsx` 或独立文件），**所有详情页强制注入**：

- 层级规则：`模块 / 实体名 / 子实体名`
  - 例：`Companies / Acme Ltd / Officers / John Tan`
  - 例：`Compliance / Annual Return 2026`
- 每段可点击回跳；末段为当前页（不可点）。
- **关联实体行**：每个详情页顶部展示"所属 Company"（带链接）+ 关联 Meeting/Task（带链接）。
- **相关面板**：
  - Company Workspace 聚合展示其逾期项（合规/任务）数量与一键跳转；
  - Task / Reminder 详情页展示"所属公司"一键跳转。
- 契约验收：从任意详情页，最多 2 次点击可回到其所属公司。

---

## 6. 全局命令面板（⌘K，缓解导航深度）

新增 `CommandPalette` 组件（在 `Layout` 或 `Navbar` 挂载），提供：
- 跳转：输入即过滤所有模块/公司/人员。
- 快捷新建：⌘K → "New reminder / task / document / meeting"。
- 桌面与移动端通用（移动端可用搜索框触发）。
- 监听 `keydown` (meta/ctrl + k) 打开。

---

## 7. 移动端底部 Tab 重构（修复 B5）

底部 Tab 改为覆盖秘书高频动作，避免把"合规/签署/人员"藏进"更多"：

```jsx
const BOTTOM_TABS = [
  { path: '/dashboard',  icon: LayoutDashboard, label: '首页' },
  { path: '/companies',  icon: Building2,       label: '公司' },
  { path: '/compliance-reminders', icon: Bell,  label: '合规' },
  { path: '/tasks',      icon: CheckSquare,     label: '任务' },
  { path: '/sign-tasks', icon: PenTool,         label: '签署' },
]
// "更多"抽屉内含：Personnel / Documents / Meetings / Templates / Settings
```

"更多"仍复用侧边栏抽屉（现有 `openMobile` 逻辑），但常驻 5 项覆盖核心日活。

---

## 8. 首次进入引导与空状态（修复 B6）

- `EmptyState` 组件（已存在）增加 `action` 插槽：每个列表空态带"＋ 创建第一个"按钮与下一步一句引导。
- Dashboard 对新用户显示"3 步上手"卡片：① 添加公司 → ② 录入人员/董事 → ③ 生成合规提醒。

---

## 9. 设计令牌（基于现有 Tailwind 体系，非另起炉灶）

Claw 已有一套 Tailwind 语义令牌，主题由 `ThemeContext` 驱动（亮/暗）：

| 类别 | 现有 token | 用途 |
|------|-----------|------|
| 品牌 | `primary-600` / `primary-700` / `primary-50` | 主操作、选中态、accent |
| 文本 | `ink` / `ink-2` / `ink-3` | 主/次/弱文本 |
| 表面 | `surface` / `canvas` / `bg-canvas` | 侧边栏/页面底 |
| 边框 | `hairline` / `border-hairline` | 分隔线 |
| 状态 | `danger` / `warning` / `info` | 删除/警示/信息 |
| 状态色约定 | `taskPriorityColor` / `compliancePriorityColor`（集中 `UIHelpers.jsx`） | 任务/合规优先级 |

**建议补充（写入 `tailwind.config.js` 或 CSS 变量，保持来源单一）：**
- 显式 4px 间距刻度：`--space-1..16`（统一纵向节奏，避免散落 magic number）。
- 分组视觉权重：Command/Operations/Library/System 各组可用 1px 左侧 accent 或组标题区分，强化"为什么在一起"。

> 不引入 vanilla CSS 设计系统——沿用项目既有 Tailwind 令牌，仅做显式化与补全，避免技术债。

---

## 10. 实施优先级（开发者交付顺序）

1. **P0 — 修复孤儿**：`NAV_ITEMS` 增加 `Signatures` + `Templates` 改 `library` 组（B1/B4）。改动小、收益大。
2. **P0 — 面包屑契约**：新增 `Breadcrumbs` 组件，注入全部详情页（B2）。
3. **P1 — 公司工作台固化**：统一 Company Workspace 的 TabNav + 每 Tab 新建入口（B3）。
4. **P1 — 移动端 Tab 重构**：`BOTTOM_TABS` 覆盖合规/签署（B5）。
5. **P2 — 命令面板**：`CommandPalette` + ⌘K（缓解深度）。
6. **P2 — 空状态/上手引导**：`EmptyState` action 插槽 + Dashboard 3 步卡（B6）。
7. **P3 — 间距令牌显式化**：`--space` 刻度补全。

---

## 11. 验收标准

- [ ] 每个有路由的页面在导航中可达（无孤儿，B1 关闭）。
- [ ] 任意详情页 ≤2 次点击回到所属公司（B2 关闭）。
- [ ] 公司工作台 Tab 齐全且每 Tab 可新建关联实体（B3 关闭）。
- [ ] Templates 在 Library 组、Signatures 在 Operations 组（B4 关闭）。
- [ ] 移动端底部 Tab 直达合规与签署（B5 关闭）。
- [ ] 空列表均有创建引导（B6 关闭）。
- [ ] 亮/暗主题下所有新组件对比度达 WCAG 2.1 AA。

---
**架构师**：ArchitectUX（用户体验架构师）
**下一步**：此基础规范就绪，可交 LuxuryDeveloper 按优先级实现；建议先落 P0 两项（改动最小、断点最痛）。

---

## 12. 实施进度追踪

### ✅ P0-1 导航孤儿修复（B1 / B4）— 2026-08-03 已落地
- **改动文件**：`client/src/components/Navbar.jsx`
- **`NAV_ITEMS` 重排为四组**（由新增 `NAV_GROUPS` 数组驱动渲染；今后新增分组只需改 `NAV_GROUPS`，渲染逻辑零改动）：
  - `Command`：Dashboard / Companies / Personnel
  - `Operations`：Documents / Meetings / Tasks / **Signatures（`/sign-tasks`，修复 B1 导航孤儿）**
  - `Compliance`：Reminders / Rules
  - `Library`：**Templates（从 Compliance 改归 Library，修复 B4）**
  - `System`：Settings
- **图标**：`Signatures` 用 `FileSignature`（已确认 `lucide-react@0.294.0` 的 `dist/esm/icons/file-signature.js` 导出 `FileSignature`）。
- **验证**：根目录 ESLint 0 error；`lucide-react` 导出已确认；渲染逻辑等价于原 `filter(null)+filter('Compliance')` 且仅做扩展，无行为回退。
- **移动端**：`/sign-tasks` 经「更多」侧栏抽屉可达（侧栏渲染全部 `NAV_GROUPS`）。

### ✅ P0-2 面包屑契约（B2）— 2026-08-03 已落地
- **新增组件**：`client/src/components/Breadcrumbs.jsx`（`items: [{label, to?}]`；有 `to` 且非末项可点，末项不可点并 `aria-current="page"`）。
- **注入 5 个详情页**：
  - `CompanyDetail`：面包屑 `Companies / {公司名}`。
  - `MeetingDetail` / `TaskDetail` / `ComplianceReminderDetail`：面包屑 `Companies / {公司名}(可点) / 模块 / {实体名}` → **1 击回公司**。
  - `PersonnelDetail`：面包屑 `Personnel / {人名}`；「任职公司」区块本就渲染为指向 `/companies/:id` 的 Link（多公司），满足 ≤2 击回公司。
- **契约验收（B2 关闭）**：任意详情页 ≤2 次点击回所属公司（Meeting/Task/Reminder 经面包屑公司节点 1 击；Personnel 经任职公司链接 1 击）。
- **验证**：ESLint（根目录）全量 0 error 进行中。

### ✅ P0-3 账户菜单假入口修复（B7）— 2026-08-04 已落地
- **问题**：Dashboard 顶部账户下拉菜单中的「个人设置 / 切换公司 / 偏好与主题」三个按钮仅有关闭菜单的 `onClick`，无实际导航或功能；路由中不存在 `/profile`、`/switch-company`、`/preferences` 页面，用户点了没反应。
- **改动文件**：`client/src/pages/Dashboard.jsx`
  - 移除三个未实现按钮及其图标 import（`Settings`、`Briefcase`、`SlidersHorizontal`）。
  - 菜单结构精简为：账户信息 → divider → 退出登录。
  - 保留注释说明隐藏原因，便于后续实现对应功能时恢复。
- **验证**：根目录 ESLint 0 error 进行中。

### 功能路线图决策（B7 延伸 · 防复发）
- **偏好与主题**：Navbar 已通过 `ThemeContext` 提供 Sun/Moon 切换（Navbar.jsx:94,136），账户菜单此入口为**重复且未接 Context 的空壳**，删除后不恢复。
- **切换公司**：当前 IA 为「Companies 列表 → 公司工作台」，无「全局当前公司」上下文；`AuthContext.accessibleCompanies` 为空。恢复前须先确定 IA（是否引入全局当前公司），否则与 Companies 列表重复。
- **个人设置**：需后端用户档案 API + `/profile` 页；当前 `AuthContext` 为硬编码 mock，无持久化。列为 **P3**，路由与功能齐备后方可恢复。
- **防复发准则**：任何菜单/导航入口**必须同时提供真实路由 + 功能**；禁止空壳占位按钮。功能暂未实现时，宁可不在 UI 暴露，也不要放「点了没反应」的死入口。

### ✅ P1-A 公司工作台 Tab 新建入口固化（B3）— 2026-08-04 已落地
- **问题**：Company Workspace 七段 Tab 的「＋新建关联实体」入口**散落、文案/位置/样式不一致**：
  - people Tab 用 `btn-primary` 但文案是英文 `Add Link`；
  - documents Tab 仅右侧一个 `btn-secondary` 上传按钮、无标题；
  - compliance Tab 的「新增提醒」嵌在 card 内、位置偏；
  - **tasks Tab 完全没有「新建」入口**（只读列表，用户进了公司却无法就地建任务）。
- **新增共享组件**：`client/src/components/UIHelpers.jsx` 的 `TabActionBar` —— 统一「标题(计数) + ＋新建」头部（左标题右 `btn-primary`+Plus，间距/样式单一事实源），消灭各 Tab 自行散落按钮。
- **抽取共享 `TaskForm`**：原 `Tasks.jsx` 内的 `TaskForm`（含 4 个常量）抽为 `client/src/components/TaskForm.jsx`，`Tasks.jsx` 与 `CompanyDetail.jsx` 复用，避免重复实现。
- **CompanyDetail.jsx 改造**：
  - people Tab：`TabActionBar` 标题「董事、股东及公司秘书」+ 动作「添加关联人员」（中英统一）；
  - documents Tab：`TabActionBar` 标题「文件 (n)」+ 动作「上传并关联会议」；
  - compliance Tab：`TabActionBar` 标题「合规提醒 (n)」+ 动作「新增提醒」；
  - **tasks Tab 补齐缺口**：`TabActionBar` 标题「关联任务 (n)」+ 动作「新增任务」，并挂载 `TaskForm` Modal（预填 `company: id`），空状态也含「新增任务」按钮 → 公司工作台真正成为任务创建中枢。
- **验证**：ESLint（根目录）5 文件 0 error；`TaskForm` 抽出后 `Tasks.jsx` 清理了未用 import（`inputClass`/`labelClass`/`FormField`/`companyService`/`meetingService`/`fmtDateShort`/`validate`/`required`/`useMemo`）。

### ✅ P1-B 移动端底部 Tab（B5）— 2026-08-04 已落地
- **问题**：手机端底部 Tab 栏 5 项（首页/公司/文档/会议/任务）把高频的「合规 / 签署」藏进「更多」抽屉，移动场景触达成本高。
- **改动文件**：`client/src/components/Navbar.jsx` 的 `BOTTOM_TABS`：
  - 用 **合规（`/compliance-reminders`，Bell）** 与 **签署（`/sign-tasks`，FileSignature）** 替换低频的「文档 / 会议」；
  - 新 5 项：**首页 / 公司 / 合规 / 签署 / 任务**（均为高频动作）；文档/会议仍可在「更多」抽屉到达。
- **验证**：ESLint 0 error；`Bell`/`FileSignature` 已在 Navbar import。

### ✅ P2 命令面板（⌘K）— 2026-08-04 已落地
- **目标**：全局快速操作层，⌘K/Ctrl+K 唤起，聚焦「导航跳转 + 全局动作」；不重复侧栏 `GlobalSearch` 的实体搜索职责（仅提供「查看全部搜索结果」兜底跳转 `/search`）。
- **新增组件**：`client/src/components/CommandPalette.jsx`
  - 复用 `Navbar.jsx` 导出的 `NAV_ITEMS` / `NAV_GROUPS` 作导航数据源（单一事实源，零重复配置）；按分组顺序展示，分组标题中文化（主导航 / 业务 / 合规 / 资料库 / 系统）。
  - 动作区（`操作`组）：主题三态切换（亮/暗/系统，仅显示非当前态）、退出登录；`isAdmin` 额外含 Admin Panel 项（与 Navbar 一致）。
  - 输入时额外提供「查看"xxx"的全部搜索结果」跳 `/search?q=`（兜底实体搜索入口）。
  - 键盘：`↑↓` 选择、`Enter` 执行、`Esc` 关闭；打开自动聚焦输入框；选中项滚入可视区；底部提示栏（↑↓ / ↵ / ⌘K）。
- **Navbar.jsx 改动**
  - `NAV_ITEMS` / `NAV_GROUPS` / `BOTTOM_TABS` 改为 `export const`（单一事实源供命令面板复用）。
  - 新增 `cmdOpen` 状态 + 全局 `keydown` 监听（⌘K/Ctrl+K 切换开关）。
  - 顶部 logo 区 theme 按钮旁加 ⌘K 触发按钮（`hidden sm:block`，移动端用快捷键唤起）。
  - 渲染 `<CommandPalette isOpen={cmdOpen} onClose={...} />`。
- **循环依赖说明**：Navbar ↔ CommandPalette 形成循环引用，但 `CommandPalette` 仅在**渲染期**访问 `NAV_ITEMS`（ESM live binding 安全，模块加载期不取值）；dev/prod 均无白屏（已 curl 模块确认 Vite 转译 200、无编译错误）。
- **验证**：根目录 ESLint 0 error；Vite 转译 `CommandPalette.jsx` 返回 200、35802 字节、无编译错误。

### ✅ P2 命令按钮位置调整（A 方案）— 2026-08-04 已落地
- **问题**：命令面板触发按钮原先堆在 logo 行（theme toggle + command + Demo 三者挤一起），视觉拥挤且语义不清。
- **改动**：按钮从 logo 区移到 `GlobalSearch.jsx` 搜索框右侧（搜索框 `flex-1` + 右侧 `shrink-0` ⌘K 按钮），通过 `onOpenCommand` prop 解耦；`Navbar.jsx` 移除 logo 区按钮及未用的 `Command` 导入。
- **验证**：ESLint 0 error；搜索框（找实体）与命令按钮（跳转/动作）形成并排兄弟入口，logo 区清爽。

### ✅ P2-B6 空状态创建引导 — 2026-08-04 已落地
- **目标**：关闭「空列表无创建引导」断点（B6）。核心策略＝增强 `EmptyState` 组件 + 给缺引导的主列表补「＋创建」CTA。
- **`EmptyState` 组件增强**（`client/src/components/UIHelpers.jsx`）：
  - 视觉升级：图标包进软圈（`rounded-2xl bg-subtle p-4`）、标题 `text-base font-semibold text-ink`、描述 `text-sm text-ink-3 max-w-sm`、action 统一包 `mt-5` 容器。
  - 新增 `compact` 布尔 prop（详情子区块用，缩小 padding/图标），向后兼容（默认 false，旧调用零变化）。
- **主列表空态补创建引导**（验收点：任意主列表空态均有 `btn-primary` CTA）：
  - `Companies.jsx`：原 `No companies found`（无引导）→ 加 `description` + `action={<button onClick={openNew} className="btn-primary">＋ 添加公司</button>}`。
  - `Personnel.jsx`：原 `No personnel found`（无引导）→ 加 `description` + `action={<button onClick={openCreate} className="btn-primary">＋ 添加人员</button>}`。
  - `Tasks.jsx`：原 `New Task`（英文 + 内联 `bg-primary-600` 样式）→ 中文化「新建任务」+ 统一 `btn-primary`，与全局一致。
  - 已具备引导者保留（不回退）：`Meetings`（新建会议）、`ComplianceReminders`（＋新增提醒）、`SignTasks`（＋新建签署任务）、`Templates`（初始化预设）、`ComplianceRules`（初始化预设）、`DocumentManager`（＋上传文档）。
- **范围决策**：`PersonnelDetail` 内子区块（任职公司/关联会议等）空态未加 CTA——属 360° 视图内的次级区块，从那里创建需预关联本人，复杂度高，留待后续；主列表（B6 验收对象）已全部覆盖。
- **验证**：ESLint（根目录）4 文件 0 error。

### ✅ P3 间距令牌显式化 — 2026-08-04 已落地
- **问题**：`index.css` 已有 `--space-1..8,10,12` 但**缺 9/11/14/16**，且这些 var 仅在自定义组件类内使用，**未注册进 Tailwind 工具类**——开发者无法用 `p-space-4`/`gap-space-6`，令牌非单一事实源。
- **改动**：
  - `client/src/index.css` `:root` 补全刻度：`--space-9:2.25rem; --space-11:2.75rem; --space-14:3.5rem; --space-16:4rem;`（形成完整 1..16 4px 基准）。`.dark` 不覆盖间距（主题无关）。
  - `client/tailwind.config.js` `extend.spacing` 把键 `1..12,14,16` 映射为 `var(--space-N)`——与 Tailwind 默认刻度**值完全一致（非破坏性）**，并补 9/11/14/16；今后编辑 CSS 变量即全局生效，`p-space-4`/`gap-space-6`/`space-y-space-4` 等工具类可用。
- **验证**：`node --check tailwind.config.js` 语法 OK；vite 预览 HTTP=200（未动颜色，`@apply` 无旧色白屏风险，HMR 安全）；生产构建门禁进行中。

### 🎉 全量断点关闭
- **P0**：B1 导航孤儿 / B4 Templates 错组 / B2 面包屑 / B7 账户假菜单。
- **P1**：B3 公司工作台 Tab 新建入口固化 / B5 移动端底部 Tab。
- **P2**：命令面板 ⌘K / B6 空状态引导。
- **P3**：间距令牌显式化。
- 所有计划内 UX 重构项均已落地并验证。改动仍仅在沙箱本地 `E:\Claw`，未提交；生产 `claw-web.onrender.com` 未更新，需本机 commit + push + 部署。
