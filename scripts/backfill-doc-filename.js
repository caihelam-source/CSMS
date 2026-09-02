/**
 * backfill-doc-filename.js — 一次性回填 Document.filename 字段
 *
 * 根因:seed-nar1-full.js 的 upsert 只写了 fileName/fileUrl,
 *      漏了 schema 定义的 filename (R2 object key / 本地磁盘文件名) 字段。
 *      后端 GET /api/documents/:id/view 和 /download 首行守卫:
 *        if (!doc || !doc.filename) return 404 "File not found"
 *      导致前端 fetchDocPreview / downloadDoc 全部 404,
 *      走 fallback 显示"此文件类型不支持内联预览,或加载失败"。
 *
 * 修法:用 fileName (R2 object key) 直接回填到 filename。
 *      幂等 — 已回填的 doc 会 no-op。
 */
const dns = require('dns'); dns.setServers(['8.8.8.8','1.1.1.1']);
const fs = require('fs');
const path = require('path');
const txt = fs.readFileSync(path.join(__dirname, '..', '.workbuddy', 'memory', 'SECRETS.md'), 'utf8');
const m = txt.match(/mongodb\+srv:\/\/\S+/i);
process.env.MONGODB_URI = (m ? m[0] : '').replace(/["'`)\]]/g, '').trim();
const mongoose = require('mongoose');
(async () => {
  if (!process.env.MONGODB_URI) { console.error('NO_MONGODB_URI'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = require('../server/models/Document');
  const total = await Document.countDocuments();
  const missing = await Document.countDocuments({ $or: [ { filename: { $exists: false } }, { filename: null }, { filename: '' } ] });
  console.log(`📊 documents=${total} 缺 filename=${missing}`);
  // fileName 存的是 R2 object key (时间戳-随机串.pdf),与 filename 同义
  const r = await Document.updateMany(
    { $or: [ { filename: { $exists: false } }, { filename: null }, { filename: '' } ] },
    [ { $set: { filename: '$fileName' } } ],
    { strict: false },
  );
  console.log(`✅ 回填 matched=${r.matchedCount} modified=${r.modifiedCount}`);
  // 回填后再核对
  const stillMissing = await Document.countDocuments({ $or: [ { filename: { $exists: false } }, { filename: null }, { filename: '' } ] });
  console.log(`🔍 仍缺 filename=${stillMissing}`);
  // 抽样
  const samples = await Document.find({ filename: { $ne: null } }).limit(3).lean();
  for (const s of samples) console.log(`   • ${s.name} -> filename=${s.filename}`);
  await mongoose.disconnect();
})();
