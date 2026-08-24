# 增量 PRD — 任务多参与者（CSMS / Claw）

> 文档类型：**增量 PRD（仅方案文档，不出代码）**
> 系统：CSMS（港股公司秘书管理系统）— Claw
> 日期：2026-08-19
> 作者：许清楚（Product Manager）
> 关联规划语境：`E:/Claw/deliverables/optimization-plan-2026-08-11.md`

---

## 0. 已拍板产品决策（硬约束，本次不得变更）

| # | 决策 | 约束含义 |
|---|---|---|
| 1 | **推进方式** | 本次只出方案文档，不动代码（先增量 PRD + 增量架构设计，用户审后决定开工） |
| 2 | **完成规则** | 多参与者时，**任一参与者可标记完成即任务完成**（任务级单一 `status`；不要求全员完成、不需创建者确认） |
| 3 | **可见性边界** | **维持 scope 全可见**——同集团/同 scope 内用户都能看到该任务，不收紧为"仅参与者可见" |

---

## 1. 增量产品目标

本次增量旨在补齐任务模块的"多人协作"能力：① 创建/编辑任务时支持从 User 列表**勾选多个参与者**（`assignedTo`）；② 任务列表与详情**清晰呈现全部参与者**；③ 提供"**我的任务**"视图/筛选，使参与者能聚焦并直接完成指派给自己的任务。数据模型与后端数组结构已就绪，**本次重点在前端多选交互与"我的任务"过滤的打通**，属低数据结构风险的体验型增量。

---

## 2. 现状确认（基于代码走查，非凭空设计）

| 层面 | 文件:`行` | 现状事实 | 多参与者支持 | 缺口 |
|---|---|---|---|---|
| 数据模型 | `server/models/Task.js:53-56` | `assignedTo` 已是 `[ObjectId ref User]` 数组；另有 `responsiblePerson`(String 文本兜底)、`status`/`completedDate`/`createdBy` | ✅ 已支持 | 缺 `assignedTo` 查询索引（"我的任务"性能） |
| 列表接口 | `server/routes/tasks.js:13-55` | `GET /` 默认返回 scope 全部任务；`?assignedTo=X` 支持但**原样赋值**（未把 `me` 转当前用户，且用等值非 `$in`） | ⚠️ 部分 | 需支持 `assignedTo=me`（→`req.user._id`）与多值 `$in` |
| 创建接口 | `server/routes/tasks.js:89-108` | `POST /` 直接接收 `req.body.assignedTo` 数组，自动写 `createdBy` | ✅ 已支持 | 无 |
| 更新/完成 | `server/routes/tasks.js:113-163` | `PUT /:id` **任意登录用户均可**改 `status=completed`（无参与者/创建者校验）；`signing`/`document_review` 需 `hasAttachment` 门禁 | ⚠️ 过宽 | 完成权限语义待收窄（见 §4 P0-3 / §6 Q1） |
| 前端列表 | `client/src/pages/Tasks.jsx:55-62` | 已能渲染多参与者（`task.assignedTo.map(a=>a.name).join(', ')`）；有快捷完成按钮 | ✅ 已支持 | 无"我的任务"切换；`fetchTasks()` 未传过滤参数 |
| 前端表单 | `client/src/components/TaskForm.jsx:35,89,147-152` | 参与者为**单选 `<select>`**；`handleSubmit` 仅取首个 id 包成单元素数组；无 `responsiblePerson` 字段 | ❌ 单参与者 | 需改为多选用户控件 |
| 服务层 | `client/src/services/index.js:338-341` | `taskService.getAll(params)` 已支持传 query 参数 | ✅ 已支持 | 无（待页面传参） |

**核心结论**：模型与后端数组结构已就绪；**唯一实质前端缺口是 `TaskForm` 的单选参与者控件**；后端需小幅增强 `assignedTo` 过滤（`me`/`$in`）与完成权限语义确认。

> 附带观察（非本次范围，单列 Bug）：`TaskForm` 的 `TASK_TYPES`（`meeting_prep`/`document`/`follow_up`）与 `Task` 模型枚举（`meeting_preparation`/`document_review`/`signing`/`results_timetable`）不一致，影响 `signing`/`document_review` 的附件完成门禁判定。建议另开修复，本增量不动。

---

## 3. 用户故事（增量相关）

| ID | 角色 | 诉求 | 价值 |
|---|---|---|---|
| US1 | 任务创建者 | 创建/编辑任务时能勾选**多名参与者**（从 User 列表多选 `assignedTo`） | 同一任务可指派给团队多人 |
| US2 | 参与者 | 在任务列表/详情看到**所有参与者名字** | 知道谁和自己一起负责 |
| US3 | 参与者 | 有"**我的任务**"视图/筛选（仅显示指派给我的任务） | 专注自己的任务，不被 scope 内他人任务淹没 |
| US4 | 参与者 | 在"我的任务"里直接标记完成，且**任一参与者标记完成即整体完成**（不需其他人/创建者确认） | 高效闭环，符合决策 #2 |
| US5 | 创建者/管理员 | 可**批量编辑**任务参与者（增删）而不必重建任务 | 减少重复操作 |

---

## 4. 需求池（仅增量部分）

### P0 — 必须（本次交付核心）

| ID | 需求 | 说明 | 验收标准 |
|---|---|---|---|
| **P0-1** | 前端创建/编辑任务支持**多选参与者** | `TaskForm` 将单选 `<select>` 改为多选 User 控件（勾选 `assignedTo` 数组）；提交时直接传数组（去掉"仅取首个"逻辑）；`TaskForm` 被 Tasks 页与公司工作台复用，两处同步受益 | 创建任务可选 ≥0 个用户；提交 payload 含 `assignedTo:[id1,id2,...]`；保存后列表/详情显示全部参与者 |
| **P0-2** | "**我的任务**"视图/筛选 | Tasks 页提供"全部 / 我的"切换；选"我的"时调用 `GET /api/tasks?assignedTo=me` | "我的"仅返回 `assignedTo` 含当前用户的任务；仍是 scope 可见的**子集**（决策 #3 不变） |
| **P0-3** | 完成权限语义确认与落地 | 明确"任一参与者可完成"边界；**建议收窄为"至少是指派参与者或创建者或 admin 可完成"**，替换当前"任意登录用户均可完成" | `PUT /:id` 增加校验；非授权用户完成返回 `403`；`signing`/`document_review` 附件门禁保留 |
| **P0-4** | 后端 `assignedTo` 过滤增强 | `GET /` 支持 `assignedTo=me`（→`req.user._id`）与逗号分隔多值（`$in`）；保持 `applyListScope` 行级过滤 | 过滤结果正确；scope 外公司任务仍被拦截 |

### P1 — 应当

| ID | 需求 | 说明 |
|---|---|---|
| **P1-1** | 参与者姓名清晰展示 | 列表已支持；增强为可点击/头像展示，突出多参与者 |
| **P1-2** | 任务详情页参与者区 | `GET /:id` 已 `populate assignedTo(name/email/phone)`，前端详情页渲染"参与者"区块 |
| **P1-3** | 批量编辑参与者 | 编辑弹窗支持增删参与者（复用 P0-1 多选控件） |
| **P1-4** | `assignedTo` 索引 | 模型层 `taskSchema.index({ assignedTo: 1 })`（非破坏性、可累加），支撑"我的任务"查询性能 |

### P2 — 可选

| ID | 需求 | 说明 |
|---|---|---|
| **P2-1** | 完成通知/动态 | 任一参与者完成 → 给其余参与者/创建者推送通知或写入 notes/动态 |
| **P2-2** | 移动端适配 | "我的/全部"切换与多选控件在移动端可用 |
| **P2-3** | 无账号负责人兜底 | `responsiblePerson` 文本在表单可见可填（与 `assignedTo` 并存或互斥提示） |

---

## 5. UI 设计稿描述

### 5.1 创建/编辑任务弹窗 — 参与者控件（变更点）

```
┌───────────────────────────────────────────────────────────┐
│  New Task / Edit Task                                      │
├───────────────────────────────────────────────────────────┤
│  Task Title            [ File annual return            ]   │
│  Description           [ Additional details...         ]   │
│  Type        [ other ▾ ]  Priority [ medium ▾ ]            │
│  Status      [ pending ▾ ]  Due Date [ 2026-09-30  ]       │
│  关联公司     [ Acme Holdings ▾ ]                            │
│  关联会议     [ Board Meeting Q3 ▾ ]                        │
│  参与者 *    ┌─────────────────────────────────────────┐   │
│  (多选)      │ ☑ 张秘书 (secretary)                    │   │
│              │ ☑ 李CFO   (manager)                     │   │
│              │ ☐ 王专员 (viewer)                       │   │
│              │ ☑ 陈会计 (manager)                       │   │
│              │ 已选 3 人 ✕ 清除                        │   │
│              └─────────────────────────────────────────┘   │
│              （原：单选 <select> → 改为可勾选用户列表）    │
├───────────────────────────────────────────────────────────┤
│                       [ Cancel ]  [ Save Task ]            │
└───────────────────────────────────────────────────────────┘
```
> 注：`assignedTo` 提交时直接传所选 User 的 `_id` 数组；`responsiblePerson` 文本兜底（如 P2-3 采纳）作为并行可选输入。

### 5.2 任务列表 — "全部 / 我的" 切换

```
┌───────────────────────────────────────────────────────────┐
│  Tasks                                  [ + New Task ]      │
├───────────────────────────────────────────────────────────┤
│  [ Search...        ]  [ All Status ▾ ] [ All Priority ▾ ]  │
│                                                           │
│  ( 全部 )  ( 我的任务 )   ← 分段切换（新增）               │
│  ─────────────────────────                                │
│  ┌─ ☑ [File annual return]  urgent  pending  3d remaining ┐│
│  │   Acme Holdings  | 张秘书, 李CFO, 陈会计               ││
│  │                              [ 标记完成 ]              ││
│  └────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────┘
```
> "我的任务" 激活时：前端调用 `taskService.getAll({ assignedTo: 'me' })`，仅展示指派给当前登录用户的任务。

### 5.3 任务详情 — 参与者区（新增区块）

```
┌───────────────────────────────────────────────────────────┐
│  File annual return                              [编辑][删除]│
│  urgent · pending · Due 2026-09-30                          │
├───────────────────────────────────────────────────────────┤
│  参与者（3）                                                │
│   ● 张秘书  secretary   zhang@acme.com                     │
│   ● 李CFO    manager     li@acme.com                       │
│   ● 陈会计  manager     chen@acme.com                      │
├───────────────────────────────────────────────────────────┤
│  关联公司：Acme Holdings   关联会议：Board Meeting Q3       │
│  创建人：王专员                                             │
└───────────────────────────────────────────────────────────┘
```

### 5.4 "我的任务" 数据流（Mermaid）

```mermaid
flowchart LR
  A[Tasks 页: 切到“我的任务”] --> B[taskService.getAll({assignedTo:'me'})]
  B --> C[GET /api/tasks?assignedTo=me]
  C --> D[后端识别 me → req.user._id 并 $in]
  D --> E[applyListScope 行级过滤]
  E --> F[返回 assignedTo 含当前用户的任务]
  F --> G[列表渲染“我的任务”子集]
```

---

## 6. 待确认问题（需用户 / 架构师拍板）

| # | 问题 | 我的建议 |
|---|---|---|
| **Q1** | **完成权限是否收窄？** 当前 `PUT /:id` 允许 scope 内任意登录用户完成。决策 #2 说"任一参与者可完成"，是否据此**收窄为"至少参与者/创建者/admin 可完成"**？ | **建议采纳收窄**：维持决策 #3 的可见性（人人可见），但完成权限限定为参与者/创建者/admin，以保留合规审计责任链；替换当前过宽的"任意人可完成"。需用户确认是否采纳，或维持现状。 |
| **Q2** | `assignedTo=me` 由谁翻译？ | 建议**后端**在 `GET /` 中识别 `me` 关键字替换为 `req.user._id`（前端不传真实 id，更安全）。需架构师确认实现位置。 |
| **Q3** | 无 User 账号的负责人（`responsiblePerson` 文本）如何处理？① 表单是否暴露该输入？② `assignedTo` 为空仅 `responsiblePerson` 有值时，完成权限如何判定（无 User 可校验）？ | 建议：`responsiblePerson` 仅作**展示兜底**；完成权限基于 `assignedTo`/创建者/admin；若 `assignedTo` 与 `responsiblePerson` 皆空，允许创建者/admin 完成。 |
| **Q4** | 类型枚举不一致（form vs model，见 §2 附带观察）是否顺带对齐？ | 建议**本增量不动**，单列 Bug 修复，避免扩大范围。 |
| **Q5** | 移动端是否纳入本期？ | 影响 P2-2；若纳入需额外排期。 |
| **Q6** | 完成权限收窄后，是否需记录"谁完成了任务"供审计？ | 建议模型加 `completer` 字段（P1 可选），与 `completedDate` 并存，完善审计轨迹。 |

---

## 7. 影响面评估

| 模块 | 文件 | 改动类型 | 说明 |
|---|---|---|---|
| 前端-表单 | `client/src/components/TaskForm.jsx` | **改写** | 单选→多选参与者控件；提交直接传数组（去"仅取首个"）；公司工作台复用同步受益 |
| 前端-列表页 | `client/src/pages/Tasks.jsx` | **改写** | 增加"全部/我的"分段切换；`fetchTasks` 支持传参；"我的"调用 `assignedTo=me` |
| 前端-详情页 | 任务详情组件/路由 | 小改 | 渲染"参与者"区块（需确认详情页具体文件，推测为 `TaskDetail` 或内嵌） |
| 前端-服务层 | `client/src/services/index.js` | **无需改** | `getAll(params)` 已支持 query 参数 |
| 后端-路由 | `server/routes/tasks.js` | **小改** | `GET /` 增加 `assignedTo=me`/`$in` 翻译；`PUT /:id` 增加完成权限校验（Q1） |
| 后端-模型 | `server/models/Task.js` | 极微小改 | 建议加 `taskSchema.index({ assignedTo: 1 })`（非破坏性）；可选加 `completer` 字段（Q6） |
| 签署任务表单 | `client/src/components/SignTaskForm.jsx` | 暂不涉及 | 独立组件；本增量聚焦 `TaskForm`（一般任务 + 经 TaskForm 的签署入口）。如签署任务也需多参与者，建议后续统一 |
| 测试 | `server/tests/*` | 新增 | `assignedTo` 过滤、`me` 翻译、完成权限用例 |

**预估工作量**：前端 2 文件改写 + 后端 1 路由小改 + 模型索引，约 **2–3 天**（不含测试与文档）。**`Task` 模型核心结构不动**（`assignedTo` 已是数组），数据结构风险低。

---

## 8. 核心结论摘要（供主理人）

1. **数据结构零改动**：`Task.assignedTo` 已是 `User` 数组，后端 `POST` 已收数组、`GET` 已支持 `assignedTo` 过滤——本次**后端模型基本不动**，风险集中在前端交互与两处后端小增强。
2. **唯一实质前端缺口**：`TaskForm` 当前是**单选 `<select>`** 且提交时只取首个 id，**改造成多选取是 P0 核心**。
3. **"我的任务"可行且低成本**：服务层 `getAll(params)` 已就绪，仅需页面加"全部/我的"切换 + 后端把 `assignedTo=me` 翻译为当前用户（`$in`）。
4. **完成权限建议收窄**：当前"scope 内任意登录用户可完成"比决策 #2（任一参与者可完成）更宽，建议收窄为"参与者/创建者/admin 可完成"以保审计责任链——**列为 Q1 待用户拍板**。
5. **可见性不变**：严格遵循决策 #3，"我的任务"仅是 scope 全可见之上的**子集筛选**，不引入权限收紧。
