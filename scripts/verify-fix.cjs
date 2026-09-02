// 验证：模拟修复后的 GET /api/companies 查询（status:{$ne:'merged'}），
// 确认返回的公司数、且无 merged 泄漏。
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const URI = 'mongodb+srv://caihelam_db_user:KnCTKOi9QCgMQk34@csms-cluster0.83kh9al.mongodb.net/claw_prod?retryWrites=true&w=majority';
(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 15000 });
  const cos = mongoose.connection.db.collection('companies');
  const total = await cos.countDocuments({});
  const visible = await cos.countDocuments({ status: { $ne: 'merged' } });
  const merged = await cos.countDocuments({ status: 'merged' });
  const leaked = await cos.countDocuments({ status: { $ne: 'merged' }, mergedInto: { $exists: true } });
  console.log('BEFORE fix (no filter):', total, 'companies');
  console.log('AFTER fix (status:{$ne:"merged"}):', visible, 'companies');
  console.log('merged records hidden:', merged);
  console.log('leaked merged into visible set:', leaked, '(must be 0)');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
