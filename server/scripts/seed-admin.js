// seed-admin.js — 首次部署创建管理员账号（Wave 0）
// 用法：
//   MONGODB_URI=<uri> node server/scripts/seed-admin.js
// 环境变量（均可选）：
//   ADMIN_EMAIL    (默认 admin@example.com)
//   ADMIN_PASSWORD (默认 admin123)
//   ADMIN_NAME     (默认 Administrator)
// 行为：
//   - 默认：若库中已存在任意 admin，则跳过；否则创建。
//   - ADMIN_FORCE=true（或 --force）：强制将现有管理员更新为当前指定账号
//     （邮箱/姓名/密码全部覆盖），用于 Atlas 轮换/初始部署后替换旧 admin。
const mongoose = require('mongoose');
const { safeMongoUri } = require('../utils/mongoUri');
const User = require('../models/User');

const MONGO_URI = safeMongoUri(process.env.MONGODB_URI || process.env.MONGO_URI);
const FORCE = process.env.ADMIN_FORCE === 'true' || process.argv.includes('--force');

if (!MONGO_URI) {
  console.error('❌ 缺少 MONGODB_URI 环境变量');
  process.exit(1);
}

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✅ 已连接数据库');

  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrator';

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    if (!FORCE) {
      console.log(`ℹ️  已存在管理员 (${existingAdmin.email})，跳过创建。如需强制更新为当前指定账号，请加 ADMIN_FORCE=true`);
      await mongoose.disconnect();
      return;
    }
    existingAdmin.email = email;
    existingAdmin.name = name;
    existingAdmin.password = password;
    existingAdmin.role = 'admin';
    existingAdmin.isActive = true;
    await existingAdmin.save();
    console.log(`✅ 已强制更新管理员：${email}`);
    await mongoose.disconnect();
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.isActive = true;
    existing.password = password;
    existing.name = name;
    await existing.save();
    console.log(`✅ 已将现有用户 ${email} 提升为管理员（密码已更新）`);
  } else {
    await User.create({ name, email, password, role: 'admin', isActive: true });
    console.log(`✅ 已创建管理员：${email}`);
  }

  await mongoose.disconnect();
  console.log('完成。');
})().catch(async (err) => {
  console.error('❌ seed-admin 失败：', err.message);
  try { await mongoose.disconnect(); } catch (e) { void e }
  process.exit(1);
});
