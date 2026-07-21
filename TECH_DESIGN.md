# TECH_DESIGN.md — v5.0 中央数据库 / 读时聚合 设计冻结

> 状态：**FROZEN（冻结）** ｜ 生效日期：2026-07-14 ｜ 负责人：后端架构师
> 适用范围：Claw 全部服务端模型、路由、前端聚合视图。本文件为强制契约，所有 PR 须与其一致。

---

## 0. 一句话原则

**`Company.links[]` 是「人↔公司任职关系」的唯一事实源；任何通过 `Personnel` 读数得到的任职关系，都是在读时从 `Company.links` 派生（聚合）出来的，永不存储副本。**

> 即：**写只写一处（Company.links），读可在多处聚合。** 不存在 `Personnel.appointments` 的写操作。

---

## 1. 废除项（硬性禁令）

| 废除 | 说明 |
|------|------|
| `Personnel.appointments` 写操作 | `Personnel` 模型**已无** `appointments` 字段（v5.0 改造删除）。任何 `Personnel.findByIdAndUpdate({ $push: { appointments } })` 类代码一律禁止。 |
| 在 `companies.js` / `companyEntries.js` 反向写 `Personnel` | 这两处 links 的增删改**只写 `Company.links`**，已确认无回写 Personnel 的逻辑（见 §5 核查）。 |
| `SignTask.signer` 指向 `Director` | 已统一为 `Personnel`（详见 §3）。`Director` 模型为遗留，见 §6。 |

> 允许的例外：`Personnel.roles`（`$addToSet: { roles }`）是**只读缓存标签**，用于前端快速过滤；它不是任职关系真相，真相应从 `Company.links.roles` 读时派生。`roles` 缓存可随时由 `Company.links` 重建。

---

## 2. 数据模型终稿（Schema）

### 2.1 Company.links[]（唯一事实源）
```js
{
  linkModel: 'Personnel' | 'Company',   // 关联对象类型
  link: ObjectId,                        // 指向 Personnel 或 Company
  roles: ['director'|'secretary'|'shareholder'|'company_secretary'|...],
  shares, shareType,
  appointmentDate, cessationDate,
  shareRecords: [],
  formerNameOrAlias, documentServiceAddress, usualResidentialAddress
}
```

### 2.2 Task（已加 `personnel` 引用 + 索引）
```js
{
  company:   ObjectId ref Company,      // 原有
  meeting:   ObjectId ref Meeting,      // 原有
  personnel: ObjectId ref Personnel,    // ✅ v5.0 新增：以人为中心的任务聚合键
  assignedTo:[ObjectId ref User],       // 执行人（系统用户）
  ...
}
// 索引：company / personnel / meeting / dueDate / status
```

### 2.3 SignTask（signer 已统一 Personnel + 新增 meeting 引用）
```js
{
  document: ObjectId ref Document,       // 必填
  company:  ObjectId ref Company,
  meeting:  ObjectId ref Meeting,        // ✅ v5.0 新增：签署并入会议
  signers: [{
    signer: ObjectId ref Personnel,      // ✅ 原 ref Director → 已改为 Personnel
    signerName, signerEmail,             // 便于列表展示的冗余拷贝
    status, signedAt, signatureData, ...
  }],
  ...
}
// 索引：company / meeting / document / status
```

### 2.4 其他实体（引用关联范式，无需改 Schema）
- `Meeting.company` / `Meeting.attendees[]` → 引用 Company / Personnel
- `Document.company` / `Document.personnel` + `expiresAt`（文件有效期已有字段，前端直接读）
- `ComplianceReminder.company` / `ComplianceReminder.personnel`
- 以上均已满足「单一写、读时聚合」。

---

## 3. 关系查询方式（读时聚合 — 核心）

**规则：所有关联视图的查询都是"按引用 ID 在对应集合过滤"，不做 N×N 物化同步。**

| 视角 | 数据 | 查询方式（Controller） |
|------|------|------------------------|
| **公司视角** | 任职人员 + 角色 | 直接读 `Company.links`（含 roles），按 `linkModel` 分 Personnel/Company |
| 公司视角 | 关联文档 | `Document.find({ company })` |
| 公司视角 | 关联会议 | `Meeting.find({ company })` |
| 公司视角 | 合规提醒 | `ComplianceReminder.find({ company })` |
| 公司视角 | 关联任务 | `Task.find({ company })` → **即 `getByCompany`** |
| 公司视角 | 签署任务 | `SignTask.find({ company })` |
| **人视角** | 任职公司 + 角色 | 读时聚合：`Company.find({ 'links.link': personnelId, 'links.linkModel': 'Personnel' })`，取 `links.roles` —— 即"反向 links"（reverse-links）。**不读 Personnel.appointments** |
| 人视角 | 关联任务 | `Task.find({ personnel })` → **即 `getByPersonnel`** |
| 人视角 | 关联文件 | `Document.find({ personnel })` |
| 人视角 | 关联会议 | `Meeting.find({ attendees: personnelId })` |
| 人视角 | 合规提醒 | `ComplianceReminder.find({ personnel })` |
| **会议视角** | 关联签署 | `SignTask.find({ meeting })` → **即 `getByMeeting`** |

### 参数契约（前端 ↔ 后端）
- 列表接口用 **query 参数**过滤，兼容别名：
  - 公司：`company` 或 `companyId`
  - 人：`personnel` 或 `personnelId`
  - 会议：`meeting` 或 `meetingId`
- 响应统一 `populate` 出名称字段（company/personnel/meeting 各填 `name`/`title`），避免前端二次查。

---

## 4. 写入口约定（单一写入口）

| 关系变更 | 唯一写入点 | 说明 |
|----------|-----------|------|
| 新增/改/删 任职 | `POST/PUT/DELETE /api/companies/:id/links` | 仅写 `Company.links` |
| 合并人员 | `POST /api/personnel/merge` | 用 `Company.updateMany` 把 `links.link` 从 source 指向 target（重指单一事实源） |
| 任务 | `POST/PUT /api/tasks` | 写自身集合 + `personnel`/`company` 引用 |
| 签署任务 | `POST/PUT /api/sign-tasks` | 写自身集合 + `meeting`/`company`/`signers[].signer` |

> 所有写操作各写各的集合（一次原子写，无需跨集合事务）。一致性由"引用 ID 唯一 + 读时聚合"保证，无需补偿/回滚。

---

## 5. 已核查（v5.0 改造现状）

- ✅ `server/routes/companies.js` links CRUD：仅写 `Company.links`，无回写 Personnel。
- ✅ `server/routes/companyEntries.js`：仅 `$addToSet: { roles }` 缓存标签 + 同步一条 Company.links，无 appointments 写。
- ✅ `server/models/Personnel.js`：已无 `appointments` 字段。
- ✅ `Task.personnel` / `SignTask.meeting` / `SignTask.signers.signer→Personnel`：已落地。
- ✅ 索引：`Task`、`SignTask` 均已补聚合索引。
- ✅ Controller：`tasks` 支持 companyId/personnelId；`signTasks` 支持 meetingId/companyId。

---

## 6. 已知遗留项（不在本期，记录待办）

- `server/models/Director.js`（含 `appointments` 旧结构）仍被 `templates.js`、`documents.js` 引用。
  后续迁移：移除 Director 引用 → 统一走 `Personnel` + `Company.links`；删除 Director 模型。
  当前不影响读时聚合（signer 已改 Personnel），列为独立迁移任务。

---

## 7. 前端聚合视图落地映射（供前端团队）

| 页面 | 调用 |
|------|------|
| CompanyDetail | companyService.getById + documents.getByCompany + meetings.getByCompany + complianceReminders.getByCompany + tasks.getByCompany + signTasks.getByCompany |
| PersonnelDetail | personnelService.getById + **reverse-links**（公司/角色）+ tasks.getByPersonnel + documents.getByPersonnel + meetings.getByPersonnel + complianceReminders.getByPersonnel |
| MeetingDetail | meetingService.getById + signTasks.getByMeeting（签署 tab） |

> 本期不做复杂 `$lookup` 聚合管道；先以"按引用 ID 过滤 + populate"保证 API 可用，后续性能优化再引入 `$lookup` / 物化缓存。

---

## 8. v5.2 增量变更（2026-07-20，叠加于冻结设计之上）

以下变更**不违反** §0 单一写原则，均为读/暂存/前端体验层增强。

### 8.1 会议全生命周期闭环
- 流程：通知 → 附件 → 纪要 → 签字 → 归档。
- **暂存池**：`Document.staged: true` 表示暂存于会议子目录（签字扫描件、其他资料），`documents` 路由列表默认排除 staged。
- **归档**：批量将 staged 文档移库到公司库 + 自动重命名 `[日期] 公司_类型_来源.pdf` + 锁定只读（`isArchived` 标记，UI 显示已归档印章、禁用编辑）。
- 关键词检测 `detectMinutesKeywords` 自动生成签署 Task 并关联 `meetingId`。

### 8.2 签署任务双来源（Task）
```js
{
  taskSource: 'meeting' | 'dashboard',   // v5.2 新增：来源区分
  isCTC: Boolean,                         // v5.2 新增：是否合规文本(CTC)
  meeting: ObjectId ref Meeting,          // 仅 meeting 来源有
}
```
- 签署完成：来源为 meeting → 扫描件建 `staged:true` 暂存会议，待会议最终归档进公司库；来源为 dashboard → 直接归档公司库（命名 `(ctc)`/`(signed).pdf`）。
- 来源标签路由：`dashboard_sign` → `/tasks`，`signing_scan` → `/meetings`。

### 8.3 文档到期与筛选
- `Document.expiresAt` 驱动到期徽章：`docExpiryStatus` / `DOC_EXPIRY_BADGE`（utils/helpers）。
- CompanyDetail 多级筛选：大类 → 子类型 → 年份（前端本地筛选，非后端）。

### 8.4 前端设计令牌 + 暗色模式
- 全站统一令牌：`--bg`/`--surface`/`--text-*`/`--border`/`--c-*` + Tailwind `bg-canvas`/`border-hairline`/`text-ink-*`。
- `ThemeContext` 读 `claw-theme` 单一事实源，`.dark` 切换；Navbar 暗色开关走 `useTheme()`。
- ⚠️ 改 `tailwind.config.js` 后必须重启 vite dev（否则白屏）。

### 8.5 全文搜索索引
- `server/searchIndexes.js` `ensureSearchIndexes()` 对 Company / Personnel / Document / Meeting / Task / ComplianceReminder 6 集合建 `$text` 索引（防御式 try/catch，连接成功后调用）。

### 8.6 已修正的遗留项（相对 §6）
- ✅ **Director 模型已删除**（2026-07-15）：`migrate-v5.js` 改走 raw collection 读旧 `directors` 集合，不再依赖模型。
- ✅ 前端 Directors 页面已移除，统一入口为 Personnel。
- ⏸ **legacy 数据迁移 `--apply` 待执行**（见 MIGRATION.md 第 5 步）：`directors` / `shareholderentries` / `directorentries` 三集合数据待合并进 Personnel + Company.links。当前读时聚合已兼容，但旧集合未清空。
