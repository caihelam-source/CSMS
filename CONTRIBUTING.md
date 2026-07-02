# 🤝 贡献指南 - Contributing to Claw

感谢你对 Claw 公司秘书管理系统的关注！我们欢迎任何形式的贡献，包括但不限于：

- 🐛 修复 Bug
- ✨ 添加新功能
- 📝 改进文档
- 🎨 UI/UX 改进
- ⚡ 性能优化
- 🌐 国际化支持

## 📋 目录

- [开始之前](#开始之前)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交信息规范](#提交信息规范)
- [分支策略](#分支策略)
- [Pull Request 流程](#pull-request-流程)
- [代码审查标准](#代码审查标准)
- [问题报告](#问题报告)

## 🚀 开始之前

### 确保你有：
1. ✅ 一个 GitHub/GitLab 账号
2. ✅ 已 Fork 本仓库到你的账号下
3. ✅ 已克隆你的 Fork 到本地

```bash
# 克隆你 fork 的仓库
git clone https://github.com/<your-username>/Claw.git
cd Claw

# 添加上游仓库
git remote add upstream https://github.com/<original-repo>/Claw.git
```

## 💻 开发环境设置

### 1. 安装依赖

```bash
# 安装根目录依赖（后端）
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

### 2. 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑 .env 文件，填入必要配置
```

**必需的环境变量：**

```env
# 服务器配置
PORT=5000
NODE_ENV=development

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017/claw_dev

# JWT 配置
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRE=7d

# 邮件配置（可选）
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-password
```

### 3. 启动 MongoDB

**方式一：使用 Docker（推荐）**
```bash
docker-compose up -d mongo
```

**方式二：使用本地 MongoDB**
确保 MongoDB 服务正在运行，默认端口 27017。

**方式三：使用 MongoDB Atlas（云数据库）**
1. 注册 [MongoDB Atlas](https://www.mongodb.com/atlas) 账号
2. 创建免费集群
3. 获取连接字符串并填入 `MONGODB_URI`

### 4. 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或者分别启动
npm run server:dev   # 后端 :5000
npm run client:dev   # 前端 :5173
```

访问 http://localhost:5173 查看前端界面

## 📏 代码规范

### JavaScript/Node.js 规范

#### 通用规则
- 使用 **2 空格缩进**
- 使用 **单引号** 或 **双引号**（保持一致）
- 语句末尾添加 **分号**
- 使用 **const** 定义常量，**let** 定义变量（避免 var）
- 函数命名使用 **camelCase**
- 类名使用 **PascalCase**

#### 示例代码

✅ **好的写法：**
```javascript
const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};
```

❌ **避免的写法：**
```javascript
var getUser = function(id){
    // 缩进不一致，缺少错误处理
    return User.findById(id)
}
```

### React 组件规范

- **函数组件**优先于类组件
- 使用 Hooks（useState, useEffect 等）
- 组件文件名使用 PascalCase
- Props 解构要清晰
- 使用 TailwindCSS 进行样式编写

#### 示例组件

```jsx
// CompanyCard.jsx
import React from 'react';
import { Building2, Users } from 'lucide-react';

const CompanyCard = ({ company, onClick }) => {
  const { name, registrationNumber, directors } = company;

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onClick(company._id)}
    >
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-8 h-8 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-800">{name}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-2">注册编号: {registrationNumber}</p>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Users className="w-4 h-4" />
        <span>{directors?.length || 0} 位董事</span>
      </div>
    </div>
  );
};

export default CompanyCard;
```

### 文件命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase.jsx | `CompanyList.jsx` |
| 工具函数 | camelCase.js | `formatDate.js` |
| API 服务 | camelCase.js | `apiService.js` |
| 样式文件 | kebab-case.css | `button-group.css` |
| 常量文件 | UPPER_SNAKE_CASE.js | `API_ENDPOINTS.js` |

### Git 提交信息规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

#### 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具/依赖等

#### 示例

```bash
# 新增功能
git commit -m "feat(companies): add Excel import functionality"

# 修复 bug
git commit -m "fix(auth): resolve JWT token expiration issue"

# 文档更新
git commit -m "docs(readme): update installation instructions"

# 重构代码
git commit -m "refactor(personnel): optimize database queries"
```

## 🌿 分支策略

我们采用 **Git Flow** 工作流的简化版本：

### 分支类型

```
main (主分支)
  └── dev (开发分支)
       ├── feature/xxx (功能分支)
       ├── fix/xxx (修复分支)
       └── docs/xxx (文档分支)
```

### 分支说明

| 分支名 | 用途 | 说明 |
|--------|------|------|
| `main` | 生产环境 | 只接受合并自 dev 的 PR |
| `dev` | 开发环境 | 主要开发分支，相对稳定 |
| `feature/*` | 功能开发 | 从 dev 创建，完成后 PR 回 dev |
| `fix/*` | Bug 修复 | 从 dev 创建，修复后 PR 回 dev |
| `hotfix/*` | 紧急修复 | 从 main 创建，修复后同时合并回 main 和 dev |

### 工作流程

1. **从 dev 创建功能分支**
```bash
git checkout dev
git pull origin dev
git checkout -b feature/add-excel-import
```

2. **开发和提交**
```bash
git add .
git commit -m "feature(companies): implement Excel import logic"
```

3. **推送分支到远程**
```bash
git push origin feature/add-excel-import
```

4. **创建 Pull Request**
   - 在 GitHub/GitLab 上创建 PR
   - 目标分支选择 `dev`
   - 填写详细的 PR 描述

## 🔀 Pull Request 流程

### PR 检查清单

在提交 PR 前，请确保：

- [ ] 代码已通过本地测试
- [ ] 遵循项目代码规范
- [ ] 提交信息符合规范
- [ ] 无 console.log 调试代码（除非有特殊原因）
- [ ] 新功能已添加必要的注释
- [ ] 更新了相关文档（README、API 文档等）

### PR 标题格式

```
<type>(<scope>): <简短描述>

## 变更内容
- 列出主要变更点...

## 测试说明
- 如何测试这些变更...

## 截图/UI 变更（如适用）
- 添加截图...
```

### PR 审查流程

1. **自动检查** - CI/CD 运行测试和 lint
2. **Code Review** - 至少 1 位维护者审查
3. **修改反馈** - 根据审查意见修改
4. **批准合并** - 维护者 approve 后合并

## 👨‍💻 代码审查标准

维护者在审查 PR 时会关注：

### ✅ 必须通过的项
- 功能正常工作，无回归 Bug
- 代码可读性高，命名清晰
- 错误处理完善
- 安全性考虑（SQL 注入、XSS 等）
- 性能无明显下降

### 👍 加分项
- 单元测试覆盖
- 边界情况处理
- 代码复用性好
- 文档注释完整
- UI/UX 一致性

### ❌ 会拒绝的项
- 引入安全漏洞
- 大幅度降低性能
- 破坏现有 API 兼容性
- 代码质量差、难以维护
- 缺少必要的错误处理

## 🐛 问题报告 (Bug Reports)

发现 Bug？请通过 Issue 报告，包含以下信息：

### Issue 模板

```markdown
## 🐛 Bug 描述
简要描述这个 Bug 是什么...

## 📍 复现步骤
1. 进入 '...' 页面
2. 点击 '....'
3. 向下滚动到 '....'
4. 看到错误

## 😔 期望行为
应该发生什么...

## 📸 截屏
如果有请附上截图...

## 🖥️ 环境
 - OS: [e.g. Windows 11]
 - Browser: [e.g. Chrome 120]
 - Node version: [e.g. 18.17.0]
 - Project version: [e.g. v3.0.0]

## 📝 补充说明
其他可能相关的信息...
```

## 💡 功能请求 (Feature Requests)

想要新功能？欢迎提出！

### 功能请求模板

```markdown
## ✨ 功能描述
清晰简洁地描述你想要的功能...

## 🎯 解决的问题
这个功能解决了什么问题或痛点...

## 💭 解决方案思路
如果你有想法，可以描述实现方案...

## 🔄 替代方案
其他可能的解决方案...

## 📊 附加背景
为什么这个功能重要？有多少用户会受益？
```

## 📞 联系方式

有任何问题？
- 在 Issue 中提问
- 发送邮件至：dev-team@example.com
- 加入讨论组：[Discord/Slack 链接]

---

<div align="center">
<strong>感谢你的贡献！</strong> 🎉
<br><br>
每一个 PR、每一个 Issue 都让 Claw 变得更好
</div>
