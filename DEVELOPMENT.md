# 📚 开发指南 - Development Guide

本文档为 Claw 公司秘书管理系统的完整开发指南，帮助新团队成员快速上手开发。

## 📋 目录

- [系统架构](#系统架构)
- [环境配置详解](#环境配置详解)
- [项目结构说明](#项目结构说明)
- [数据库设计](#数据库设计)
- [API 开发规范](#api-开发规范)
- [前端开发规范](#前端开发规范)
- [常用命令](#常用命令)
- [调试技巧](#调试技巧)
- [常见问题](#常见问题)

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         (React + Vite + TailwindCSS)        │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Pages    │ │ Components│ │ Services │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       └────────────┼────────────┘            │
│                  Axios                       │
└────────────────────┼────────────────────────┘
                     │ HTTP
┌────────────────────┼────────────────────────┐
│                 Backend                      │
│          (Node.js + Express)                 │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Routes   │ │Controllers│ │ Services │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       └────────────┼────────────┘            │
│              Express Middleware              │
│         (Auth / CORS / Logger)               │
└────────────────────┼────────────────────────┘
                     │ Mongoose
┌────────────────────┼────────────────────────┐
│                Database                      │
│             (MongoDB)                        │
│                                              │
│  Users │ Companies │ Personnel │ Directors  │
│  Documents │ Meetings │ Tasks │ SignTasks    │
└─────────────────────────────────────────────┘
```

### 技术栈选型理由

| 技术 | 选择原因 |
|------|----------|
| **Node.js** | JavaScript 全栈，前后端统一；异步 I/O 性能优秀 |
| **Express** | 轻量灵活，中间件生态丰富 |
| **MongoDB** | 文档型数据库，适合复杂嵌套数据（如任职记录） |
| **React** | 组件化开发，生态成熟，虚拟 DOM 性能好 |
| **Vite** | 极速热更新（HMR），开发体验优秀 |
| **TailwindCSS** | 原子化 CSS，快速构建 UI，一致性好 |

## ⚙️ 环境配置详解

### 必需软件

```bash
# 检查 Node.js 版本（需要 >= 18.0.0）
node --version

# 检查 npm 版本
npm --version

# 检查 MongoDB 版本（需要 >= 6.0）
mongod --version

# 或者使用 Docker
docker --version
```

### 推荐的 IDE 配置

#### VS Code 扩展推荐
```
必装：
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Path Intellisense

可选：
- MongoDB for VS Code
- Thunder Client (测试 API)
- GitLens
```

#### VS Code 设置 (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 环境变量详细说明

创建 `.env` 文件：

```env
# ===========================================
# 应用基础配置
# ===========================================

# 服务器端口
PORT=5000

# 运行模式: development | production | test
NODE_ENV=development

# 前端 URL（用于 CORS）
CLIENT_URL=http://localhost:5173

# ===========================================
# 数据库配置
# ===========================================

# MongoDB 连接字符串
# 本地开发: mongodb://localhost:27017/claw_dev
# Docker: mongodb://mongo:27017/claw_dev
# Atlas: mongodb+srv://user:pass@cluster.mongodb.net/claw_dev?retryWrites=true&w=majority
MONGODB_URI=mongodb://localhost:27017/claw_dev

# ===========================================
# JWT 认证配置
# ===========================================

# JWT 密钥（生产环境请使用强密码）
JWT_SECRET=dev-secret-key-for-demo

# Token 过期时间
JWT_EXPIRE=7d

# ===========================================
# 邮件服务配置（可选）
# ===========================================

EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# ===========================================
# 文件上传配置
# ===========================================

# 上传文件大小限制（字节）
MAX_FILE_SIZE=10485760  # 10MB

# 允许的文件类型
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf,.xlsx,.docx

# ===========================================
# PDF 生成配置
# ===========================================

PDF_FONT_PATH=/path/to/fonts  # 自定义字体路径（可选）

# ===========================================
# Demo 模式配置
# ===========================================

# 是否启用 Demo 模式（允许未登录访问）
DEMO_MODE=true
```

## 📂 项目结构说明

### 后端目录结构 (`server/`)

```
server/
├── config/
│   └── db.js                 # MongoDB 连接配置
├── controllers/              # 控制器层（业务逻辑）
│   ├── authController.js
│   ├── companyController.js
│   ├── directorController.js
│   └── ...
├── middleware/
│   ├── auth.js              # JWT 认证中间件
│   ├── errorHandler.js      # 错误处理中间件
│   └── upload.js            # 文件上传中间件
├── models/                   # MongoDB 数据模型
│   ├── User.js
│   ├── Company.js
│   └── ...
├── routes/                   # API 路由定义
│   ├── auth.js
│   ├── companies.js
│   └── ...
├── services/                 # 业务逻辑层（可选）
│   ├── companyService.js
│   └── ...
├── utils/                    # 工具函数
│   ├── helpers.js
│   └── validators.js
└── index.js                 # 应用入口
```

### 前端目录结构 (`client/src/`)

```
client/src/
├── components/               # 可复用组件
│   ├── common/              # 通用组件
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   └── Form.jsx
│   ├── layout/             # 布局组件
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   └── Footer.jsx
│   └── ui/                 # UI 组件
│       ├── Button.jsx
│       ├── Input.jsx
│       └── Card.jsx
├── pages/                    # 页面组件
│   ├── Dashboard.jsx
│   ├── Companies.jsx
│   └── ...
├── services/                 # API 服务
│   ├── api.js              # Axios 实例和拦截器
│   ├── authService.js
│   ├── companyService.js
│   └── ...
├── context/                 # React Context
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── hooks/                   # 自定义 Hooks
│   ├── useAuth.js
│   └── useDebounce.js
├── utils/                   # 工具函数
│   ├── formatters.js
│   └── validators.js
├── App.jsx                  # 根组件
└── main.jsx                 # 入口文件
```

## 🗄️ 数据库设计

### 核心 ER 关系

```
User (用户)
  ├── 1:N Company (公司)
  ├── 1:N Director (董事)
  ├── 1:N Personnel (人员库)
  ├── 1:N Meeting (会议)
  ├── 1:N Task (任务)
  └── 1:N Document (文档)

Company (公司)
  ├── 1:N ShareholderEntry (股东条目)
  ├── 1:N DirectorEntry (董事条目)
  └── 1:N ComplianceReminder (合规提醒)

Personnel (人员库)
  └── 1:N Appointment (任职记录)
      └── 关联到 Company/DirectorEntry

DirectorEntry (董事条目)
  └── N:1 Personnel (关联人员库)
```

### 关键模型示例

#### Company 模型
```javascript
const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  registrationNumber: String,
  type: String,           // private limited, public, etc.
  status: {
    type: String,
    enum: ['active', 'inactive', 'dissolved'],
    default: 'active'
  },
  incorporationDate: Date,
  registeredAddress: {
    line1: String,
    line2: String,
    city: String,
    region: String,
    country: String,
    postalCode: String
  },
  complianceCategory: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });
```

#### Personnel 模型（带嵌入文档）
```javascript
const PersonnelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['individual', 'corporate']
  },
  // 个人信息
  personalInfo: {
    idNumber: String,
    passportNumber: String,
    nationality: String,
    dateOfBirth: Date
  },
  // 法人信息
  corporateInfo: {
    registrationNumber: String,
    jurisdiction: String
  },
  contactInfo: {
    email: String,
    phone: String,
    address: String
  },
  roles: [{               // 角色标签
    type: String,
    enum: ['director', 'shareholder', 'secretary', 'employee']
  }],
  appointments: [{         // 任职记录（嵌入文档）
    _id: false,
    role: String,
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company'
    },
    appointmentDate: Date,
    cessationDate: Date,
    status: {
      type: String,
      enum: ['current', 'ceased'],
      default: 'current'
    },
    notes: String
  }]
}, { timestamps: true });
```

## 🔌 API 开发规范

### RESTful API 设计原则

#### URL 设计
```
# 资源集合
GET    /api/companies          # 获取所有公司
POST   /api/companies          # 创建公司

# 单个资源
GET    /api/companies/:id      # 获取特定公司
PUT    /api/companies/:id      # 更新公司
DELETE /api/companies/:id      # 删除公司

# 子资源
GET    /api/companies/:id/directors    # 获取公司的董事
POST   /api/companies/:id/directors    # 为公司添加董事

# 特殊操作
POST   /api/companies/import          # Excel 导入
GET    /api/company-register/:id/rom   # 生成 PDF
```

#### Controller 示例

```javascript
// server/controllers/companyController.js

const getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;

    // 构建查询条件
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }

    // 分页查询
    const companies = await Company.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(query);

    res.json({
      success: true,
      data: companies,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: '获取公司列表失败',
      error: error.message
    });
  }
};
```

### 中间件使用

#### 认证中间件 (`middleware/auth.js`)
```javascript
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '无效的认证令牌'
    });
  }
};
```

## 🎨 前端开发规范

### 组件开发最佳实践

#### 使用自定义 Hook 封装 API 调用
```javascript
// client/hooks/useApi.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(url, options.params);
        setData(response.data.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || '请求失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
};

// 使用方式
function CompanyList() {
  const { data: companies, loading, error } = useApi('/companies');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {companies.map(company => (
        <CompanyCard key={company._id} company={company} />
      ))}
    </div>
  );
}
```

#### 表单处理示例
```javascript
// 使用受控组件 + 验证
import { useState } from 'react';
import { useForm } from '../hooks/useForm';
import { validateCompanyForm } from '../utils/validators';

function CompanyForm({ onSubmit, initialData = {} }) {
  const {
    values,
    errors,
    handleChange,
    handleSubmit,
    isSubmitting
  } = useForm(
    initialData,
    onSubmit,
    validateCompanyForm
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 公司名称 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          公司名称 *
        </label>
        <input
          type="text"
          name="name"
          value={values.name || ''}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          } px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? '提交中...' : '保存'}
      </button>
    </form>
  );
}
```

### TailwindCSS 使用规范

#### 常用样式类组合
```jsx
/* 卡片 */
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">

/* 按钮 */
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50">

/* 输入框 */
<input className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">

/* 表格 */
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
  <tbody className="bg-white divide-y divide-gray-200">

/* 状态徽章 */
<span className={`px-2 py-1 rounded-full text-xs font-medium ${
  status === 'active' ? 'bg-green-100 text-green-800' :
  status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
  'bg-red-100 text-red-800'
}`}>

/* 加载状态 */
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600">
```

## 💻 常用命令

### 开发相关
```bash
# 启动开发服务器（前后端同时）
npm run dev

# 仅启动后端
npm run server:dev

# 仅启动前端
npm run client:dev

# 生产构建
npm run client:build

# 启动生产服务器
npm start
```

### 数据库相关
```bash
# 启动 MongoDB (Docker)
docker-compose up -d mongo

# 连接到 MongoDB Shell
mongosh

# 备份数据库
mongodump --db claw_dev --out ./backup

# 恢复数据库
mongorestore ./backup
```

### Docker 相关
```bash
# 构建并启动全部服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 停止所有服务
docker-compose down

# 清理（删除卷数据）
docker-compose down -v
```

### 其他实用命令
```bash
# 格式化代码（Prettier）
npx prettier --write "server/**/*.js" "client/src/**/*.{js,jsx}"

# 代码检查（ESLint）
npx eslint server/**/*.js

# 安装新的后端依赖
npm install <package-name>

# 安装新的前端依赖
cd client && npm install <package-name>

# 更新依赖版本检查
npm outdated
cd client && npm outdated
```

## 🐛 调试技巧

### 后端调试

#### 使用 VS Code Debugger
在 `.vscode/launch.json` 中添加：
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "启动服务器",
      "program": "${workspaceFolder}/server/index.js",
      "runtimeArgs": ["--inspect"],
      "console": "integratedTerminal",
      "restart": true,
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

#### 使用 console.log 最佳实践
```javascript
// ❌ 避免：直接输出大对象
console.log(user);  // 可能输出过多信息

// ✅ 推荐：选择性输出关键字段
console.log('User ID:', user._id);
console.log('User name:', user.name);

// ✅ 推荐：使用字符串模板
console.log(`Processing company ${company._id}:`, { name: company.name });

// ✅ 推荐：分组日志
console.group('📊 Company Processing');
console.log('ID:', company._id);
console.log('Name:', company.name);
console.log('Directors count:', company.directors.length);
console.groupEnd();
```

### 前端调试

#### React Developer Tools
安装浏览器扩展 [React DevTools](https://react.dev/learn/react-developer-tools)

#### 使用 React Error Boundary
```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Error caught by boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2>出错了</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 数据库调试

#### MongoDB Compass
使用 GUI 工具查看和操作数据库：
- 安装 [MongoDB Compass](https://www.mongodb.com/products/compass)
- 连接到本地或远程数据库
- 可视化查看集合、文档、索引

#### 在代码中调试查询
```javascript
// 开启 Mongoose debug 模式
mongoose.set('debug', true);

// 或者在特定查询时
const companies = await Company.find(query).explain('executionStats');
console.log(JSON.stringify(companies, null, 2));
```

## ❓ 常见问题

### Q: 启动时报错 `EADDRINUSE`？
A: 端口被占用。解决方法：
```bash
# 查找占用端口的进程
netstat -ano | findstr :5000

# 结束进程（替换 PID）
taskkill /PID <pid> /F

# 或修改 .env 中的 PORT
PORT=5001
```

### Q: MongoDB 连接失败？
A: 检查以下几点：
1. MongoDB 服务是否已启动
2. 连接字符串是否正确
3. 如果使用 Docker，容器是否正在运行
```bash
# 检查 Docker 容器状态
docker ps | grep mongo

# 查看 MongoDB 日志
docker logs mongo
```

### Q: 前端无法连接后端 API？
A: 检查 CORS 配置和代理设置：
```javascript
// server/index.js
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

### Q: 文件上传失败？
A: 检查：
1. `uploads/` 目录是否存在且可写
2. 文件大小是否超过限制
3. 文件类型是否在允许列表中

### Q: 如何重置开发数据库？
```bash
# 方式一：通过 mongosh
mongosh claw_dev --eval "db.dropDatabase()"

# 方式二：通过应用代码（如果有的话）
curl -X POST http://localhost:5000/api/dev/reset-db

# 注意：这会删除所有数据！
```

---

## 📞 需要更多帮助？

- 查看 [API Documentation](./docs/API.md) 了解接口详情
- 阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献流程
- 在项目中提 Issue 或 Discussion
- 联系团队成员

<div align="center">
<strong>祝你开发愉快！</strong> 🚀
</div>
