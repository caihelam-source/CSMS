const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { safeMongoUri } = require('./utils/mongoUri');

dotenv.config();

// ── Routes ─────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const documentRoutes = require('./routes/documents');
const meetingRoutes = require('./routes/meetings');
const taskRoutes = require('./routes/tasks');
const complianceRuleRoutes = require('./routes/complianceRules');
const complianceReminderRoutes = require('./routes/complianceReminders');
const templateRoutes = require('./routes/templates');
const signTaskRoutes = require('./routes/signTasks');
const personnelRoutes = require('./routes/personnel');
const resultsTimetableRoutes = require('./routes/resultsTimetable');
const companyEntriesRoutes = require('./routes/companyEntries');
const companyRegisterRoutes = require('./routes/companyRegister');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const calendarRoutes = require('./routes/calendar');   // Wave 日历模块 — 跨模块事件聚合 + 邮件摘要
const nar1ImportRoutes = require('./routes/nar1Import');   // NAR1 周年申报表批量导入（识别 -> 冲突检测 -> 落库）
const announcementRoutes = require('./routes/announcements');   // 首页公告（前台读 / 后台 CRUD）

// ── 模型预注册（mongoose 模型需 require 一次才会注册；
//    Document.generateDocNumber 内部用 mongoose.model('Counter') 取编号计数器，
//    若 Counter 未注册会抛 "Schema hasn't been registered for model Counter"，导致上传 500）──
require('./models/Counter');

// ── Middleware ──────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app = express();
// 注意：本服务在 Render 上并没有注入 PORT 环境变量（env-vars 里没有 PORT）。
// 历史唯一成功部署 5d2c4ee 用的就是 `process.env.PORT || 5000`，即实际监听 5000。
// 之前改成 10000 后 Render 端口自动探测始终失败（No open HTTP ports / Port scan timeout），
// 因此这里恢复为 5000，与已验证成功的部署保持一致。
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGO_URI = safeMongoUri(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary');

// 确保上传目录存在
['uploads', 'uploads/documents', 'uploads/images'].forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── Middleware ──────────────────────────────────────────────
// CORS：放行 CLIENT_URL（支持逗号分隔多来源，便于 claw-web 多环境），
// 并放行所有 localhost / 127.0.0.1 本地开发来源（claw-web 本地 dev、
// claw-mini H5 本地预览 http://localhost:8080 等）。受保护路由仍需 JWT，
// 放开本地来源不会暴露任何未授权数据。
//
// ⚠️ 致命坑（2026-10-13 ~ 10-20 线上全线部署失败根因）：
// cors 包在 origin 为「函数」时会调用 origin(请求Origin, callback) 并**等待回调**；
// 若只 return true/false 而不调用 callback，中间件永远不会 next()，
// 每个 HTTP 请求（含 Render 端口探针）都会永久挂起 →
// 现象就是 "No open HTTP ports detected on 0.0.0.0" + 端口扫描超时。
// 必须显式 callback(null, 布尔值)。
const isAllowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true); // 非浏览器上下文（curl / 小程序原生请求）放行
  const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return callback(null, true);
  return callback(null, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
};
app.use(cors({ origin: isAllowedOrigin, credentials: true }));
app.use(compression());   // 生产：对 JSON/HTML 响应启用 gzip 压缩，降低传输体积
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 诊断用：记录前 30 个进来的 HTTP 请求，确认 Render 端口扫描是否真的连到了本进程
let __reqLogged = 0;
app.use((req, res, next) => {
  if (__reqLogged < 30) { __reqLogged++; console.log('REQ ' + req.method + ' ' + req.url); }
  next();
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/compliance-rules', complianceRuleRoutes);
app.use('/api/compliance-reminders', complianceReminderRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/sign-tasks', signTaskRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/results-timetable', resultsTimetableRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);   // Wave 0 rev2 — 审计日志（admin/auditor 可查）
app.use('/api/calendar', calendarRoutes);   // Wave 日历模块 — 跨模块事件聚合 + 邮件摘要
app.use('/api/nar1-import', nar1ImportRoutes);   // NAR1 批量导入
app.use('/api/announcements', announcementRoutes);   // 首页公告（前台读 / 后台 CRUD）
app.use('/api/companies/:id', companyEntriesRoutes);   // shareholder-entries / director-entries
app.use('/api/companies/:id', companyRegisterRoutes);  // rom / rod PDF

// 健康检查：端口一开即返回 200（让 Render 端口扫描/健康检查立刻通过），
// DB 状态放在 body 的 db 字段里供监控，不靠 HTTP 状态码卡部署（避免 21s 初始化窗口内 503 拖垮部署）。
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: connected ? 'ok' : 'starting',
    version: '5.2.0',
    commit: process.env.RENDER_GIT_COMMIT || 'local',
    service: process.env.RENDER_SERVICE_NAME || null,
    serviceId: process.env.RENDER_SERVICE_ID || null,
    startedAt: SERVER_STARTED_AT,
    db: connected ? 'connected' : 'connecting',
    ts: Date.now(),
  });
});

app.use(errorHandler);

// 服务启动时刻：用于 /api/health 暴露，便于远程验证「是否刚部署了新镜像」
const SERVER_STARTED_AT = Date.now();

// 部署心跳：把启动阶段写入 Atlas 的 deployheartbeats 集合，
// 这样即使看不到 Render 构建日志，也能通过直连 Atlas 判断构建走到了哪一步。
// （build 失败=无心跳；listen 有但 db_connected 无=DB 连接/初始化失败；都有=启动成功）
async function writeHeartbeat(phase, info = {}) {
  let conn;
  try {
    conn = mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await conn.asPromise();
    const coll = conn.collection('deployheartbeats');
    await coll.insertOne({
      commit: process.env.RENDER_GIT_COMMIT || 'local',
      version: '5.2.0',
      phase,
      startedAt: SERVER_STARTED_AT,
      service: process.env.RENDER_SERVICE_NAME || null,
      serviceId: process.env.RENDER_SERVICE_ID || null,
      externalUrl: process.env.RENDER_EXTERNAL_URL || null,
      instance: process.env.RENDER_INSTANCE_ID || null,
      port: PORT,
      info,
      ts: new Date(),
    });
  } catch (_) {
    /* best-effort，绝不影响启动 */
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ── MongoDB + Start ─────────────────────────────────────────
// 关键：先绑定端口（尽早，满足 Render 端口扫描，否则 20+ 秒的启动工作
// 会把端口开放拖到扫描窗口之后 → Port scan timeout / No open HTTP ports）。
// DB 连接与初始化放到监听「之后」后台执行，不阻塞端口开放。
// 显式绑定 0.0.0.0（IPv4）：Render 端口扫描走 IPv4，绑定 :: 双栈在某些环境下
// IPv4 探测会 misses → No open HTTP ports。0.0.0.0 是 Render 官方推荐写法。
async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB 连接成功');
    writeHeartbeat('db_connected');

    // 初始化预设规则
    const { initPresetRules } = require('./services/complianceService');
    await initPresetRules();

    // M2.2 搜索全文索引（防御式，失败不影响启动）
    try {
      const { ensureSearchIndexes } = require('./searchIndexes');
      await ensureSearchIndexes();
    } catch (e) {
      console.warn('⚠️ 搜索索引初始化跳过:', e.message);
    }

    // 初始化预设模板
    try {
      const DocumentTemplate = require('./models/DocumentTemplate');
      const count = await DocumentTemplate.countDocuments({ isPreset: true });
      if (count === 0) console.log('🔧 预设模板初始化中...');
    } catch { /* silent */ }

    // 与 2026-09-28 成功部署 5d2c4ee 一致：不指定 host → :: 双栈。
    // 实证：listen-first 会稳定触发 Render 的 Port scan timeout，listen-after-connect 不会。
    const server = app.listen(PORT, () => {
      try { console.log('BIND_ADDRESS ' + JSON.stringify(server.address())); } catch (_) {}
      console.log(`
  ┌─────────────────────────────────────────────┐
  │   Company Secretary Management System v5.2.0  │
  └─────────────────────────────────────────────┘

  ✓ Server running on port ${PORT}
  ✓ Environment: ${process.env.NODE_ENV || 'development'}
  ✓ Frontend URL: ${CLIENT_URL}

  Routes:
    /api/companies            公司管理 + Excel导入 + 统一关联links
    /api/documents            文档管理 + 自动编号
    /api/compliance-rules     合规规则管理（17条预设）
    /api/compliance-reminders 合规提醒管理
    /api/templates            文书模板（Schema 引擎）+ 预填解析
    /api/sign-tasks           电子签署流程
    /api/personnel             人员库（董事/股东/职员）
    /api/companies/:id/...     股东条目/董事条目/ROM/ROD
      `);
      writeHeartbeat('listen');
    });
  } catch (err) {
    console.error('❌ 启动失败:', err.message);
    writeHeartbeat('db_failed', { error: err.message }).finally(() => process.exit(1));
  }
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;
