# 📖 API 文档 - Claw Company Secretary Management System

## 基础信息

- **Base URL**: `http://localhost:5000/api`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 目录

1. [认证模块 (Authentication)](#认证模块)
2. [公司管理 (Companies)](#公司管理)
3. [董事管理 (Directors)](#董事管理)
4. [人员库管理 (Personnel)](#人员库管理)
5. [条目管理 (Company Entries)](#条目管理)
6. [登记册生成 (Company Register)](#登记册生成)
7. [文档管理 (Documents)](#文档管理)
8. [会议管理 (Meetings)](#会议管理)
9. [任务管理 (Tasks)](#任务管理)
10. [合规规则 (Compliance Rules)](#合规规则)
11. [合规提醒 (Compliance Reminders)](#合规提醒)
12. [文档模板 (Templates)](#文档模板)
13. [电子签署 (Sign Tasks)](#电子签署)

---

## 认证模块

### POST /auth/register
注册新用户。

**请求体**:
```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "password123",
  "role": "admin"
}
```

**响应** (201):
```json
{
  "success": true,
  "data": {
    "_id": "660f8b9d8c9e4a0012345678",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### POST /auth/login
用户登录。

**请求体**:
```json
{
  "email": "zhangsan@example.com",
  "password": "password123"
}
```

**响应** (200):
```json
{
  "success": true,
  "data": {
    "_id": "660f8b9d8c9e4a0012345678",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### GET /auth/me
获取当前登录用户信息（需要认证）。

**请求头**:
```
Authorization: Bearer <token>
```

**响应** (200):
```json
{
  "success": true,
  "data": {
    "_id": "660f8b9d8c9e4a0012345678",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin"
  }
}
```

---

## 公司管理

### GET /companies
获取所有公司列表，支持分页、搜索和筛选。

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 10 | 每页数量 |
| search | string | - | 公司名称/编号搜索 |
| status | string | - | 状态筛选: active/inactive/dissolved |
| type | string | - | 公司类型 |

**响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "_id": "company123",
      "name": "测试有限公司",
      "registrationNumber": "1234567",
      "type": "private limited",
      "status": "active",
      "incorporationDate": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 48
  }
}
```

### POST /companies
创建新公司。

**请求体**:
```json
{
  "name": "新公司名称",
  "registrationNumber": "7654321",
  "type": "private limited",
  "registeredAddress": {
    "line1": "香港中环皇后大道中1号",
    "city": "香港",
    "region": "中国香港",
    "country": "China"
  },
  "complianceCategory": "standard"
}
```

### PUT /companies/:id
更新公司信息。

**请求参数**:
- `id` (路径): 公司 ID

**请求体**: 同上（只需提供要更新的字段）

### DELETE /companies/:id
删除公司。

**响应** (200):
```json
{
  "success": true,
  "message": "公司已成功删除"
}
```

### POST /companies/import
从 Excel 文件批量导入公司。

**请求格式**: `multipart/form-data`
- `file`: Excel 文件 (.xlsx, .xls)

### GET /companies/:id/directors
获取公司的所有董事。

### GET /companies/export-template
获取 Excel 导入模板下载。

---

## 人员库管理

### GET /personnel
获取所有人员记录。

**查询参数**: 同 companies（支持分页搜索）

### POST /personnel
创建人员记录。

**请求体**:
```json
{
  "name": "李四",
  "type": "individual",
  "personalInfo": {
    "idNumber": "H123456(7)",
    "nationality": "中国",
    "dateOfBirth": "1985-06-15"
  },
  "contactInfo": {
    "email": "lisi@example.com",
    "phone": "+852 9123 4567"
  },
  "roles": ["director", "shareholder"]
}
```

### PUT /personnel/:id
更新人员信息。

### DELETE /personnel/:id
删除人员记录。

### POST /personnel/:id/appointments
为人员添加任职记录。

**请求体**:
```json
{
  "role": "director",
  "companyId": "company123",
  "appointmentDate": "2024-01-20",
  "notes": "通过股东大会任命"
}
```

---

## 条目管理

### GET /company-entries/:companyId/shareholder-entries
获取公司的股东条目列表。

### POST /company-entries/:companyId/shareholder-entries
添加股东条目。

**请求体**:
```json
{
  "shareholderType": "individual",
  "personnelId": "personnel123",
  "shareClass": "ordinary",
  "shareRecords": [
    {
      "action": "allotment",
      "numberOfShares": 1000,
      "amountPaid": 10000,
      "date": "2024-02-01"
    }
  ]
}
```

### GET /company-entries/:companyId/director-entries
获取公司的董事条目列表（用于 ROD）。

### POST /company-entries/:companyId/director-entries
添加董事条目。

---

## 登记册生成

### GET /company-register/:companyId/rom
生成股东名册 (Register of Members) PDF。

**响应**: PDF 文件流 (`application/pdf`)

**查询参数**:
- `asOfDate` (可选): 截止日期，格式 YYYY-MM-DD

### GET /company-register/:companyId/rod
生成董事名册 (Register of Directors) PDF。

**响应**: PDF 文件流 (`application/pdf`)

---

## 合规提醒

### GET /compliance-reminders
获取合规提醒列表。

**查询参数**:
- `status`: pending/completed/overdue
- `priority`: high/medium/low

### PUT /compliance-reminders/:id/complete
标记提醒为已完成。

### POST /compliance-rules/:ruleId/generate-reminder
根据规则生成新的合规提醒。

---

## 文档模板

### GET /templates
获取所有模板列表。

### POST /templates
创建新模板。

**请求体**:
```json
{
  "name": "董事会决议模板",
  "category": "board-resolution",
  "description": "用于董事会决议的通用模板",
  "variables": [
    { "name": "companyName", "label": "公司名称", "type": "text" },
    { "name": "date", "label": "会议日期", "type": "date" },
    { "name": "directors", "label": "出席董事", "type": "list" }
  ]
}
```

### POST /templates/:id/render
渲染模板预览。

**请求体**:
```json
{
  "variables": {
    "companyName": "测试有限公司",
    "date": "2024-03-15",
    "directors": ["张三", "李四", "王五"]
  }
}
```

**响应**: 渲染后的文档（Word 或 PDF 格式）

---

## 错误处理

### 标准错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息（仅开发环境）",
  "code": "ERROR_CODE"
}
```

### HTTP 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 422 | 数据验证失败 |
| 500 | 服务器内部错误 |

### 常见错误代码

| 错误代码 | 说明 |
|----------|------|
| AUTH_TOKEN_EXPIRED | Token 已过期 |
| AUTH_TOKEN_INVALID | Token 无效 |
| VALIDATION_ERROR | 数据验证失败 |
| NOT_FOUND | 资源不存在 |
| DUPLICATE_ENTRY | 重复数据（如重复邮箱） |
| FILE_TOO_LARGE | 上传文件超过限制 |
| UNSUPPORTED_FILE_TYPE | 不支持的文件类型 |

---

## 分页规范

所有列表接口都支持统一分页：

**请求参数**:
- `page`: 页码（从 1 开始）
- `limit`: 每页数量（默认 10，最大 100）

**响应结构**:
```json
{
  "data": [...],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 48,
    "limit": 10
  }
}
```

---

*完整 API 文档持续更新中...*
