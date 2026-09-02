// 诊断：列出 Atlas 中所有 Company，标注 status / formerNames / mergedInto，
// 并按 (name, nameChinese, registrationNumber) 聚类找出重复。
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const URI = 'mongodb+srv://caihelam_db_user:KnCTKOi9QCgMQk34@csms-cluster0.83kh9al.mongodb.net/claw_prod?retryWrites=true&w=majority';

(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const cos = db.collection('companies');

  const all = await cos.find({}, {
    name: 1, nameChinese: 1, registrationNumber: 1, brNumber: 1,
    status: 1, formerNames: 1, mergedInto: 1, jurisdiction: 1,
    createdAt: 1,
  }).sort({ name: 1 }).toArray();

  console.log('TOTAL companies in Atlas:', all.length);
  console.log('='.repeat(100));

  // 1) 显示所有 status != active 或 mergedInto 存在的
  console.log('\n### NON-ACTIVE / MERGED records ###');
  all.forEach(c => {
    if (c.status && c.status !== 'active' || c.mergedInto || (c.formerNames && c.formerNames.length)) {
      console.log(
        `[${c.status || '?'}] id=${c._id} name="${c.name}" zh="${c.nameChinese || ''}" br=${c.registrationNumber || ''}` +
        (c.mergedInto ? ` mergedInto=${c.mergedInto}` : '') +
        (c.formerNames && c.formerNames.length ? ` formerNames=${JSON.stringify(c.formerNames)}` : '')
      );
    }
  });

  // 2) 按 normalized name 聚类找重复
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const groups = {};
  all.forEach(c => {
    const key = norm(c.name) + '|' + norm(c.nameChinese) + '|' + norm(c.registrationNumber);
    (groups[key] = groups[key] || []).push(c);
  });

  console.log('\n### DUPLICATE groups (same name+zh+BR) ###');
  let dupCount = 0;
  Object.entries(groups).forEach(([k, arr]) => {
    if (arr.length > 1) {
      dupCount++;
      console.log(`\n[DUPLICATE x${arr.length}] key=${k}`);
      arr.forEach(c => console.log(
        `   id=${c._id} status=${c.status || '?'} name="${c.name}" zh="${c.nameChinese || ''}" br=${c.registrationNumber || ''}` +
        (c.mergedInto ? ` mergedInto=${c.mergedInto}` : '')
      ));
    }
  });
  if (dupCount === 0) console.log('  (none by exact name+zh+BR)');

  // 3) 仅按 name 聚类（忽略 BR）找同名
  const byName = {};
  all.forEach(c => { const k = norm(c.name); (byName[k] = byName[k] || []).push(c); });
  console.log('\n### SAME-NAME groups (ignore BR/zh) ###');
  let sameName = 0;
  Object.entries(byName).forEach(([k, arr]) => {
    if (arr.length > 1) {
      sameName++;
      console.log(`\n[SAME NAME x${arr.length}] "${k}"`);
      arr.forEach(c => console.log(
        `   id=${c._id} status=${c.status || '?'} zh="${c.nameChinese || ''}" br=${c.registrationNumber || ''}` +
        (c.mergedInto ? ` mergedInto=${c.mergedInto}` : '')
      ));
    }
  });
  if (sameName === 0) console.log('  (none by name alone)');

  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e); process.exit(1); });
