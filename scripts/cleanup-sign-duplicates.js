/**
 * 签署闭环历史脏数据清理脚本
 * ─────────────────────────────────────────────────────────────────
 * 背景：v6.x 签署闭环重构前，发起签署会在公司文件里新建一份"假签"文档
 *       （内容与源文件相同，但 signStatus 已被标 fully_signed / ctc），
 *       完成签署时又新建一份"真签"文档。于是单个待签文件最终出现 3 份：
 *         ① 源文件（未签）
 *         ② 发起时建的"假签"文档
 *         ③ 完成时上传的"真签"文档
 *       CTC 同理，出现 3 份（源 + 假 CTC 章草稿 + 真 CTC 签）。
 *
 * 目标闭环（与前端改造一致）：
 *   普通签署 → 最终只留 1 份（真签件，归档为源文件名）
 *   CTC 签署 → 最终留 2 份（源文件 + 已签 CTC 件（CTC））
 *
 * 识别逻辑：
 *   - 新流程 Task 带 sourceDocumentId（重构后写入）→ 已闭环，跳过/校验。
 *   - 旧流程 Task 无 sourceDocumentId，其"假签"与"真签"均通过
 *     document.source.refId == task._id 关联。
 *   - "假签"文档名 = `${源基名} (signed).pdf` / `${源基名} (ctc).pdf`（由源名派生）；
 *     "真签"文档名 = `${上传件基名} (signed/ctc).pdf`（由上传件派生，创建更晚）。
 *   - 源文件 = 同公司、去后缀后得名 `${源基名}.pdf` 且 signStatus 非已签的文档。
 *
 * 用法：
 *   node scripts/cleanup-sign-duplicates.js                 # DRY RUN（仅报告，不写入）
 *   node scripts/cleanup-sign-duplicates.js --apply         # 需先 --i-have-a-backup
 *   node scripts/cleanup-sign-duplicates.js --apply --i-have-a-backup
 *       # 自动清理【高置信】簇；低置信簇仅写入 review 文件，不自动处理
 *   node scripts/cleanup-sign-duplicates.js --apply --i-have-a-backup --force
 *       # 低置信簇也按启发式强制处理（慎用，先备份）
 *
 * 安全策略（沿用 migrate-v5.js 护栏）：
 *   - 默认 DRY RUN，绝不写库。
 *   - 连接库由 MONGODB_URI 指定；疑似生产库需显式 --i-know-this-is-prod。
 *   - --apply 必须显式 --i-have-a-backup（提醒先 mongodump）。
 *   - 所有写入动作记录到 scripts/cleanup-sign-duplicates.<ts>.audit.json。
 *   - 物理文件删除由 Document 模型删除钩子负责（同 router DELETE），本脚本仅删文档记录。
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'server', 'models');
const Document = require(path.join(modelsDir, 'Document'));
const Task = require(path.join(modelsDir, 'Task'));

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/company-secretary';
const DRY_RUN = !process.argv.includes('--apply');
const HAVE_BACKUP = process.argv.includes('--i-have-a-backup');
const FORCE = process.argv.includes('--force');
const APPLY = !DRY_RUN;

function assertSafeToWrite() {
  const dbName = (MONGO_URI.split('/').pop() || '').toLowerCase();
  const looksProd = /prod|production|live|主/.test(dbName);
  if (looksProd && !process.argv.includes('--i-know-this-is-prod')) {
    throw new Error(
      `检测到疑似生产库 "${dbName}"。若确认要在该库执行，请追加 --i-know-this-is-prod。\n` +
      `强烈建议：先 mongodump 备份，恢复到临时实例后再 --apply。`
    );
  }
  if (!HAVE_BACKUP) {
    throw new Error(
      'APPLY 模式需先显式声明 --i-have-a-backup（你已对数据库做 mongodump 备份）。\n' +
      '未备份请不要执行写入。'
    );
  }
}

// ── 命名工具 ────────────────────────────────────────────────────────
function stripSuffix(name) {
  return (name || '')
    .replace(/\.pdf$/i, '')
    .replace(/\s*\((signed|ctc)\)\s*$/i, '')
    .trim();
}
function isSuffixName(name) {
  return /\s*\((signed|ctc)\)\s*\.pdf$/i.test(name || '');
}

// ── 审计日志 ────────────────────────────────────────────────────────
const audit = [];
function logAction(action) {
  audit.push({ ts: new Date().toISOString(), ...action });
}
function flushAudit() {
  if (audit.length === 0) return;
  const file = path.join(__dirname, `cleanup-sign-duplicates.${Date.now()}.audit.json`);
  fs.writeFileSync(file, JSON.stringify(audit, null, 2));
  console.log(`\n📝 审计日志已写入: ${file}`);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  if (APPLY) assertSafeToWrite();
  console.log(DRY_RUN ? '🔍 DRY RUN 模式（仅报告，不写入）'
                      : `✍️  APPLY 模式（写入 ${MONGO_URI}）`);
  if (APPLY && FORCE) console.log('⚠️  --force 已开启：低置信簇也将按启发式处理');
  console.log('');

  const tasks = await Task.find({ type: 'signing' }).lean();
  console.log(`📋 找到 signing 任务 ${tasks.length} 个`);

  let stats = {
    newFlowClean: 0,    // 已闭环（带 sourceDocumentId），无需处理
    highConfidence: 0,  // 高置信历史簇，可安全合并
    lowConfidence: 0,   // 低置信，需人工复核
    noCluster: 0,       // 无关联文档（可能已清/异常）
    actionsPlanned: 0,
    actionsApplied: 0,
    reviews: [],
  };

  for (const task of tasks) {
    const taskId = task._id.toString();
    const linked = await Document.find({ 'source.refId': task._id }).lean();

    // 新流程：已有 sourceDocumentId → 校验是否干净
    if (task.sourceDocumentId) {
      const sourceDoc = await Document.findById(task.sourceDocumentId).lean();
      if (!sourceDoc) {
        stats.noCluster++;
        console.log(`  • [新流程] 任务 ${taskId}：sourceDocumentId 指向的源文档不存在 → 需人工复核`);
        stats.reviews.push({ taskId, reason: '新流程 sourceDocumentId 孤儿', linked: linked.map(d => d._id.toString()) });
        continue;
      }
      // 普通签：不应有额外 linked 文档（就地替换）；CTC：恰好 1 个 (ctc) 文档
      const expectedLinked = task.isCTC ? 1 : 0;
      if (linked.length === expectedLinked) {
        stats.newFlowClean++;
        continue;
      }
      stats.lowConfidence++;
      console.log(`  • [新流程] 任务 ${taskId}：关联文档数 ${linked.length}（预期 ${expectedLinked}）→ 低置信，跳过`);
      stats.reviews.push({ taskId, reason: '新流程关联文档数异常', expectedLinked, linked: linked.map(d => d._id.toString()) });
      continue;
    }

    // 旧流程：无 sourceDocumentId
    if (linked.length < 2) {
      stats.noCluster++;
      if (linked.length === 1) {
        console.log(`  • [旧流程] 任务 ${taskId}：仅 1 个关联文档（${linked[0].name}）→ 非典型 3 文件簇，跳过`);
      }
      continue;
    }

    // 按创建时间排序：最早的 = 假签（发起时建）；最晚的 = 真签（完成时上传）
    const sorted = [...linked].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const fakeInit = sorted[0];                 // 发起时的"假签"文档
    const realSigned = sorted[sorted.length - 1]; // 完成时的"真签"文档

    if (!isSuffixName(fakeInit.name)) {
      // 假签文档名不符合 (signed)/(ctc) 约定 → 启发式失效
      stats.lowConfidence++;
      console.log(`  • [旧流程] 任务 ${taskId}：最早关联文档名「${fakeInit.name}」不符合约定 → 低置信，跳过`);
      stats.reviews.push({ taskId, reason: '假签文档命名不符', fakeInit: fakeInit._id.toString(), realSigned: realSigned._id.toString() });
      continue;
    }

    const sourceBase = stripSuffix(fakeInit.name); // 源基名（去后缀）
    // 在同公司(或同人员)范围内找源文件：去后缀得名 = `${sourceBase}.pdf`，且未签
    const scopeQuery = {};
    if (task.company) scopeQuery.company = task.company;
    else if (task.personnel) scopeQuery.personnel = task.personnel;
    const candidates = await Document.find({
      ...scopeQuery,
      name: { $regex: new RegExp(`^${escapeRegExp(sourceBase)}\\.pdf$`, 'i') },
      _id: { $nin: linked.map(d => d._id) },
      signStatus: { $nin: ['fully_signed', 'ctc'] },
    }).lean();

    const highConf = candidates.length === 1;
    const sourceDoc = candidates[0];

    const plan = task.isCTC
      ? {
          mode: 'CTC',
          keep: [
            { id: sourceDoc?._id?.toString(), name: sourceDoc?.name, role: '源文件（保留）' },
            { id: realSigned._id.toString(), name: realSigned.name, role: '真 CTC 签（保留，设 ctc）' },
          ],
          del: [{ id: fakeInit._id.toString(), name: fakeInit.name, role: '假 CTC 章草稿（删除）' }],
        }
      : {
          mode: '普通',
          keep: [{ id: realSigned._id.toString(), name: realSigned.name, role: '真签件（重命名为源名，设 fully_signed）' }],
          del: [
            { id: sourceDoc?._id?.toString(), name: sourceDoc?.name, role: '源文件（未签，删除）' },
            { id: fakeInit._id.toString(), name: fakeInit.name, role: '假签文档（删除）' },
          ],
        };

    if (!highConf) {
      stats.lowConfidence++;
      console.log(`  • [旧流程/${plan.mode}] 任务 ${taskId}：源文件候选 ${candidates.length} 个（预期 1）→ 低置信`);
      console.log(`      假签=${fakeInit.name} | 真签=${realSigned.name}`);
      stats.reviews.push({ taskId, mode: plan.mode, sourceBase, candidates: candidates.map(c => ({ id: c._id.toString(), name: c.name })), fakeInit: fakeInit._id.toString(), realSigned: realSigned._id.toString() });
      if (APPLY && FORCE) {
        // 强制模式下仍尝试：若找不到源则仅删除假签、保留真签
        await applyPlan(task, plan, sourceDoc, realSigned, fakeInit, /*force*/ true);
        stats.actionsApplied++;
      }
      continue;
    }

    stats.highConfidence++;
    console.log(`  • [旧流程/${plan.mode}] 任务 ${taskId}：高置信`);
    console.log(`      源=${sourceDoc.name} | 假签=${fakeInit.name} | 真签=${realSigned.name}`);
    if (APPLY) {
      await applyPlan(task, plan, sourceDoc, realSigned, fakeInit, /*force*/ false);
      stats.actionsApplied++;
    } else {
      stats.actionsPlanned++;
    }
  }

  console.log('\n📊 统计:');
  console.log(`  新流程已闭环(跳过): ${stats.newFlowClean}`);
  console.log(`  高置信历史簇:       ${stats.highConfidence}`);
  console.log(`  低置信(需复核):     ${stats.lowConfidence}`);
  console.log(`  无关联/异常:        ${stats.noCluster}`);
  console.log(`  计划执行动作:       ${stats.actionsPlanned}`);
  console.log(`  实际执行动作:       ${stats.actionsApplied}`);

  if (stats.reviews.length) {
    const reviewFile = path.join(__dirname, `cleanup-sign-duplicates.${Date.now()}.review.json`);
    fs.writeFileSync(reviewFile, JSON.stringify(stats.reviews, null, 2));
    console.log(`\n🔎 低置信簇已写入复核文件: ${reviewFile}（请 DBA 人工确认后再处理）`);
  }

  if (DRY_RUN) {
    console.log('\n⚠️  这是 DRY RUN，未写入任何数据。');
    console.log('    建议流程：');
    console.log('      1) mongodump 生产库');
    console.log('      2) MONGODB_URI=<临时实例> node scripts/cleanup-sign-duplicates.js --apply --i-have-a-backup');
    console.log('      3) 核对审计日志与上面统计');
    console.log('      4) 无误后再对生产库执行');
  } else {
    flushAudit();
    console.log('\n✅ 清理完成。');
  }

  await mongoose.disconnect();
}

async function applyPlan(task, plan, sourceDoc, realSigned, fakeInit, force) {
  const taskId = task._id;
  const signedBy = task.responsiblePerson || task.ctcFullName || '未知';
  const signedAt = task.completedDate || new Date();

  if (plan.mode === 'CTC') {
    // 保留真 CTC 签：设置为已签 CTC 状态，关联回任务
    if (!DRY_RUN) {
      await Document.findByIdAndUpdate(realSigned._id, {
        signStatus: 'ctc',
        signedBy,
        signedAt,
        source: { kind: 'document_sign', refId: taskId, label: `来自 [签署任务] ${task.title}` },
        $inc: { version: 1 },
      });
    }
    logAction({ taskId: taskId.toString(), action: 'ctc-keep-real', doc: realSigned._id.toString(), name: realSigned.name });
    // 删除假 CTC 章草稿
    if (sourceDoc) logAction({ taskId: taskId.toString(), note: 'source retained', doc: sourceDoc._id.toString(), name: sourceDoc.name });
    if (!DRY_RUN) await Document.findByIdAndDelete(fakeInit._id);
    logAction({ taskId: taskId.toString(), action: 'ctc-delete-fake', doc: fakeInit._id.toString(), name: fakeInit.name });
  } else {
    // 普通签：真签件重命名为源名，设 fully_signed；删除源(未签)与假签
    const newName = `${stripSuffix(fakeInit.name)}.pdf`;
    if (!DRY_RUN) {
      await Document.findByIdAndUpdate(realSigned._id, {
        name: newName,
        signStatus: 'fully_signed',
        signedBy,
        signedAt,
        source: { kind: 'document_sign', refId: taskId, label: `来自 [签署任务] ${task.title}` },
        $inc: { version: 1 },
      });
    }
    logAction({ taskId: taskId.toString(), action: 'normal-keep-real-rename', doc: realSigned._id.toString(), from: realSigned.name, to: newName });
    if (sourceDoc) {
      if (!DRY_RUN) await Document.findByIdAndDelete(sourceDoc._id);
      logAction({ taskId: taskId.toString(), action: 'normal-delete-source', doc: sourceDoc._id.toString(), name: sourceDoc.name });
    } else if (force) {
      console.log(`      ⚠️  force 模式：未找到源文件，仅保留真签件`);
    }
    if (!DRY_RUN) await Document.findByIdAndDelete(fakeInit._id);
    logAction({ taskId: taskId.toString(), action: 'normal-delete-fake', doc: fakeInit._id.toString(), name: fakeInit.name });
  }
}

function escapeRegExp(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((err) => {
  console.error('❌ 清理失败:', err.message);
  mongoose.disconnect().catch(() => undefined).finally(() => process.exit(1));
});
