#!/usr/bin/env node
/**
 * fix-zhongan-stockcode.cjs — 修正众安集团港股代码（000672 → 00672）
 *
 * 背景（2026-09-11）：
 *   生产库 claw_prod 里 `Zhong An Group Limited`（registrationNumber=38403862，Cayman，
 *   在港上市，nonHongKongCompany=true）的 stockCode 被录成 5 位 `000672`。
 *   经众安集团官网 + 浙江省贸促会双源核实，正确代码为 5 位补零的 `00672`
 *   （众安集团 00672 / 中国新城市集团 01321 / 众安智慧生活 02271）。
 *   stockCode 无唯一索引，录错不会报错，但会在合规看板、公告归档、前端展示里串号。
 *
 * 设计取舍：
 *   - 只改 stockCode 一个字段，用 registrationNumber 精确定位，不做模糊匹配
 *   - 修改前把「将被修改的文档」完整导出到 .workbuddy/backups/（含时间戳）
 *   - 默认 dry-run，只有显式 --apply 才写库
 *   - 若目标公司当前 stockCode 已经不是期望的「错值」，默认中止（--force 可强行覆盖）
 *
 * 用法：
 *   node scripts/fix-zhongan-stockcode.cjs                 # dry-run（默认，列出将如何修改）
 *   node scripts/fix-zhongan-stockcode.cjs --apply         # 备份后真正写库
 *   node scripts/fix-zhongan-stockcode.cjs --list          # 只列出全部上市主体的 stockCode（只读）
 *   node scripts/fix-zhongan-stockcode.cjs --reg=38403862 --from=000672 --to=00672
 *
 * 注意：需要出网，Bash 请使用 dangerouslyDisableSandbox: true。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Atlas SRV 解析依赖外网 DNS；沙箱/公司网络下常解析失败，显式指定公共 DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.log('⚠️  无法设置 DNS resolver:', err.message);
}

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, '.workbuddy', 'backups');

/** 命令行参数：--apply / --list / --reg= / --from= / --to= */
const APPLY = process.argv.includes('--apply');
const LIST_ONLY = process.argv.includes('--list');

/**
 * 读取形如 `--key=value` 的参数，缺失时返回 fallback。
 * @param {string} name 参数名（不含 --）
 * @param {string} fallback 缺省值
 * @returns {string} 参数值
 */
function arg(name, fallback) {
  const hit = process.argv.find((x) => x.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const TARGET_REG = arg('reg', '38403862');
const WRONG_CODE = arg('from', '000672');
const RIGHT_CODE = arg('to', '00672');

/**
 * 从 .workbuddy/memory/SECRETS.md 提取 MongoDB URI。
 * 优先读环境变量 MONGODB_URI；绝不打印 URI（含凭据）。
 * @returns {string} mongodb+srv URI
 */
function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  const secretsPath = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');
  if (!fs.existsSync(secretsPath)) throw new Error('找不到 .workbuddy/memory/SECRETS.md');
  const txt = fs.readFileSync(secretsPath, 'utf8');
  const m = txt.match(/mongodb\+srv:\/\/\S+/);
  if (!m) throw new Error('SECRETS.md 里找不到 mongodb+srv:// 开头的 URI');
  return m[0].replace(/["'`)\]]/g, '').trim();
}

/**
 * 把任意对象完整落盘到 .workbuddy/backups/，用于改数据前留痕。
 * @param {string} prefix 文件名前缀
 * @param {*} data 待备份数据
 * @returns {string} 备份文件绝对路径
 */
function backup(prefix, data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${prefix}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

/** 打印一行上市主体快照 */
function printCompany(c) {
  console.log(
    `  ${String(c.name).slice(0, 44).padEnd(46)}` +
    `reg=${String(c.registrationNumber || '-').padEnd(26)}` +
    `jur=${String(c.jurisdiction || '-').padEnd(8)}` +
    `listed=${String(c.isListed || false).padEnd(6)}` +
    `loc=${String(c.listingLocation || '-').padEnd(4)}` +
    `code=${String(c.stockCode || '-')}`
  );
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  console.log('✅ 已连接 Atlas:', mongoose.connection.db.databaseName);

  // ---------- 1. 全量上市主体快照（人工交叉核对用） ----------
  const listed = await Company.find({ isListed: true })
    .select('name nameChinese registrationNumber jurisdiction isListed listingLocation stockCode')
    .sort({ stockCode: 1, name: 1 })
    .lean();
  console.log(`\n=== 1. 上市主体 stockCode 快照（共 ${listed.length} 家）===`);
  listed.forEach(printCompany);

  if (LIST_ONLY) {
    await mongoose.disconnect();
    return;
  }

  // ---------- 2. 定位目标公司 ----------
  const target = await Company.findOne({ registrationNumber: TARGET_REG }).lean();
  console.log(`\n=== 2. 目标公司（registrationNumber=${TARGET_REG}）===`);
  if (!target) {
    console.log(`❌ 未找到 registrationNumber=${TARGET_REG} 的公司，中止。`);
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }
  console.log(`  _id        = ${target._id}`);
  console.log(`  name       = ${target.name}${target.nameChinese ? ' / ' + target.nameChinese : ''}`);
  console.log(`  jurisdiction=${target.jurisdiction}  isListed=${target.isListed}  listingLocation=${target.listingLocation}`);
  console.log(`  stockCode  = ${JSON.stringify(target.stockCode)} → 期望 ${JSON.stringify(RIGHT_CODE)}`);

  if (target.stockCode === RIGHT_CODE) {
    console.log('\n✅ stockCode 已经是正确的值，无需修改。');
    await mongoose.disconnect();
    return;
  }
  if (target.stockCode !== WRONG_CODE && !process.argv.includes('--force')) {
    console.log(
      `\n⚠️  当前 stockCode=${JSON.stringify(target.stockCode)} 既不等于期望值，也不等于预期的错值 ` +
      `${JSON.stringify(WRONG_CODE)}。为避免误改，已中止。确认要覆盖请加 --force。`
    );
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  // ---------- 3. 冲突检查：是否已有别的公司占用目标代码 ----------
  const conflicts = await Company.find({ stockCode: RIGHT_CODE, _id: { $ne: target._id } })
    .select('name registrationNumber stockCode').lean();
  if (conflicts.length) {
    console.log(`\n⚠️  代码 ${RIGHT_CODE} 已被以下 ${conflicts.length} 家公司占用（stockCode 无唯一索引，仍可继续）：`);
    conflicts.forEach((c) => console.log(`    - ${c.name} (reg=${c.registrationNumber})`));
  }

  console.log('\n=== 3. 修改计划 ===');
  console.log(`  ${target._id}  ${target.name}`);
  console.log(`  stockCode: ${JSON.stringify(target.stockCode)} → ${JSON.stringify(RIGHT_CODE)}`);

  if (!APPLY) {
    console.log('\n[只读模式] 未写库。确认无误后加 --apply 执行（会先备份到 .workbuddy/backups/）。');
    await mongoose.disconnect();
    return;
  }

  // ---------- 4. 备份 → 写库 → 复验 ----------
  const file = backup('stockcode-fix-before', {
    generatedAt: new Date().toISOString(),
    collection: 'companies',
    operation: { from: target.stockCode, to: RIGHT_CODE, registrationNumber: TARGET_REG },
    documents: [target],
  });
  console.log(`\n📦 已备份修改前文档: ${file}`);

  const res = await Company.updateOne(
    { _id: target._id },
    { $set: { stockCode: RIGHT_CODE } }
  );
  console.log(`✏️  updateOne matched=${res.matchedCount} modified=${res.modifiedCount}`);

  const after = await Company.findById(target._id).select('name registrationNumber stockCode').lean();
  console.log(`✅ 复验: ${after.name} (reg=${after.registrationNumber}) stockCode=${JSON.stringify(after.stockCode)}`);
  console.log(after.stockCode === RIGHT_CODE ? '✅ 修正成功' : '❌ 复验失败，请检查');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
