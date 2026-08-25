#!/usr/bin/env node
'use strict';

/**
 * 迁移脚本：把旧 HTML 引擎模板（engine:'html' 且/或 content 为 HTML 正文）转换为 schema 引擎模板。
 *
 * 步骤：备份 → 转换 → assertValidDocSchema 校验 → 落库(engine:'schema') → 报告。
 *
 * 幂等：只挑 engine !== 'schema' 的文档；已迁移的（engine:'schema'）不会被再次拾取，可安全重跑。
 *
 * 用法：
 *   # 1) 先干跑（只出台账 + 转换预览，绝不写库）
 *   MONGODB_URI="mongodb://..." node scripts/migrateHtmlTemplates.cjs --dry-run
 *   # 2) 确认台账无误后再真跑（自动备份原始文档）
 *   MONGODB_URI="mongodb://..." node scripts/migrateHtmlTemplates.cjs
 * 或保证 server/config 导出 MONGODB_URI。
 *
 * 退出码：0 = 全部成功/无需迁移；1 = 连接失败或存在「转换失败」条目（需人工介入）。
 *
 * 注意：本脚本不引入任何新 npm 依赖，仅使用仓库已有依赖（mongoose / mongodb-memory-server 不在此脚本使用）。
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DocumentTemplate = require('../server/models/DocumentTemplate');
const { convertHtmlToDocSchema } = require('../server/services/htmlToDocSchema');
const { assertValidDocSchema, deriveVariables, SCHEMA_VERSION } = require('../server/constants/templateSchema');
const { safeMongoUri } = require('../server/utils/mongoUri');

/**
 * 解析 MongoDB 连接串：优先环境变量，其次尝试 server/config 模块。
 * @returns {string|null}
 */
function resolveUri() {
  const fromEnv = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (fromEnv) return fromEnv;
  try {
    // server/config 可能不存在或导出不同字段名，逐一尝试
    const cfg = require(path.resolve(__dirname, '../server/config'));
    return (
      cfg.MONGODB_URI ||
      cfg.mongoUri ||
      cfg.uri ||
      cfg.connectionString ||
      (cfg.default && (cfg.default.MONGODB_URI || cfg.default.mongoUri)) ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * 找出需要迁移的旧 HTML 模板。
 * @returns {Promise<Array<object>>} lean 文档数组（去重）
 */
async function findLegacyTemplates() {
  const byId = new Map();
  // 1) 显式 engine:'html'
  const htmlEngine = await DocumentTemplate.find({ engine: 'html' }).lean();
  for (const doc of htmlEngine) byId.set(String(doc._id), doc);
  // 2) 兜底：engine 缺失/非 schema，但 content 看起来像 HTML
  const possible = await DocumentTemplate.find({
    engine: { $ne: 'schema' },
    content: { $exists: true, $nin: ['', null] },
  }).lean();
  for (const doc of possible) {
    const content = typeof doc.content === 'string' ? doc.content : '';
    if (/<(h[1-6]|p|div|table|ul|ol|br|hr)\b/i.test(content)) {
      byId.set(String(doc._id), doc);
    }
  }
  return Array.from(byId.values());
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');
  const uri = resolveUri();
  if (!uri) {
    console.error('✗ 未找到 MongoDB 连接串。');
    console.error('  用法：MONGODB_URI="mongodb://..." node scripts/migrateHtmlTemplates.cjs');
    console.error('  或确保 server/config 导出 MONGODB_URI / mongoUri。');
    process.exit(1);
    return;
  }

  await mongoose.connect(safeMongoUri(uri), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✓ MongoDB 已连接');
  if (DRY_RUN) console.log('🧪 DRY-RUN 模式：只出台账与转换预览，不会写入任何数据。');

  const legacy = await findLegacyTemplates();
  if (legacy.length === 0) {
    console.log('ℹ️ 未发现需要迁移的旧 HTML 模板（engine 均已为 schema）。');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }
  console.log(`ℹ️ 待迁移旧模板数量：${legacy.length}`);

  // 备份（原始文档整体落盘，便于回滚）。dry-run 也备份：这份就是「台账」。
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(
    __dirname,
    `migration-${DRY_RUN ? 'dryrun' : 'backup'}-html-templates-${stamp}.json`
  );
  fs.writeFileSync(backupPath, JSON.stringify(legacy, null, 2), 'utf8');
  console.log(`✓ 已${DRY_RUN ? '导出待迁移台账' : '备份原始数据'}至：${backupPath}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const report = [];
  const preview = [];

  for (const doc of legacy) {
    const content = typeof doc.content === 'string' ? doc.content : '';
    if (!content || !/<(h[1-6]|p|div|table|ul|ol|br|hr)\b/i.test(content)) {
      skipped += 1;
      report.push(`跳过 ${doc._id}（${doc.name || ''}）：content 非 HTML 或无内容`);
      continue;
    }
    try {
      const { docSchema, variables, report: convReport } = convertHtmlToDocSchema(content);
      assertValidDocSchema(docSchema);

      const sectionCount = Array.isArray(docSchema.layout && docSchema.layout.sections)
        ? docSchema.layout.sections.length
        : 0;
      const degraded = Array.isArray(convReport) ? convReport : [];

      if (DRY_RUN) {
        preview.push({
          _id: String(doc._id),
          name: doc.name || '',
          sections: sectionCount,
          variables: variables.map((v) => v.key),
          degraded,
          docSchema,
        });
        migrated += 1;
        report.push(
          `[预览] 可迁移 ${doc._id}（${doc.name || ''}）：${sectionCount} 区块 / ${variables.length} 个字段` +
            (degraded.length ? ` ⚠️ 降级 ${degraded.length} 处：${degraded.join('；')}` : '')
        );
        continue;
      }

      await DocumentTemplate.findOneAndUpdate(
        { _id: doc._id },
        {
          $set: {
            engine: 'schema',
            schemaVersion: SCHEMA_VERSION,
            docSchema,
            variables,
            content: '',
          },
        },
        { upsert: false, new: true, runValidators: true }
      );

      migrated += 1;
      report.push(
        `迁移成功 ${doc._id}（${doc.name || ''}）：${sectionCount} 区块 / ${variables.length} 个字段` +
          (degraded.length ? ` ⚠️ 降级 ${degraded.length} 处：${degraded.join('；')}` : '')
      );
    } catch (err) {
      failed += 1;
      report.push(`迁移失败 ${doc._id}（${doc.name || ''}）：${err && err.message ? err.message : err}`);
    }
  }

  console.log(`\n===== ${DRY_RUN ? 'DRY-RUN 预览' : '迁移'}报告 =====`);
  report.forEach((line) => console.log(`  - ${line}`));
  console.log(
    `\n总计：${DRY_RUN ? '可迁移' : '已迁移'} ${migrated} 条，跳过 ${skipped} 条，失败 ${failed} 条。`
  );

  if (DRY_RUN) {
    const previewPath = path.resolve(__dirname, `migration-preview-docschema-${stamp}.json`);
    fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2), 'utf8');
    console.log(`✓ 转换后的 docSchema 预览已导出至：${previewPath}`);
    console.log('  → 核对无误后去掉 --dry-run 重跑即可真正写库。');
  }

  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('✗ 迁移脚本异常：', err && err.message ? err.message : err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
