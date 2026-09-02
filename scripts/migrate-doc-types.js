/**
 * migrate-doc-types.js — 一次性把已存 30 份 nar1+br doc 的 type 字段升级到 v6.x 新 enum
 *   - type='return' + category='annual_return' → type='nar1_return' (14 份)
 *   - type='certificate' + category='br_certificate' → type='business_registration' (16 份)
 * 同步保证 compliance / 模板 / 旧 migration 兼容：
 *   - 老脚本可能按 'return'/'certificate' 查过，因此保留兼容字段 nar1_return / business_registration 的同时
 *     别动 certificate / return 已存的其他(非 NAR1/BR)文档。
 * 幂等 — 重复运行 no-op。
 */
const dns = require('dns'); dns.setServers(['8.8.8.8','1.1.1.1']);
const fs = require('fs'); const path = require('path');
const txt = fs.readFileSync(path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md'), 'utf8');
const m = txt.match(/mongodb\+srv:\/\/\S+/i);
process.env.MONGODB_URI = (m ? m[0] : '').replace(/["'`)\]]/g, '').trim();
const mongoose = require('mongoose');
(async () => {
  if (!process.env.MONGODB_URI) { console.error('NO_MONGODB_URI'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = require('../server/models/Document');
  // 14 份 NAR1
  const r1 = await Document.updateMany(
    { type: 'return', category: 'annual_return' },
    { $set: { type: 'nar1_return' } }
  );
  console.log(`✅ NAR1: matched=${r1.matchedCount} modified=${r1.modifiedCount}`);
  // 16 份 BR
  const r2 = await Document.updateMany(
    { type: 'certificate', category: 'br_certificate' },
    { $set: { type: 'business_registration' } }
  );
  console.log(`✅ BR:   matched=${r2.matchedCount} modified=${r2.modifiedCount}`);
  // 抽样
  const samples = await Document.find({}, { name:1, type:1, category:1 }).limit(3).lean();
  for (const s of samples) console.log(`   • ${(s.type||'?').padEnd(22)} | ${(s.category||'?').padEnd(20)} | ${s.name.slice(0,55)}`);
  await mongoose.disconnect();
})();
