# Claw 全栈部署手册（Render + MongoDB Atlas + Cloudflare R2）

> 目标：部署一个**公网可访问、文件持久化、多人可共享**的公司秘书管理系统。
> 全部使用免费额度，无需信用卡（MongoDB Atlas 需绑定支付方式但 M0 不收费）。

---

## 架构总览

```
浏览器 → Claw 前端 (Render Static, 免费)
              ↓  API 请求
        Claw 后端 (Render Web, 免费, 15min 休眠)
              ↓  MongoDB Driver
        MongoDB Atlas M0 (免费 512MB)
              ↓  文件上传
        Cloudflare R2 (免费 10GB)
```

文件本体存 R2（持久不丢），元数据存 MongoDB（文件名/公司ID/上传者）。

---

## Step 1 — MongoDB Atlas（数据库）

1. 访问 https://www.mongodb.com/atlas 注册账号
2. 创建 **Free Shared Cluster (M0)**
   - Cloud Provider: AWS
   - Region: 选离你近的（如 `ap-southeast-1` 新加坡）
   - Cluster Name: `claw-cluster`
3. 创建 Database User：
   - Username: `claw-user`
   - Password: 点 "Autogenerate" 复制保存
4. 配置 Network Access：
   - 添加 IP `0.0.0.0/0`（允许所有 IP，演示用；生产应限制）
5. 获取连接串：
   - 点 "Connect" → "Drivers" → 复制 `mongodb+srv://claw-user:<password>@claw-cluster.xxxx.mongodb.net/claw_prod?retryWrites=true&w=majority`
   - 替换 `<password>` 为你设的密码

---

## Step 2 — Cloudflare R2（文件存储）

1. 访问 https://dash.cloudflare.com/ 注册/登录（需有 Cloudflare 账号，免费）
2. 左侧 **R2 Object Storage** → **Create bucket**
   - Bucket name: `claw-uploads`
   - Location: `auto`
3. 配置公开访问：
   - 进入 bucket → **Settings** → **Public access** → 开启
   - 记录 **Public URL**（如 `https://pub-xxxx.r2.dev`）
4. 创建 API Token：
   - **Manage R2 API Tokens** → **Create API token**
   - Permissions: `Object Read & Write`
   - 记录：`Access Key ID` / `Secret Access Key`
5. 记录 **S3 Endpoint**：
   - 格式：`https://<account-id>.r2.cloudflarestorage.com`
   - account-id 在 R2 概览页可见

---

## Step 3 — Render（后端 + 前端托管）

1. 访问 https://render.com 注册（可用 GitHub 登录）
2. **New** → **Blueprint** → 连接你的 Git 仓库（CNB / GitHub）
3. 选择仓库中的 `render.yaml`
4. 按提示填入环境变量（见下表）
5. 点击 **Apply** 开始部署

### 需要填入的环境变量

| 变量名 | 值 | 来源 |
|--------|-----|------|
| `MONGODB_URI` | Step 1 复制的连接串 | MongoDB Atlas |
| `CLIENT_URL` | `https://claw-web.onrender.com` | Render 前端地址（部署后填） |
| `STORAGE_DRIVER` | `r2` | 固定值 |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Step 2 的 Access Key | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Step 2 的 Secret Key | Cloudflare R2 |
| `R2_BUCKET_NAME` | `claw-uploads` | Cloudflare R2 |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` | Cloudflare R2 |
| `VITE_API_BASE` | `https://claw-api.onrender.com` | Render 后端地址（部署后填） |

`JWT_SECRET` 和 `NODE_ENV` 会自动生成/填充。

---

## Step 4 — 部署后验证

1. 打开前端地址 `https://claw-web.onrender.com`
2. 注册第一个账号（自动成为 admin）
3. 创建一家公司
4. 进入「合规提醒」或「任务」→ 标记完成 → 上传附件
5. 到「文档管理」页面确认文件已归档到对应公司
6. 刷新页面，确认文件仍在（R2 持久化验证）

---

## 本地开发模式

```bash
# 后端（本地 MongoDB 或 Atlas）
cp .env.example .env  # 填入 MONGODB_URI
npm run server:dev

# 前端（Mock 模式，无需后端）
cd client && npm run dev
```

---

## 常见问题

**Q: Render 免费版休眠后首次访问慢？**
A: 正常，首次请求会触发冷启动（约 30s）。之后 15 分钟内持续响应。

**Q: 文件上传失败？**
A: 检查 R2 环境变量是否正确；本地模式（`STORAGE_DRIVER=local`）可先验证基础功能。

**Q: 想从 Mock 数据导入？**
A: 当前版本从空库开始。如需导入演示数据，联系开发者执行 seed 脚本。

**Q: 成本？**
A: 全程免费。MongoDB Atlas M0 (512MB) + Cloudflare R2 (10GB) + Render Free 均不收费。

---

## 部署进度日志

- 2026-07-09：render.yaml 修复（`claw-web` runtime:static 不支持 `plan:free`，已移除）
- 2026-07-09：claw-api / claw-web 环境变量已配置（MONGODB_URI、CLIENT_URL、R2_*、VITE_API_BASE 等）
- 2026-07-09：MongoDB Atlas IP 白名单已加入 `0.0.0.0/0`（Active），Render 可连集群
- 2026-07-09：推送到 GitHub 触发 Render 自动重新部署（白名单已生效）
