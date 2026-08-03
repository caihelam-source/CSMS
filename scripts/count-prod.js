// count-prod.js — 统计生产库业务数据（Company / Personnel / Company.links 中枢）
// 用法（PowerShell）:
//   $env:MONGODB_URI = "mongodb+srv://user:pwd@host/claw_prod?retryWrites=true&w=majority"
//   node scripts/count-prod.js
//
// ⚠️ 注意：直接 db.collection('<name>') 数集合名很脆弱 —— Personnel 模型未显式指定集合名，
//    mongoose 自动复数化为 `personnels`（不是 personnel）。本脚本改用模型计数，始终与 app 一致。
const m = require('mongoose');
const path = require('path');
const Company = require(path.join(__dirname, '..', 'server', 'models', 'Company'));
const Personnel = require(path.join(__dirname, '..', 'server', 'models', 'Personnel'));

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

m.connect(uri)
  .then(async () => {
    const companies = await Company.countDocuments();
    const personnel = await Personnel.countDocuments();
    // mongoose Model.aggregate() 直接 await 得数组，不能用 .toArray()（那是原生 driver 集合方法）
    const links = await Company.aggregate([
      { $project: { n: { $size: { $ifNull: ['$links', []] } } } },
      { $group: { _id: 0, total: { $sum: '$n' } } },
    ]);
    console.log(JSON.stringify(
      { companies, personnel, totalCompanyLinks: links[0] && links[0].total },
      null, 2,
    ));
    process.exit(0);
  })
  .catch((e) => { console.error(e); process.exit(1); });
