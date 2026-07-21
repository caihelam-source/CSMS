# 🏢 Claw - 公司秘书管理系统 v5.2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green.svg)](https://www.mongodb.com/)

**Claw (Company Secretary Management System)** 是一款现代化的全栈香港公司秘书管理系统，提供公司管理、统一人员中枢、会议全生命周期管理、电子签署、合规提醒、文档模板等核心功能。

> 当前版本 **v5.2**（2026-07-20）。v5.0 完成统一人员中枢重构，v5.2 完成会议全生命周期闭环、文件管理升级、移动端适配与签署任务增强。详见 [CHANGELOG](#变更日志)。

## ✨ 核心功能

### 🔐 用户认证与权限
- JWT 身份认证 + 基于角色的访问控制 (RBAC)
- **Demo 模式**：无需登录即可预览（`admin@example.com` / `admin123`）

### 🏢 公司管理
- 公司 CRUD + **Excel 批量导入**
- 详情视图：任职人员 (links) / 股东 / 登记册 Tab
- 一键生成 ROM（股东名册）/ ROD（董事名册）PDF
- 文件 Tab：到期红/橙/绿徽章 + 近期任务概览

### 👥 统一人员中枢 (Personnel) — v5.0 重构核心
- **单一人员库**，用角色标签区分董事 / 股东 / 秘书（不再有独立 Directors 表/页面）
- 任职时间线追踪（`Company.links[]` 为唯一事实源，读时聚合）
- **360° 人员视图**：任职公司 + 关联会议 / 文件 / 合规 / 任务 五板块并行加载
- 智能合并 / 重复检测
- Excel 统一导入

### 📅 会议全生命周期闭环 — v5.2
- 流程：**会议通知 → 上传附件 → 会议纪要 → 签字 → 归档**
- 通知 / 纪要生成后可**编辑 / 重新生成 / 复制文案 / HTML 预览 / 保存 Word**
- **暂存池**：签字扫描件、其他资料先暂存会议子目录，最终归档时批量移库 + 自动重命名（`[日期] 公司_类型_来源.pdf`）+ 锁定只读
- 关键词检测自动生成签署 Task（关联 meetingId）

### 📄 文档与模板
- 文件上传（本地磁盘 / Cloudflare R2 生产）
- **多级筛选器**：大类 → 子类型 → 年份 + 面包屑 + 实时数量同步
- 文档到期状态徽章（绿/橙/红）
- 文档模板：变量渲染引擎 + 预览

### ✍️ 电子签署流程 — v5.2 增强
- **双来源 Task**：`taskSource: meeting | dashboard`，计数实时同步
- 模态发起（关联公司 / 签署人 / 截止 / 是否 CTC）
- 签署完成可直接归档公司库（`(ctc)`/`(signed).pdf` 命名）
- 来源标签按 `kind` 路由（dashboard_sign → /tasks，signing_scan → /meetings）

### 📊 合规管理
- 合规规则（17 条预设 + 自定义）
- 合规提醒：自动触发 + 到期提醒 + 统计面板
- 登记册生成：香港格式 ROM/ROD PDF (pdfkit)

### 🎨 体验增强 — v5.2
- **暗色模式**（ThemeContext，全站设计令牌对齐）
- **移动端适配**（tap-target 44px、DetailHeader 折行、TabNav 选中加深）
- **全文搜索增强**（`$text` 索引：Company/Personnel/Document/Meeting/Task/ComplianceReminder）
- Dashboard 签署任务增强（双来源 + 模态发起）

## 🛠️ 技术栈

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >=18.0.0 | 运行时 |
| Express | 4.18.x | Web 框架 |
| MongoDB | 6.0+ | 数据库 |
| Mongoose | 8.0.x | ODM |
| JWT | 9.0.x | 认证 |
| Multer | 1.4.x | 文件上传 |
| PDFKit | 0.19.x | PDF 生成 |
| XLSX | 0.18.x | Excel 解析 |
| Docxtemplater | 3.68.x | Word 文档生成 |
| @aws-sdk/client-s3 | 3.x | Cloudflare R2 存储 |

### 前端
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| Vite 5 | 构建工具 |
| TailwindCSS | 样式框架 |
| Lucide Icons | 图标库 |
| React Router | 路由管理 |
| Axios | HTTP 客户端 |

> **Mock / Real 双轨**：前端 `services/index.js` 中 `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`（默认 mock）。`wrap(apiFn, mockFn)` 统一真实 `{success, entity}` 与 mock `{data:{data}}` 为前端期望形状。接真实后端：`VITE_USE_MOCK=false`。

## 🚀 快速开始

### 环境要求
```bash
Node.js >= 18.0.0
MongoDB >= 6.0 (本地或 Atlas)
```

### 安装步骤
```bash
# 1. 克隆仓库
git clone <repository-url>
cd Claw

# 2. 安装依赖（根 + 前端）
npm install
cd client && npm install && cd ..

# 3. 配置环境变量（真实后端联调时需要）
cp .env.example .env
# 编辑 .env 填入 MONGODB_URI / R2_* 等（见 DEPLOY-FULLSTACK.md）

# 4. 启动 MongoDB（可选，演示可走 Mock）
docker-compose up -d

# 5. 运行
npm run dev              # 同时启动前后端（:5000 + :5173）
# 或分开：
npm run server:dev      # 后端 :5000
npm run client:dev      # 前端 :5173（Mock 模式）
```

### 访问地址
- 前端界面：http://localhost:5173
- 后端 API：http://localhost:5000
- Demo 登录：`admin@example.com` / `admin123`

## 📁 项目结构

```
Claw/
├── client/                    # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/        # 公共组件 (UIHelpers, Modal, TabNav ...)
│   │   ├── pages/            # 页面
│   │   │   ├── Dashboard.jsx       # 仪表盘（签署任务增强）
│   │   │   ├── Companies.jsx       # 公司管理（Excel 导入）
│   │   │   ├── CompanyDetail.jsx   # 公司 360°（文件 Tab + 近期任务）
│   │   │   ├── Personnel.jsx       # 统一人员中枢
│   │   │   ├── PersonnelDetail.jsx # 人员 360° 视图
│   │   │   ├── Meetings.jsx        # 会议列表
│   │   │   ├── MeetingDetail.jsx   # 会议全生命周期闭环
│   │   │   ├── Documents.jsx       # 文档管理（多级筛选）
│   │   │   ├── Tasks.jsx           # 任务（双来源签署）
│   │   │   ├── TaskDetail.jsx      # 任务详情（CTC/来源徽章）
│   │   │   ├── ComplianceReminders.jsx
│   │   │   ├── ComplianceRules.jsx
│   │   │   ├── Templates.jsx
│   │   │   └── SignTasks.jsx
│   │   ├── services/         # API 服务层（含 mock 双轨）
│   │   └── utils/            # 工具函数 (helpers, validators)
│   └── ...
├── server/                   # 后端 (Express)
│   ├── config/  controllers/  middleware/
│   ├── models/              # User/Company/Personnel/Document/Meeting/Task/SignTask/ComplianceRule/ComplianceReminder ...
│   │                        #   ⚠️ Director 模型已删除(v5.0)，legacy 数据待 migrate-v5 --apply 合并
│   ├── routes/             # auth/companies/personnel/companyEntries/companyRegister/documents/meetings/tasks/complianceRules/complianceReminders/templates/signTasks
│   ├── searchIndexes.js     # $text 索引确保（v5.2）
│   └── index.js
├── scripts/                 # 辅助脚本（含 migrate-v5.js 迁移脚本、push-no-git.cjs 推送）
├── .workbuddy/memory/       # 项目记忆 + SECRETS.md（⚠️ 被 .gitignore 忽略，搬迁需手动带，见 MIGRATION.md）
├── docker-compose.yml  Dockerfile  nginx.conf  render.yaml
└── package.json
```

## 🔌 API 接口概览

### 认证 `/api/auth`
`POST /register` · `POST /login` · `GET /me`

### 公司 `/api/companies`
`GET /` · `POST /` · `PUT /:id` · `DELETE /:id` · `POST /import`(Excel) · `GET /:id/directors` · `GET /:id/shareholder-entries` · `GET /:id/director-entries` · `POST/PUT/DELETE /:id/links`(任职关系唯一写入口)

### 人员中枢 `/api/personnel`
`GET /` · `POST /` · `PUT /:id` · `DELETE /:id` · `POST /:id/appointments` · `POST /merge` · `GET /:id/aggregate`(360° 聚合)

### 会议 `/api/meetings`
`GET /` · `POST /` · `PUT /:id` · `DELETE /:id` · `GET /:id/sign-tasks`

### 文档 `/api/documents`
`GET /`(排除暂存) · `POST /`(含 staged 暂存) · `GET /:id` · `DELETE /:id` · `GET /company/:id` · `GET /meeting/:id`

### 任务 `/api/tasks` · 签署 `/api/sign-tasks` · 合规 `/api/compliance-rules` · `/api/compliance-reminders` · 模板 `/api/templates` · 登记册 `/api/company-register`(`GET /:id/rom` `GET /:id/rod`)

> 完整 API 见 [docs/API.md](./docs/API.md)。

## 📦 部署

公网部署（Render + MongoDB Atlas + Cloudflare R2）详见 **[DEPLOY-FULLSTACK.md](./DEPLOY-FULLSTACK.md)**。

沙箱无 git 时，用 `scripts/push-no-git.cjs`（Node.js 调 GitHub Git Data API 等效 `git push`，PAT 从 `.workbuddy/memory/SECRETS.md` 读取，不落盘）。

## 📦 整体搬迁（迁移到新环境）

把整个 CSMS 搬到另一台机器 / 新项目目录时，**不可只靠 `git clone`**（`.workbuddy/` 被忽略，会丢密钥与记忆）。完整步骤见 **[MIGRATION.md](./MIGRATION.md)**。

## 📋 项目路线图

见 [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md)（当前 v5.2）。

## 📝 技术设计契约

见 [TECH_DESIGN.md](./TECH_DESIGN.md)（v5.0 中央数据库设计冻结 + v5.2 增量）。

## 🤝 团队协作

见 [CONTRIBUTING.md](./CONTRIBUTING.md)（Git Flow + Conventional Commits）。

## 📄 变更日志

- **v5.2** (2026-07-20)：会议全生命周期闭环 + 文件管理升级 + 移动端适配 + 签署任务增强；会议通知/纪要 Tab 补齐「重新生成 / 保存 Word / HTML 预览」，修复编辑后预览丢失。
- **v5.0** (2026-07-14)：统一人员中枢重构（Director/ShareholderEntry/DirectorEntry → Personnel + Company.links），Personnel 360° 视图，CompanyDetail 打通。
- **v4.0**：代码优化（React.lazy / 共享组件 / 虚拟列表 / 验证器 / Toast）+ 端到端回归。
- **v3.0**：中央信息库完整可用。

## 📄 License

MIT License - 见 [LICENSE](LICENSE)。

---

<div align="center">
<strong>Claw</strong> - 让公司秘书工作更高效 ✨
</div>
