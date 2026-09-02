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

// ── 模型预注册（mongoose 模型需 require 一次才会注册；
//    Document.generateDocNumber 内部用 mongoose.model('Counter') 取编号计数器，
//    若 Counter 未注册会抛 "Schema hasn't been registered for model Counter"，导致上传 500）──
require('./models/Counter');

// ── Middleware ──────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGO_URI = safeMongoUri(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary');

// 确保上传目录存在
['uploads', 'uploads/documents', 'uploads/images'].forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(compression());   // 生产：对 JSON/HTML 响应启用 gzip 压缩，降低传输体积
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/companies/:id', companyEntriesRoutes);   // shareholder-entries / director-entries
app.use('/api/companies/:id', companyRegisterRoutes);  // rom / rod PDF

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '3.0' }));

app.use(errorHandler);

// ── MongoDB + Start ─────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB 连接成功');

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
      // 通过 HTTP 调用或直接调用服务层（这里直接用 mongoose）
      const DocumentTemplate = require('./models/DocumentTemplate');
      const count = await DocumentTemplate.countDocuments({ isPreset: true });
      if (count === 0) {
        // 触发一次 /api/templates/initialize 的逻辑
        console.log('🔧 预设模板初始化中...');
      }
    } catch { /* silent */ }

    app.listen(PORT, () => {
      console.log(`
  ┌─────────────────────────────────────────────┐
  │   Company Secretary Management System v3.0  │
  └─────────────────────────────────────────────┘

  ✓ Server running on port ${PORT}
  ✓ MongoDB: connected
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
    });
  } catch (err) {
    console.error('❌ 启动失败:', err.message);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;
