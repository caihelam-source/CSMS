# Claw v4.0 整改报告

**生成时间**: 2026-07-06  
**报告人**: 主理人齐活林  
**状态**: 逐条审核，待实施

---

## 整改总览

| # | 用户痛点 | 当前状态 | 整改优先级 | 预计工时 |
|---|---------|---------|-----------|---------|
| 1 | Dashboard 合规提醒不可点击跳转 | ❌ 未实现 | P0 | 2h |
| 2 | Meetings 点击后页面空白 | ❌ 路由缺失 MeetingDetail | P0 | 4h |
| 3 | 合规提醒完成机制不严格 | ❌ 直接勾选即可 | P0 | 3h |
| 4 | Documents 页面功能缺失 | ⚠️ 仅有基础CRUD，无分类/编号/批量下载 | P0 | 6h |
| 5 | 公司页面文档分类混乱 | ❌ 无任何分类体系 | P1 | 4h |
| 6 | Dashboard 缺乏实际价值 | ⚠️ 有提醒但无关联 | P0 | 4h |
| 7 | 缺少公司架构穿透功能 | ❌ 完全未实现 | P1 | 8h |
| 8 | 底层数据库多表关联不够紧密 | ⚠️ 已有links但关联不足 | P2 | 6h |

---

## 问题 #1: Dashboard 合规提醒不可点击跳转

### 现状
`client/src/pages/Dashboard.jsx` 第115-133行，合规提醒列表仅为静态展示：

```jsx
<div key={r._id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
  {/* 没有 Link 包裹，无法点击 */}
</div>
```

### 问题分析
- 合规提醒没有关联 Task ID（模型中缺少 `taskId` 字段）
- 点击后无法跳转到对应的 Task 详情页

### 整改措施
1. **后端模型扩展** (`server/models/ComplianceReminder.js`):
   - 新增字段 `taskId: { type: Schema.Types.ObjectId, ref: 'Task' }`
2. **后端模型扩展** (`server/models/Task.js`):
   - 新增字段 `reminderId: { type: Schema.Types.ObjectId, ref: 'ComplianceReminder' }`
   - 新增字段 `attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }]`
3. **前端 Dashboard 改造** (`client/src/pages/Dashboard.jsx`):
   - 将合规提醒列表项包裹在 `<Link>` 中，跳转到 `/tasks/:taskId`
   - 如果未关联 Task，跳转到 `/compliance-reminders/:reminderId`
4. **服务层扩展** (`client/src/services/index.js`):
   - `complianceReminderService` 新增 `getByTask(taskId)` 方法

### 验收标准
- [ ] Dashboard 合规提醒列表每一项都可点击
- [ ] 点击后跳转到对应 Task 详情页
- [ ] Task 详情页展示关联的合规提醒

---

## 问题 #2: Meetings 页面点击进入空白

### 现状
`client/src/App.jsx` 中路由配置：
```jsx
<Route path="meetings" element={<Meetings />} />
<Route path="meetings/:id" element={<Meetings />} />  {/* 不存在！ */}
```

`client/src/pages/Meetings.jsx` 第62-66行有 detailId/detailMeeting 状态，使用 Modal 展示详情，但 **没有独立的 MeetingDetail 页面**。

### 问题分析
1. 用户从 Dashboard 点击会议链接 `/meetings/:id` 时，App.jsx 没有匹配到该路由
2. Meetings.jsx 虽然内部实现了 Modal 详情页，但需要直接访问 `/meetings` 才能看到列表

### 整改措施
1. **创建独立 MeetingDetail 页面** (`client/src/pages/MeetingDetail.jsx`):
   - 从 Meetings.jsx 中提取 Modal 详情视图为独立组件
   - 支持直接访问 `/meetings/:id`
   - 包含：概览、会议通知、会议纪要、签署状态四个 Tab
2. **更新路由** (`client/src/App.jsx`):
   ```jsx
   <Route path="meetings" element={<Meetings />} />
   <Route path="meetings/:id" element={<MeetingDetail />} />
   ```
3. **Dashboard 修复**:
   - Dashboard.jsx 中会议链接已正确设置 `to={`/meetings/${m._id}`} `
   - 需将 `/meetings/:id` 路由指向新 MeetingDetail 页面
4. **签署流程增强** (`client/src/pages/MeetingDetail.jsx`):
   - 纪要签署后需提供"上传签字扫描件"入口
   - 扫描文件自动归档到关联公司的文档库
   - 会议状态变为 completed 后，生成 Task 并自动归档文档

### 验收标准
- [ ] 访问 `/#/meetings` 显示会议列表
- [ ] 访问 `/#/meetings/:id` 显示会议详情（不再空白）
- [ ] 点击 Dashboard 会议链接可正确跳转
- [ ] 会议纪要签署后可上传签字扫描件
- [ ] 签字扫描件自动归档到公司文档库

---

## 问题 #3: 合规提醒完成机制不严格

### 现状
`client/src/pages/ComplianceReminders.jsx` 第367-377行：

```jsx
<Modal isOpen={modal === 'complete'} title="标记为已完成" size="sm">
  <p>确认将 {editTarget?.title} 标记为已完成？</p>
  {/* 没有任何文件上传或备注校验 */}
  <button onClick={handleComplete}>确认完成</button>
</Modal>
```

### 问题分析
- 点击"确认完成"按钮直接标记状态为 completed，无需上传文件或添加备注
- 后端 API `POST /api/compliance-reminders/:id/complete` 也没有要求附件

### 整改措施
1. **前端 ComplianceReminders.jsx**:
   - 完成 Modal 中新增文件上传组件
   - 新增备注文本框（必填）
   - 只有上传文件 **或** 填写备注后，"确认完成"按钮才可点击
   - 上传的文件自动关联为 Document，绑定到对应 company
2. **后端 ComplianceReminder 模型** (`server/models/ComplianceReminder.js`):
   - 新增 `attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }]`
   - 新增 `completionNotes: String`
3. **后端 API** (`server/routes/compliance-reminders.js`):
   - `markCompleted` 接口增加 body 参数校验：`attachments` 或 `notes` 至少一个非空

### 验收标准
- [ ] 点击"标记完成"弹出确认框时，需选择文件或填写备注
- [ ] 未选择文件也未填写备注时，"确认完成"按钮禁用
- [ ] 上传的文件自动关联到对应的公司
- [ ] 后端 API 校验通过后才允许标记完成

---

## 问题 #4: Documents 页面功能缺失

### 现状
`client/src/pages/Documents.jsx` 当前实现：
- 只有简单的列表展示、搜索、类型筛选
- 无分类体系
- 无文档编号系统
- 无批量选择/打包下载
- 无版本控制

### 整改措施
1. **扩展 Document 模型** (`server/models/Document.js`):
   ```js
   category: { 
     type: String, 
     enum: ['establishment', 'government', 'financial', 'banking', 'other'],
     default: 'other'
   }
   docNumber: { type: String, unique: true, sparse: true } // 文档编号
   parentId: { type: Schema.Types.ObjectId, ref: 'Document' } // 版本控制
   tags: [String] // 标签
   ocrText: { type: String } // OCR识别文本（用于搜索）
   ```
2. **前端 Documents.jsx 重构**:
   - 新增分类选择器（成立文件/政府文件/财务税务/银行文件）
   - 新增文档编号显示列（自动生成格式：`DOC-{公司简称}-{类型缩写}-{年月}-{序号}`）
   - 新增批量选择（checkbox列表）+ 批量下载按钮
   - 新增按公司筛选、按年份筛选
   - 上传弹窗增加分类字段
3. **后端 API**:
   - `GET /api/documents/:id/download/batch` 批量下载
   - `POST /api/documents/generate-number` 自动生成文档编号

### 验收标准
- [ ] Documents 页面显示分类筛选下拉框
- [ ] 文档列表显示编号列
- [ ] 每个文档可勾选
- [ ] 勾选多个文档后可点击"打包下载"
- [ ] 上传时可选择分类（成立文件/政府文件/财务/银行）
- [ ] 文档编号自动生成

---

## 问题 #5: 公司页面文档分类混乱

### 现状
`client/src/pages/CompanyDetail.jsx` 第450-482行，Documents Tab 只是简单列表展示：

```jsx
{activeTab === 'documents' && (
  <div className="space-y-4">
    <h2>关联文件</h2>
    {/* 无分类、无编号、无搜索 */}
    {documents.map(doc => (
      <div key={doc._id}>{doc.name}</div>
    ))}
  </div>
)}
```

### 整改措施
1. **CompanyDetail.jsx Documents Tab 重构**:
   - 增加左侧分类侧边栏（展开/折叠式树形结构）
   - 分类结构：
     ```
     📁 成立文件 (4)
       ├── 公司注册证书 (COI)
       ├── 公司章程 (MoA/AoA)
       ├── 商业登记证 (BR)
       └── NR1 表格
     📁 政府文件 (3)
       ├── 年申报表 (AR)
       ├── 新周年通知书 (ND)
       └── 股权转让通知 (RR1)
     📁 财务税务文件 (2)
       ├── 年度财务报表
       └── 税务申报
     📁 银行文件 (1)
       └── 银行账户开设文件
     ```
   - 每类文档显示数量徽章
   - 点击分类只展示该类文档
   - 支持按文件类型排序（按日期、按名称、按大小）

2. **上传按钮增强**:
   - 在公司文档 Tab 中增加"上传文件"按钮
   - 上传弹窗新增分类选择

### 验收标准
- [ ] 公司详情页 Documents Tab 显示分类侧边栏
- [ ] 点击分类可筛选显示对应文档
- [ ] 每类文档数量准确显示
- [ ] 上传文件时可指定分类

---

## 问题 #6: Dashboard 缺乏实际价值

### 现状
Dashboard 目前有统计卡片的6项数据，但：
- "签署任务"和"模板"显示固定值 0
- 合规提醒只是列表，无紧迫感排序
- 没有关联 Task 的到期提醒
- 没有未完成合规任务的逾期告警

### 整改措施
1. **Dashboard 全面重构** (`client/src/pages/Dashboard.jsx`):
   
   **新布局**（从上到下）：
   - **紧急提醒区**（顶部红色横幅）：展示所有已逾期或3天内到期的合规 Task
   - **统计卡片**（6项）：修复签署任务和模板计数
   - **合规提醒**（可点击，跳转到 Task/Reminder 详情）
   - **即将召开的会议**（可点击跳转）
   - **最近完成的会议**（显示签署状态）
   - **最近活动**（上传文件、完成 Task 等）

2. **后端统计 API 增强**:
   - `GET /api/companies/stats/dashboard`:
     ```js
     {
       totalCompanies, totalPersonnel, totalDocuments,
       totalMeetings, totalTasks, totalPendingTasks,
       expiredReminders: [], upcomingReminders: [],
       recentActivities: [],
       totalTemplates, totalSignTasks
     }
     ```

3. **修复现有功能**:
   - `signTaskService.getAll()` 返回正确的数量
   - `templateService.getAll()` 返回正确的数量
   - complianceReminderService 增加 overdue 统计数据

### 验收标准
- [ ] Dashboard 顶部有紧急提醒横幅（逾期 Task）
- [ ] 统计卡片数据准确（签署任务、模板等非零值）
- [ ] 合规提醒可点击跳转到 Task/Reminder
- [ ] 会议可点击跳转到 MeetingDetail

---

## 问题 #7: 缺少公司架构穿透功能

### 现状
当前公司数据模型不支持多层股权关系：
- `Company.links` 只能关联 Personnel/Company，但没有 parentCompanyId
- 没有股权穿透可视化页面

### 整改措施
1. **后端 Company 模型扩展** (`server/models/Company.js`):
   ```js
   parentCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' }
   equityLevel: { type: Number, default: 1 }
   equityPercentage: { type: Number } // 持股比例
   ```

2. **新建 EquityGraph 页面** (`client/src/pages/EquityGraph.jsx`):
   - 树形/图谱形式展示公司层级关系
   - 支持勾选多个"顶层公司"，展示其完整的股权结构
   - 点击节点可查看该公司详情（跳转）
   - 每层显示：股权比例、持股数量、股东名称、董事信息
   - 使用 Mermaid 或纯 SVG 绘制

3. **后端 API**:
   - `GET /api/companies/equity-graph/:companyId` 返回某公司完整股权树
   - `POST /api/companies/query-structure` 支持多选公司查询

4. **导航栏新增入口**:
   - `Navbar.jsx` 中增加"架构图"菜单项
   - 放置在公司管理区

### 验收标准
- [ ] 新增"架构图"页面可访问
- [ ] 输入公司名称可展示其完整股权结构
- [ ] 支持多层股权穿透（至少5层）
- [ ] 每层显示股东、股权比例、董事信息
- [ ] 可从架构图点击跳转到公司详情页

---

## 问题 #8: 底层数据库多表关联不够紧密

### 现状
当前已有：
- `Company.links` — 公司到人员/公司的多态关联
- `Personnel.appointments` — 人员在各公司的任职记录
- `Document.company` / `Document.personnel` — 文档到公司/人员的关联

但还有改进空间：

### 整改措施
1. **Document → Task 关联**:
   - `Document.model` 新增 `relatedTaskId: { type: Schema.Types.ObjectId, ref: 'Task' }`
   - 上传文件时可选关联 Task（自动完成该 Task）

2. **ComplianceReminder → Document 自动关联**:
   - 完成合规提醒时自动上传的文档，反向关联回 Reminder
   - `ComplianceReminder.attachments` 已在问题#3中提到

3. **统一搜索**:
   - 支持通过公司名称/人名搜索关联的所有文档、Task、会议
   - `GET /api/search?q=关键词&type=document|task|meeting`

4. **交叉索引视图**:
   - PersonnelDetail 页面显示该人员关联的所有公司文档
   - CompanyDetail 页面显示该公司的所有关联 Task

### 验收标准
- [ ] 上传文件时可关联到 Task
- [ ] 通过统一搜索可找到跨实体的相关记录
- [ ] 人员详情页显示关联的所有公司文档
- [ ] 公司详情页显示关联的所有 Task

---

## 实施计划

### Phase 1 — P0 核心功能修复（预计 16h）
1. Dashboard 合规提醒 → Task 跳转 + Dashboard 重构 (#1, #6)
2. Meetings 页面空白修复 + 独立 MeetingDetail 页面 (#2)
3. 合规提醒完成机制 — 文件/备注强制关联 (#3)
4. Documents 页面 — 分类 + 编号 + 批量下载 (#4)

### Phase 2 — P1 功能增强（预计 12h）
5. CompanyDetail Documents Tab — 分类侧边栏 (#5)
6. 公司架构图 EquityGraph 页面 (#7)

### Phase 3 — P2 数据联动 (#8)
7. 底层多表关联增强

### Phase 4 — 回归测试
8. 端到端测试所有修改

---

## 待确认事项

1. **OCR 识别**: 是否需要在文档上传时自动进行 OCR 文字识别？（影响后端需要集成 Tesseract.js 或类似服务）
2. **公司架构图渲染**: 使用哪种技术方案？
   - A. 纯 React + CSS（轻量，适合简单树形）
   - B. Mermaid.js（适合流程图风格）
   - C. D3.js / React Flow（适合交互式关系图谱）
3. **批量下载格式**: ZIP 还是单独文件逐个下载？
4. **文档编号规则**: 是否需要管理员可配置？（默认使用系统自动生成）

---

*本报告由软件公司主理人齐活林生成，基于代码审计和用户反馈逐项分析。*
