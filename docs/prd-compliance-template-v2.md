# PRD · Claw 模板模块 v2（Schema 驱动合规文书引擎）

> 产品经理：许清楚 ｜ 日期：2026-08-06 ｜ 版本：v2.0 Phase 1
> 状态：**决策已锁定，可直接进入架构拆解**
> 上游依据：`2026-08-05-13-37-42/overview.md`（架构师高见远整合方案）

---

## 1. 项目信息

| 项 | 内容 |
|---|---|
| **Language** | 简体中文 |
| **Programming Language** | 沿用 Claw 现有栈：React 18.2 + Vite + Tailwind 3（前端）/ Node + Express + Mongoose（后端）。**不引入新框架** |
| **Project Name** | `claw_compliance_template_v2` |
| **改造范围** | Claw 模板模块（`server/models/DocumentTemplate.js`、`server/routes/templates.js`、`client/src/pages/Templates.jsx` 及新增引擎文件） |
| **交付阶段** | Phase 1（本期）；Phase 2 项已在文中标注 P2 |

### 1.1 原始需求复述

将独立的「港股上市公司风控合规文档模板库 MVP」（Vite + React，6 个 schema 驱动模板，支持条款增删改与导出 Word）**整体并入** Claw（CSMS 香港公司秘书系统）的模板模块，并新增**运行时可视化新建模板**能力。Claw 旧模板模块采用「HTML 内容 + `{{变量}}` 字符串替换」，样式与填入体验均劣于新模板库，**全部替换为新引擎**。

### 1.2 已锁定决策（不再讨论）

| # | 决策 | 结论 |
|---|---|---|
| Q1 | 旧 HTML 模板 | **全部废弃**，改为纯 schema 单引擎，不做双引擎共存 |
| Q2 | 渲染位置 | **前端**：通用解释引擎读 schema 生成文档，后端只存取与校验 |
| Q3 | 生成文书自动归档 Documents | **Phase 2**，本期不做 |
| Q4 | 模板增删改权限 | **仅 admin**；所有登录角色可查看与填写 |
| Q5 | 签名块 | 一律**自由填写文本格子**，不关联 Claw 人员库（本期不扩 `Company.links[].roles` enum） |
| Q6 | 模板版本管理 | 数据模型**现在预留字段**，UI 放 Phase 2 |
| Q7 | 填写快照存档 | 数据模型**现在预留字段**，UI 放 Phase 2 |
| Q8 | Builder「文档结构」页签 | **Phase 2**；本期 `layoutMode: 'auto'` 覆盖新建需求 |
| 新增 | 风控合规年度 multitask | 本期**仅在数据模型与架构上预留**，不实现编排 UI |

---

## 2. 产品定义

### 2.1 Product Goals

| # | 目标 | 衡量口径 |
|---|---|---|
| **G1 · 可用** | 修复模板模块在真实后端下的失效状态，让模板功能从「Mock 才能跑」变为「生产可用」 | B1–B4 四个 bug 全部修复；真实后端下模板列表、保存、渲染、初始化四条主链路 0 报错 |
| **G2 · 高质** | 用 schema 引擎替换 HTML 字符串替换，产出符合港股正式文书观感的合规文档 | 6 个内置 preset 的屏幕预览与导出 Word 均与 MVP 版本视觉一致；导出文件可直接用于对外报送 |
| **G3 · 可扩** | 让 admin 无需改代码即可在界面上新建模板，摆脱「加模板 = 提需求 + 发版」 | admin 在 Builder 中 10 分钟内可完成一个含 8 个字段的新模板并保存、填写、导出 |

三个目标彼此正交：G1 修存量、G2 换引擎、G3 加能力。

### 2.2 User Stories

| # | 用户故事 | 对应目标 |
|---|---|---|
| **US1** | 作为**公司秘书**，我希望打开模板页时能正常看到模板列表而不是白屏，以便我能实际使用这个模块办公 | G1 |
| **US2** | 作为**公司秘书**，我希望选择「董事确认函」后填写表单并实时看到成文预览，一键导出 Word，以便我不用再手工排版正式文书 | G2 |
| **US3** | 作为**合规／内审负责人**，我希望填写「部门管理层年度内控自评表」这类含动态条款增删的复杂表格，系统能自动编号并校验漏填，以便我减少人工核对成本 | G2 |
| **US4** | 作为**系统管理员（admin）**，我希望在界面上通过「加字段 → 选类型 → 设属性」组装一个全新模板并保存，以便公司新增合规要求时无需等待研发排期 | G3 |
| **US5** | 作为**普通用户（viewer/manager）**，我希望我看不到也点不到模板的编辑与删除入口，以便避免误改影响全公司的模板资产 | G1 / G3 |

---

## 3. 需求池（P0 本期必须 / P1 本期尽量 / P2 Phase 2 预留）

### 3.1 P0 — 本期必须交付

#### R-P0-1 修复 4 个存量后端／契约 bug（已逐条核实代码）

| Bug | 现状（已在代码中确认） | 必须达成 |
|---|---|---|
| **B1** | `client/src/utils/responseNormalize.js:12` 的 `ENTITY_KEYS` 含 `'template'` 单数，**缺 `'templates'` 复数** → 列表负载提取失败，`useSearchFilter` 报 `.filter is not a function` 白屏 | 数组补 `'templates'`；补一条单测断言 |
| **B2** | 前端 `templateService.initPresets()` 打 `/api/templates/init-presets`，后端实为 `router.post('/initialize')`（`server/routes/templates.js:134`）→ 404 | 前后端路径统一（建议后端保留 `/initialize`，前端改调用） |
| **B3** | 前端传 `render(id, { data: {...} })`，后端 `/:id/render` 读 `{ companyId, directorIds, manualVars }`（`templates.js:90-95`）→ 变量恒为空 | 统一为 schema 引擎新契约；旧 `{{变量}}` 字符串替换逻辑随 Q1 一并废弃 |
| **B4** | 前端 `CATEGORIES`（`Templates.jsx:15`）含 `shareholder_notice`／`annual_report`，后端 enum 仅 5 项且含前端没有的 `minutes` → 选这两类保存必 500 | category enum 前后端**同源**，并扩容容纳合规六类 |

> **验收前置**：B1–B4 不修，新引擎的任何验收结论都不可信。必须最先落地。

#### R-P0-2 `DocumentTemplate` 模型支持 schema 模板

现模型仅 36 行、`content` 为 `required: true`，无法承载 schema。需演进：

| 字段 | 类型 | 说明 |
|---|---|---|
| `docSchema` | `Mixed` | 模板 schema 主体。**严禁命名为 `schema`**（Mongoose 保留字，直接抛错） |
| `sampleData` | `Mixed` | 示例数据，供 Builder 实时预览 |
| `schemaVersion` | `Number` | 契约版本，默认 `1` |
| `presetKey` | `String` | 内置模板幂等键（唯一稀疏索引），重复初始化不产生重复数据 |
| `isPreset` | `Boolean` | 沿用现有字段；内置模板 `true`，**不可删除**（后端强校验，非仅前端隐藏） |
| `category` | `String` enum | 扩容并与前端同源，覆盖 `internal_control` / `risk_management` / `ipo_filing` 等合规类目 |
| `content` | `String` | 由 `required: true` **改为非必填**（Q1 后已无 html 引擎使用者） |
| `variables[]` | 数组 | 形状保留，由 `docSchema.fields` 派生，保证卡片变量标签等既有 UI 零改造 |

**预留字段（本期只建模、不做 UI）**：

| 字段 | 用途 | 决策 |
|---|---|---|
| `version` / `versionHistory[]` | 模板版本管理 | Q6 · UI 归 Phase 2 |
| `snapshots[]`（或独立集合，架构师定） | 填写后定稿存档 | Q7 · UI 归 Phase 2 |
| `annualCycle`（如 `{ enabled, fiscalYearField, taskGroupKey }`） | 风控合规年度 multitask 编排锚点 | 仅预留，不实现 |

**技术约束（必须写入实现）**：`Mixed` 类型更新后必须调用 `markModified('docSchema')`，否则改动被静默丢弃。

#### R-P0-3 前端通用 schema 引擎 `SchemaDocRenderer`

- 把 MVP 中 6 个写死的 `render(data)` 泛化为**一个**解释引擎，模板本体退化为纯 JSON。
- **字段类型**必须覆盖 6 个 preset 实际使用的 9 类（已统计确认）：`text`(29) / `list`(12) / `date`(12) / `select`(7) / `boolean`(4) / `textarea`(3) / `checklist`(2) / `objectList`(1) / `clauses`(1)。
- **区块类型**与 MVP 原子组件 1:1：`heading` / `paragraph` / `infoTable` / `checkList` / `clauseList` / `objectTable` / `signBlock` / `note` / `divider` / `group`。
- **双层布局**：`layoutMode: 'auto'`（Builder 默认，按字段顺序自动成文）与 `'custom'`（6 个 preset 用，手写 `layout.sections[]` 还原正式文书观感）。
- **安全红线（P0）**：引擎纯声明式，**禁用 `eval` / `new Function` / `dangerouslySetInnerHTML`**；条件显示与校验走 JSON 条件 DSL + 算子白名单；不提供 `html` 区块类型。
- 章节自动编号（`autoNumber`）由引擎统一处理，替代 MVP 中内控评估报告的手写动态章节号。

#### R-P0-4 可视化 Template Builder（运行时新增模板）

- 三栏工作台：**字段面板**（增删字段、选类型、拖拽排序）｜**字段属性编辑器**（标签／类型／选项／必填／条件显示／校验）｜**文档实时预览**（跑 sample 数据）。
- 保存产物为 schema JSON，落 `docSchema`。
- 复用 MVP 的 `FieldEditor` / `EditableList` / `ObjectListEditor`，样式换 Claw 设计令牌（`inputClass` / `labelClass` / `primary-600`）。
- 本期布局固定 `auto`（Q8）。

#### R-P0-5 内置 6 个合规模板 preset

| # | 模板 | MVP id | 实现难度 |
|---|---|---|---|
| 1 | 董事确认函 | `director-confirmation` | 中（条件显示 + 文字变量混排） |
| 2 | DU004G 董事声明及承诺 | `du004g-undertaking` | 中（required boolean） |
| 3 | 部门管理层年度内控自评表 | `department-self-assessment` | **高（objectList 双层字段 + 表格空值三态 + 4 条交叉校验）** |
| 4 | 内控评估报告模板 | `internal-control-report` | 中（动态章节号 → 引擎 autoNumber） |
| 5 | 董事会声明和决议记录 | `board-resolution` | 低 |
| 6 | 项目章程（项目立项） | `project-charter` | 低 |

落位建议 `server/data/templatePresets.js`，`presetKey` 幂等，`sample` 迁入 `sampleData`。

#### R-P0-6 模板页重写（列表 / 新建编辑 / 填写 / 预览 / 导出）

- `/templates` 由「网格 + 3 个 Modal」重构为「网格 + 全屏工作台」。
- 填写视图复用同一引擎：选公司 → 预填 → 表单（自动填充值标绿）→ 实时预览 → 校验 → 打印／导出 Word。

#### R-P0-7 权限控制（Q4）

- 新建／编辑／删除模板：**仅 `admin`**。后端复用已存在的 `adminAuth`（`server/middleware/auth.js:26`）。
- 查看与填写：全部登录角色（`admin` / `secretary` / `manager` / `viewer` / `auditor`）。
- **前端隐藏入口 + 后端强校验双保险**，禁止仅靠前端隐藏。

#### R-P0-8 Word 导出

- 直接复用 MVP `docxExport.js`（`exportDocxFromElement` / `buildDocxBlocks` / `buildDocxFileName` / `sanitizeFileName`）。
- 依赖已就绪：Claw client 已装 `docx@^9.7.1`，**与 MVP 完全同版本**；可复用 `client/src/utils/docxCommon.js` 字体常量。
- 导出文件名遵循 `fileNamePattern`（如 `{{companyName}}-董事确认函-{{today}}`）。

#### R-P0-9 签名块（Q5）

- `signBlock` 区块内所有角色格（董事／公司秘书／股东等）一律为**自由填写文本**。
- 本期**不**关联人员库、**不**扩 `Company.links[].roles` enum。

### 3.2 P1 — 本期尽量交付

| # | 需求 | 说明 |
|---|---|---|
| **R-P1-1** | 公司数据自动预填 | `POST /:id/resolve` 按 `variables[].source/fieldPath` 从 Company 预填（`source` 支持 `company` / `system`）；自动填充值在表单中视觉标绿 |
| **R-P1-2** | 打印样式 | `.doc-page` 写死白底黑字并加 `.dark` 覆盖，防暗色主题污染正式公文与打印件 |
| **R-P1-3** | 模板搜索与分类筛选 | 列表页按名称搜索 + category 筛选（依赖 B4 修完后的同源 enum） |
| **R-P1-4** | Builder 字段校验配置 | 可视化配置必填、数值范围、交叉校验（模板 3 需要 4 条交叉校验） |
| **R-P1-5** | 引擎回归单测 | 对 `doc-*` 语义 class 加断言（这些 class 是 docx 导出的锚点，被"顺手改"会静默破坏导出）+ B1 normalize 单测 |
| **R-P1-6** | 模板复制另存 | 基于现有模板「另存为副本」，比从零建更符合实际使用习惯 |

### 3.3 P2 — Phase 2 预留（本期不实现，仅保证不阻断）

| # | 需求 | 预留方式 |
|---|---|---|
| **R-P2-1** | 生成文书自动归档进 Documents 模块（Q3） | 架构预留调用点 |
| **R-P2-2** | 模板版本管理 UI：历史版本列表 + 回滚（Q6） | 数据模型已含 `version` / `versionHistory[]` |
| **R-P2-3** | 填写快照 UI：定稿存档 + 二次编辑（Q7） | 数据模型已含快照结构 |
| **R-P2-4** | Builder「文档结构」高级页签，支持 `layoutMode: 'custom'` 可视化编排（Q8） | 引擎已支持 custom，仅缺编辑 UI |
| **R-P2-5** | 风控合规年度 multitask 编排 UI（按年度跑整轮，类比年报／中报流程） | 数据模型预留 `annualCycle` 锚点 |
| **R-P2-6** | 人员库联动签名块、角色 enum 扩容（独立非执行董事等） | Q5 已明确本期不做 |
| **R-P2-7** | 扩展字段类型 `number` / `multiselect` / `matrix` | 6 个 preset 均未使用，引擎可留扩展位 |

---

## 4. UI 设计稿描述

### 4.1 页面结构总览

```
/templates
├── [视图 A] 模板列表（默认）
├── [视图 B] Builder 全屏工作台   ← 仅 admin
└── [视图 C] 填写工作台           ← 全角色
```

三个视图为**同页面内切换**（非路由跳转弹窗），保证工作台有足够横向空间。

### 4.2 视图 A · 模板列表

```
┌ 顶部栏 ─────────────────────────────────────────┐
│ 标题「文书模板」 │ [搜索框] [分类下拉] │ [+ 新建模板]★ │
└──────────────────────────────────────────────────┘
┌ 模板卡片网格（响应式 3 列 / 2 列 / 1 列）──────────┐
│ ┌ 卡片 ──────────────────────┐                    │
│ │ 模板名称        [内置] 徽标 │                    │
│ │ 分类标签 · 字段数           │                    │
│ │ 描述（2 行截断）            │                    │
│ │ 变量标签组（前 4 个 + N）    │                    │
│ │ ─────────────────────────── │                    │
│ │ [填写] [预览] [编辑]★ [删除]★│                    │
│ └────────────────────────────┘                    │
└──────────────────────────────────────────────────┘
空态：无模板时展示「初始化内置模板」按钮（触发 /initialize）
```
★ = 仅 admin 可见；`isPreset: true` 的模板**不显示删除按钮**，且后端拒绝删除。

### 4.3 视图 B · Builder 工作台（仅 admin）

```
┌ 工作台头部 ────────────────────────────────────────┐
│ [← 返回列表] 模板名称输入框 │ 分类下拉 │ [保存] [取消] │
└────────────────────────────────────────────────────┘
┌ 左栏 25% ────┬ 中栏 35% ──────────┬ 右栏 40% ────────┐
│ 字段列表      │ 字段属性编辑器      │ 文档实时预览      │
│               │                    │                  │
│ ⠿ 公司名称 text│ 字段标识 key       │ ┌ .doc-page ──┐  │
│ ⠿ 财政年度 date│ 显示标签 label     │ │ 【文书标题】 │  │
│ ⠿ 董事类别 sel │ 字段类型 type ▾    │ │             │  │
│ ⠿ 确认事项 chk│ 是否必填 ☐         │ │ 正文按 auto  │  │
│               │ 选项列表（select）  │ │ 布局渲染     │  │
│ [+ 添加字段]  │ 数据来源 source ▾   │ │ sample 数据  │  │
│               │ 条件显示 visibleWhen│ │             │  │
│ 拖拽 ⠿ 排序    │ 校验规则           │ └─────────────┘  │
│               │ [删除此字段]        │ 白底·防暗色污染   │
└──────────────┴────────────────────┴──────────────────┘
底部提示：本期布局为「自动成文」，自定义文档结构见 Phase 2
```

组件树：`TemplateBuilder` → `FieldListPanel`(`FieldItem` 可拖拽) + `FieldPropertyEditor`(按 type 动态渲染属性表单) + `SchemaDocRenderer`(preview 模式)。

### 4.4 视图 C · 填写工作台（全角色）

```
┌ 头部 ─────────────────────────────────────────────┐
│ [← 返回] 模板名称 │ [打印] [导出 Word]              │
└───────────────────────────────────────────────────┘
┌ 左栏 45% 表单 ─────────┬ 右栏 55% 预览 ────────────┐
│ 公司选择器 ▾            │ ┌ .doc-page（A4 比例）─┐  │
│ └ 选中后自动预填         │ │  文  书  标  题       │  │
│                        │ │                      │  │
│ ── 基础信息 ──          │ │  致：XX 有限公司      │  │
│ 公司名称 [自动·绿底]     │ │  事由：截至 2025 年…  │  │
│ 财政年度 [日期选择]      │ │                      │  │
│                        │ │  ┌──────────┐        │  │
│ ── 确认事项 ──          │ │  │ 信息表格  │        │  │
│ ☑ 条款一（可编辑）       │ │  └──────────┘        │  │
│ ☑ 条款二  [＋条款][－]   │ │                      │  │
│                        │ │  ☑ 已确认条款…        │  │
│ ── 签署 ──              │ │                      │  │
│ 董事签署 [自由文本]      │ │  签署：____  日期：__ │  │
│ 公司秘书 [自由文本]      │ └──────────────────────┘  │
│                        │                           │
│ ⚠ 校验提示区（漏填/交叉） │  滚动与表单联动高亮        │
└────────────────────────┴───────────────────────────┘
```

要点：
- 表单区按 schema 分组，动态列表（`list`/`clauses`/`checklist`/`objectList`）内联「＋／－」增删。
- 自动预填值绿底标识，用户可覆盖；覆盖后取消绿底。
- 空值在预览中显示为下划线占位 `＿＿＿＿`（沿用 MVP `BLANK` 常量），保证打印件留白规范。
- 校验未通过时，导出按钮 disabled 并高亮问题字段。

### 4.5 视觉规范

- 文书区域（`.doc-*`）**固定白底黑字宋体**，不随 Claw 主题变化；`.dark` 必须显式覆盖。
- 工作台外壳（头部、表单栏、按钮）使用 Claw 现有设计令牌，与系统其余页面一致。
- `.doc-*` 语义 class 为 Word 导出锚点，需加**警示注释**禁止随意重命名。

---

## 5. 待确认问题（真正未决，影响架构拆解）

| # | 问题 | 为何影响拆解 | 我的建议 |
|---|---|---|---|
| **O1** | 6 个 preset 本期是否**全部**内置？ | 模板 3「部门自评表」含 objectList 双层字段 + 空值三态 + 4 条交叉校验，是全部工作量的单点高峰，可能拖慢整体交付 | 建议 5 个先上（1/2/4/5/6），模板 3 单独作为一个任务、可延后半个迭代；若必须全上，需为它单列缓冲 |
| **O2** | Builder 本期支持**哪些字段类型**？ | 决定 `FieldPropertyEditor` 的分支数量与测试面 | 建议本期开放 preset 实际用到的 9 类（text/textarea/date/select/boolean/list/clauses/checklist/objectList）；`objectList` 配置最复杂，可评估是否只读不可新建；`number`/`multiselect`/`matrix` 归 P2 |
| **O3** | B2 统一路径时，改前端还是改后端？ | 影响是否需要同步改 mock 层与既有调用方 | 建议**改前端**调用为 `/initialize`，后端路径不动，改动面最小 |
| **O4** | 旧 HTML 模板数据（生产库里的存量记录）如何处理？ | Q1 决定废弃引擎，但**存量数据的去留**未定，影响是否需要迁移脚本 | 建议：不写迁移脚本，上线时标记为 `deprecated` 隐藏不删（保留可回溯），或由 Vincent 确认可直接清空 |
| **O5** | 快照数据存 `DocumentTemplate` 内嵌数组还是**独立集合**？ | Q7 只定了"模型预留"，未定存储形态；内嵌数组存在文档膨胀风险 | 建议独立集合 `TemplateSnapshot`，本期只建 model 不接 UI，避免 Phase 2 返工 |
| **O6** | `category` enum 扩容后的**最终取值清单**由谁定？ | B4 修复需要一份前后端同源的确定清单，否则仍会 500 | 建议由架构师在契约文档中一次定死并导出为共享常量（前后端同一份） |

---

## 6. 交付验收标准（Definition of Done）

| # | 验收项 |
|---|---|
| 1 | 真实后端（非 Mock）下打开 `/templates` 不白屏，列表正常渲染 |
| 2 | B1–B4 逐条可复现验证已修复；B1 附单测 |
| 3 | admin 可完成「新建模板 → 加 8 个字段 → 保存 → 填写 → 导出 Word」全链路 |
| 4 | 非 admin 角色看不到编辑／删除入口，且直接调 API 被后端拒绝（403） |
| 5 | 内置模板预览与导出 Word 视觉与 MVP 一致；`isPreset` 模板无法被删除 |
| 6 | 重复调用 `/initialize` 不产生重复模板（`presetKey` 幂等） |
| 7 | 代码中不存在 `eval` / `new Function` / `dangerouslySetInnerHTML` |
| 8 | `docSchema` 更新后正确调用 `markModified`，改动可持久化 |

---

## 7. 附：已核实的代码事实（供架构师直接引用）

| 事实 | 位置 |
|---|---|
| `ENTITY_KEYS` 缺 `'templates'` | `client/src/utils/responseNormalize.js:12-15` |
| 后端初始化路由为 `/initialize` | `server/routes/templates.js:134` |
| 前端 render 调用契约不符 | `client/src/pages/Templates.jsx:182` vs `server/routes/templates.js:90-95` |
| 前端 CATEGORIES 6 项 vs 后端 enum 5 项 | `client/src/pages/Templates.jsx:15` vs `server/models/DocumentTemplate.js:8` |
| `content` 当前为 `required: true` | `server/models/DocumentTemplate.js:13` |
| `adminAuth` 中间件已存在可直接复用 | `server/middleware/auth.js:26` |
| User role enum 5 个角色 | `server/models/User.js:24-28` |
| Claw client 已装 `docx@^9.7.1`（与 MVP 同版本） | `client/package.json:16` |
| 可复用字体常量 | `client/src/utils/docxCommon.js` |
| MVP 导出函数 | `hk-compliance-templates/src/docxExport.js`（`exportDocxFromElement` 等） |
| MVP 6 个模板定义行号 | `hk-compliance-templates/src/templates.jsx:502 / 647 / 810 / 1037 / 1225 / 1377` |
