# 🏢 Claw - 公司秘书管理系统 v3.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green.svg)](https://www.mongodb.com/)

**Claw (Company Secretary Management System)** 是一款现代化的全栈公司秘书管理系统，专为香港及中国地区企业设计，提供公司管理、董事管理、合规提醒、文档模板、电子签署等核心功能。

## ✨ 核心功能

### 🔐 用户认证与权限
- JWT 身份认证
- 基于角色的访问控制 (RBAC)
- Demo 模式支持（无需登录即可预览）

### 🏢 公司管理
- 公司 CRUD 操作
- Excel 批量导入
- 详情视图：股东管理 / 董事管理 / 登记册 Tab
- 一键生成 ROM（股东名册）/ ROD（董事名册）PDF

### 👥 董事与人员管理
- **董事管理** - 董事信息 CRUD + 任职记录 + Excel 导入
- **人员库 (Personnel)** - 统一人员库，支持多角色标签
  - 个人股东 / 法人股东 / 董事 / 公司秘书
  - 任职时间线追踪
  - 数据联动：选择人员自动填充关联信息

### 📊 股东条目管理
- 个人股东 / 法人股东分类
- 入股退股时间线 (shareRecords)
- 关联人员库和公司库

### 📋 合规管理
- **合规规则** - 17 条预设规则 + 自定义规则
- **合规提醒** - 自动触发 + 到期提醒 + 统计面板
- **登记册生成** - 香港格式 ROM/ROD PDF (pdfkit)

### 📄 文档与模板
- **文档管理** - 文件上传下载 + 自动编号
- **文档模板** - 变量渲染引擎 + 模板预览

### ✍️ 电子签署流程
- 签署任务创建与管理
- 签署人列表 + 进度展示
- 完整的签署工作流

### 📅 会议与任务
- 会议管理（快速状态切换）
- 任务管理（快速完成 + 备注功能）

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

### 前端
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| Vite 5 | 构建工具 |
| TailwindCSS | 样式框架 |
| Lucide Icons | 图标库 |
| React Router | 路由管理 |
| Axios | HTTP 客户端 |

## 🚀 快速开始

### 环境要求
```bash
Node.js >= 18.0.0
MongoDB >= 6.0 (本地或 Atlas)
```

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd Claw
```

2. **安装依赖**
```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd client && npm install
cd ..
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的配置
```

4. **启动 MongoDB**
```bash
# 使用 Docker（推荐）
docker-compose up -d

# 或使用本地 MongoDB
mongod
```

5. **运行项目**
```bash
# 开发模式（同时启动前后端）
npm run dev

# 或分别启动
npm run server:dev  # 后端 :5000
npm run client:dev  # 前端 :5173
```

### 访问地址
- 前端界面：http://localhost:5173
- 后端 API：http://localhost:5000
- API 文档：http://localhost:5000/api/docs

## 📁 项目结构

```
Claw/
├── client/                    # 前端应用 (React + Vite)
│   ├── src/
│   │   ├── components/        # 公共组件
│   │   ├── pages/            # 页面组件
│   │   │   ├── Dashboard.jsx      # 仪表盘
│   │   │   ├── Companies.jsx      # 公司管理
│   │   │   ├── Directors.jsx      # 董事管理
│   │   │   ├── Personnel.jsx      # 人员库
│   │   │   ├── Meetings.jsx       # 会议管理
│   │   │   ├── Documents.jsx      # 文档管理
│   │   │   ├── Tasks.jsx          # 任务管理
│   │   │   ├── ComplianceReminders.jsx  # 合规提醒
│   │   │   ├── ComplianceRules.jsx     # 合规规则
│   │   │   ├── Templates.jsx      # 文档模板
│   │   │   └── SignTasks.jsx      # 电子签署
│   │   ├── services/         # API 服务层
│   │   └── utils/            # 工具函数
│   └── ...
├── server/                   # 后端应用 (Express)
│   ├── config/              # 配置文件
│   ├── controllers/         # 控制器
│   ├── middleware/          # 中间件
│   ├── models/             # MongoDB 模型
│   │   ├── User.js         # 用户模型
│   │   ├── Company.js      # 公司模型
│   │   ├── Director.js     # 董事模型
│   │   ├── Personnel.js    # 人员库模型
│   │   ├── ShareholderEntry.js  # 股东条目模型
│   │   ├── DirectorEntry.js    # 董事条目模型
│   │   ├── Document.js        # 文档模型
│   │   ├── DocumentTemplate.js # 文档模板模型
│   │   ├── ComplianceRule.js   # 合规规则模型
│   │   ├── ComplianceReminder.js # 合规提醒模型
│   │   ├── Meeting.js          # 会议模型
│   │   ├── SignTask.js         # 签署任务模型
│   │   └── Task.js             # 任务模型
│   ├── routes/             # API 路由
│   │   ├── auth.js            # 认证路由
│   │   ├── companies.js       # 公司路由
│   │   ├── directors.js       # 董事路由
│   │   ├── personnel.js       # 人员库路由
│   │   ├── companyEntries.js  # 条目路由
│   │   ├── companyRegister.js # 登记册路由
│   │   ├── documents.js       # 文档路由
│   │   ├── meetings.js        # 会议路由
│   │   ├── tasks.js           # 任务路由
│   │   ├── complianceRules.js    # 合规规则路由
│   │   ├── complianceReminders.js # 合规提醒路由
│   │   ├── templates.js       # 模板路由
│   │   └── signTasks.js       # 签署路由
│   └── index.js            # 入口文件
├── uploads/                 # 文件上传目录
├── scripts/                 # 辅助脚本
├── docker-compose.yml       # Docker 编排
├── Dockerfile               # Docker 镜像
├── nginx.conf               # Nginx 配置
└── package.json
```

## 🔌 API 接口概览

### 认证模块 `/api/auth`
- `POST /register` - 用户注册
- `POST /login` - 用户登录
- `GET /me` - 获取当前用户

### 公司模块 `/api/companies`
- `GET /` - 获取所有公司
- `POST /` - 创建公司
- `PUT /:id` - 更新公司
- `DELETE /:id` - 删除公司
- `POST /import` - Excel 导入
- `GET /:id/directors` - 获取公司董事
- `GET /:id/shareholder-entries` - 获取股东条目
- `GET /:id/director-entries` - 获取董事条目

### 人员库模块 `/api/personnel`
- `GET /` - 获取所有人员
- `POST /` - 创建人员
- `PUT /:id` - 更新人员
- `DELETE /:id` - 删除人员
- `POST /:id/appointments` - 添加任职记录

### 合规模块
- `GET /api/compliance-rules` - 获取合规规则
- `POST /api/compliance-rules` - 创建规则
- `GET /api/compliance-reminders` - 获取合规提醒
- `PUT /api/compliance-reminders/:id/complete` - 标记完成

### 登记册模块 `/api/company-register`
- `GET /:id/rom` - 生成股东名册 PDF
- `GET /:id/rod` - 生成董事名册 PDF

更多 API 详情请查看 [API Documentation](./docs/API.md)

## 🐳 Docker 部署

### 快速部署
```bash
# 构建并启动所有服务
docker-compose up -d --build

# 服务包括：
# - MongoDB (27017)
# - Backend API (:5000)
# - Frontend (:80)
```

### 单独服务
```bash
# 只启动数据库
docker-compose up -d mongo

# 只启动后端
docker-compose up backend

# 只启动前端
docker-compose up frontend
```

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🤝 团队协作指南

我们欢迎所有贡献者！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解如何参与开发：

- 如何设置开发环境
- 代码规范和提交规范
- 分支策略和工作流
- 如何提交 PR

## 📋 项目路线图

查看 [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) 了解：
- 当前开发进度
- 即将发布的版本计划
- 已知问题和改进方向
- 功能优先级排序

## 📝 开发文档

- [开发指南](./DEVELOPMENT.md) - 详细的环境配置和开发说明
- [部署指南](./DEPLOYMENT.md) - 生产环境部署教程
- [API 文档](./docs/API.md) - 完整的 API 接口文档
- [数据库设计](./docs/DATABASE.md) - 数据模型和关系说明

## 📄 License

本项目采用 MIT License - 查看 [LICENSE](LICENSE) 文件了解详情

## 💬 支持与反馈

- 提交 Issue：[GitHub Issues](`<repository-url>/issues`)
- 功能请求：[GitHub Discussions](`<repository-url>/discussions`)
- 邮件联系：support@example.com

---

<div align="center">
<strong>Claw</strong> - 让公司秘书工作更高效 ✨
<br><br>
Made with ❤️ by the Claw Team
</div>
