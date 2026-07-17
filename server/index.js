const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

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
const companyEntriesRoutes = require('./routes/companyEntries');
const companyRegisterRoutes = require('./routes/companyRegister');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');

// ── Middleware ──────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary';

// 确保上传目录存在
['uploads', 'uploads/documents', 'uploads/images'].forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
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
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
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
    /api/templates            文档模板 + 变量渲染
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
