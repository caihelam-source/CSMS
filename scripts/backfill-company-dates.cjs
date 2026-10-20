#!/usr/bin/env node
/**
 * backfill-company-dates.cjs — 公司关键日期批量补录（成立日 / BR 到期日 / 财年结算日）
 *
 * 背景（2026-10-20）：
 *   线上 47 家在册公司里，13 家缺 incorporationDate、45 家缺 brExpiryDate、42 家缺 financialYearEnd。
 *   这三个字段是大量合规提醒的基准日：缺了就算不出 dueDate，对应规则会被 blocked（不生成提醒）。
 *   本脚本提供「导出待填表 → 人工填写 → 校验 → 备份 → 写入 → 立刻补生成提醒」的闭环。
 *
 * 三种模式：
 *   --export   导出待填 CSV（只有缺字段的公司，UTF-8 BOM，Excel 直接双击可开不乱码）
 *   默认        读取已填 CSV，做校验 + dry-run 预览（**不写库**）
 *   --apply     读取已填 CSV → 备份 → 写库 → ensureCompanyReminders 补生成提醒 → 复验
 *
 * 用法：
 *   node scripts/backfill-company-dates.cjs --export
 *   node scripts/backfill-company-dates.cjs                  # dry-run
 *   node scripts/backfill-company-dates.cjs --apply
 *   node scripts/backfill-company-dates.cjs --file=xxx.csv   # 指定自定义 CSV
 *
 * CSV 列（顺序固定，第一行是表头）：
 *   registrationNumber,name,nameChinese,jurisdiction,incorporationDate,brExpiryDate,financialYearEnd
 *   - incorporationDate / brExpiryDate：YYYY-MM-DD
 *   - financialYearEnd：MM-DD（如 12-31），也兼容 YYYY-MM-DD（自动取月/日）
 *   - 留空 = 该字段不修改（可以只填其中一部分）
 *
 * 安全约定：
 *   - dry-run 是默认行为，不写库；
 *   - --apply 先把「将被修改的公司文档 + 这些公司现有提醒」完整备份到 .workbuddy/backups/；
 *   - 校验有任何错误则整体中止，不做部分写入；
 *   - 幂等：提醒已存在则跳过（ensureCompanyReminders 内部保证）。
 *
 * 注意：需要出网，Bash 请使用 dangerouslyDisableSandbox: true。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.log('⚠️  无法设置 DNS resolver:', err.message);
}

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, '.workbuddy', 'backups');
const DEFAULT_CSV = path.join(ROOT, 'deliverables', 'company-dates-to-fill.csv');

const ARGS = process.argv.slice(2);
const EXPORT = ARGS.includes('--export');
const APPLY = ARGS.includes('--apply');
const FILE_ARG = ARGS.find((a) => a.startsWith('--file='));
const CSV_PATH = FILE_ARG ? path.resolve(ROOT, FILE_ARG.slice('--file='.length)) : DEFAULT_CSV;

const DATE_FIELDS = ['incorporationDate', 'brExpiryDate'];
const FYE_FIELD = 'financialYearEnd';
const HEADER = ['registrationNumber', 'name', 'nameChinese', 'jurisdiction', ...DATE_FIELDS, FYE_FIELD];
// 导出时多给一列提示（读取时忽略，不参与校验）：库里是否已有该公司的 BR 原件 PDF，可直接照抄到期日
const EXPORT_HEADER = [...HEADER, 'brPdfInLibrary'];

function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI.trim();
  const secretsPath = path.join(ROOT, '.workbuddy', 'memory', 'SECRETS.md');
  if (!fs.existsSync(secretsPath)) throw new Error('找不到 .workbuddy/memory/SECRETS.md');
  const txt = fs.readFileSync(secretsPath, 'utf8');
  const m = txt.match(/mongodb\+srv:\/\/\S+/);
  if (!m) throw new Error('SECRETS.md 里找不到 mongodb+srv:// 开头的 URI');
  return m[0].replace(/["'`)\]]/g, '').trim();
}

function backup(prefix, data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${prefix}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

// ── 最小 RFC4180 CSV 读写（公司名可能含逗号/引号）─────────────────
function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows, header = HEADER) {
  return [header.map(csvEscape).join(',')]
    .concat(rows.map((r) => header.map((h) => csvEscape(r[h])).join(',')))
    .join('\r\n');
}

function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else if (ch === '\r') {
      // 忽略，交给 \n 收行
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// ── 校验 ──────────────────────────────────────────────────────────
function parseDateStrict(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null; // 拒绝 2026-02-31 这类
  return d;
}

function parseFye(s) {
  let m = s.match(/^(\d{2})-(\d{2})$/);
  if (m) return { month: Number(m[1]), day: Number(m[2]), raw: s };
  m = s.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (m) return { month: Number(m[1]), day: Number(m[2]), raw: s };
  return null;
}

function validFye(f) {
  if (!f) return false;
  if (f.month < 1 || f.month > 12) return false;
  // 允许 2/29（闰年财年）等，用 2024（闰年）做日历校验
  const d = new Date(Date.UTC(2024, f.month - 1, f.day));
  return d.getUTCMonth() === f.month - 1 && d.getUTCDate() === f.day;
}

function ymd(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));
  const ComplianceRule = require(path.join(ROOT, 'server', 'models', 'ComplianceRule'));
  const ComplianceReminder = require(path.join(ROOT, 'server', 'models', 'ComplianceReminder'));
  const { ensureCompanyReminders, ruleApplicability, calcDueDate } = require(
    path.join(ROOT, 'server', 'services', 'complianceService')
  );

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  console.log('✅ 已连接 Atlas:', mongoose.connection.db.databaseName);

  // ── 模式一：导出待填表 ────────────────────────────────────────
  if (EXPORT) {
    const all = await Company.find({ status: { $ne: 'merged' } })
      .select('registrationNumber name nameChinese jurisdiction incorporationDate brExpiryDate financialYearEnd status')
      .sort({ jurisdiction: 1, name: 1 })
      .lean();

    const gaps = all.filter(
      (c) => !c.incorporationDate || !c.brExpiryDate || !(c.financialYearEnd && c.financialYearEnd.month)
    );

    const rows = gaps.map((c) => ({
      registrationNumber: c.registrationNumber || '',
      name: c.name || '',
      nameChinese: c.nameChinese || '',
      jurisdiction: c.jurisdiction || '',
      incorporationDate: '',
      brExpiryDate: '',
      financialYearEnd: '',
      brPdfInLibrary: ''
    }));

    // 标注「库里有 BR 原件 PDF」的公司，填表时可直接打开原件照抄，不用去政府网站查
    let pdfCovered = 0;
    try {
      const Document = require(path.join(ROOT, 'server', 'models', 'Document'));
      const docs = await Document.find({ type: /business.?registration|^br$/i })
        .select('company').lean();
      const covered = new Set(docs.filter((d) => d.company).map((d) => String(d.company)));
      rows.forEach((r) => {
        const c = gaps.find((g) => g.registrationNumber === r.registrationNumber);
        if (c && covered.has(String(c._id))) { r.brPdfInLibrary = '有BR原件'; pdfCovered++; }
      });
    } catch (e) {
      console.log('⚠️  跳过 BR 原件标注:', e.message);
    }

    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, '\uFEFF' + toCsv(rows, EXPORT_HEADER), 'utf8');

    const cnt = (k) => gaps.filter((c) => !c[k]).length;
    console.log(`\n在册公司 ${all.length} 家，其中 ${gaps.length} 家至少缺一项：`);
    console.log(`  缺 incorporationDate : ${cnt('incorporationDate')}`);
    console.log(`  缺 brExpiryDate      : ${cnt('brExpiryDate')}`);
    console.log(`  缺 financialYearEnd  : ${gaps.filter((c) => !(c.financialYearEnd && c.financialYearEnd.month)).length}`);
    console.log(`\n📄 待填表已导出：${path.relative(ROOT, CSV_PATH)}（${rows.length} 行，UTF-8 BOM，Excel 可直接打开）`);
    console.log(`   其中 ${pdfCovered} 家库里已有 BR 原件 PDF（表格最后一列标了「有BR原件」，打开原件照抄即可）`);
    console.log('   填好后运行：node scripts/backfill-company-dates.cjs        # 先 dry-run 校验');
    await mongoose.disconnect();
    return;
  }

  // ── 模式二/三：读取 CSV → 校验 → 预览 / 写入 ───────────────────
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`找不到待填 CSV：${path.relative(ROOT, CSV_PATH)}\n先运行：node scripts/backfill-company-dates.cjs --export`);
  }

  const table = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  if (!table.length) throw new Error('CSV 是空的');

  const header = table[0].map((h) => h.trim());
  const missingCols = HEADER.filter((h) => !header.includes(h));
  if (missingCols.length) throw new Error('CSV 表头缺列: ' + missingCols.join(', '));

  const idx = (name) => header.indexOf(name);
  const records = table.slice(1).map((r) => {
    const o = {};
    HEADER.forEach((h) => { o[h] = (r[idx(h)] || '').trim(); });
    return o;
  });

  const errors = [];
  const plans = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const line = i + 2; // 含表头
    const reg = rec.registrationNumber;
    if (!reg) { errors.push(`第 ${line} 行：registrationNumber 为空`); continue; }

    const hasAny = DATE_FIELDS.some((f) => rec[f]) || rec[FYE_FIELD];
    if (!hasAny) continue; // 整行留空 → 跳过

    const set = {};

    for (const f of DATE_FIELDS) {
      if (!rec[f]) continue;
      const d = parseDateStrict(rec[f]);
      if (!d) { errors.push(`第 ${line} 行 ${reg}：${f}="${rec[f]}" 不是合法日期（要 YYYY-MM-DD）`); continue; }
      if (f === 'incorporationDate' && d.getTime() > Date.now() + 86400000) {
        errors.push(`第 ${line} 行 ${reg}：incorporationDate 不能是未来日期`);
        continue;
      }
      // BR 到期日本身就在未来，只做离谱值兜底（超过 30 年基本是填错了）
      if (f === 'brExpiryDate' && d.getTime() > Date.now() + 30 * 365 * 86400000) {
        errors.push(`第 ${line} 行 ${reg}：brExpiryDate="${rec[f]}" 超过 30 年，疑似填错`);
        continue;
      }
      set[f] = d;
    }

    if (rec[FYE_FIELD]) {
      const f = parseFye(rec[FYE_FIELD]);
      if (!validFye(f)) {
        errors.push(`第 ${line} 行 ${reg}：financialYearEnd="${rec[FYE_FIELD]}" 不合法（要 MM-DD，如 12-31）`);
      } else {
        set[FYE_FIELD] = { month: f.month, day: f.day };
      }
    }

    if (Object.keys(set).length) plans.push({ reg, line, set, rec });
  }

  if (!plans.length && !errors.length) {
    console.log('\n⚠️  CSV 里没有任何已填内容（所有日期列都是空的）。填好后再跑。');
    await mongoose.disconnect();
    return;
  }

  if (errors.length) {
    console.log(`\n❌ 校验失败，共 ${errors.length} 处错误（未写库）：`);
    errors.forEach((e) => console.log('   ' + e));
    console.log('\n修好 CSV 后重新运行。');
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  const regs = plans.map((p) => p.reg);
  // ⚠️ 不要 select()：ruleApplicability 依赖 jurisdiction / nonHongKongCompany / isListed 等字段，
  // 裁掉字段会让预览恒为「0 条新增」，把真实影响低估成 0。
  const companies = await Company.find({ registrationNumber: { $in: regs } }).lean();
  const byReg = new Map(companies.map((c) => [c.registrationNumber, c]));

  const resolved = [];
  for (const p of plans) {
    const c = byReg.get(p.reg);
    if (!c) { errors.push(`registrationNumber "${p.reg}" 在库里不存在`); continue; }
    if (c.status === 'merged') { errors.push(`"${p.reg}" 是已软合并的重复公司，请改填目标公司`); continue; }
    resolved.push({ company: c, set: p.set });
  }

  if (errors.length) {
    console.log(`\n❌ 校验失败，共 ${errors.length} 处（未写库）：`);
    errors.forEach((e) => console.log('   ' + e));
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  // ── 预览：字段变化 + 预期新增提醒数 ────────────────────────────
  const activeRules = await ComplianceRule.find({ status: { $ne: '停用' } }).lean();
  const activeRuleIds = activeRules.map((r) => r._id);

  console.log(`\n=== 待写入：${resolved.length} 家公司 ===`);
  let totalWillCreate = 0;

  for (const { company, set } of resolved) {
    const diffs = [];
    for (const f of DATE_FIELDS) {
      if (!set[f]) continue;
      diffs.push(`${f}: ${ymd(company[f]) || '(空)'} → ${ymd(set[f])}`);
    }
    if (set[FYE_FIELD]) {
      const cur = company.financialYearEnd && company.financialYearEnd.month
        ? `${company.financialYearEnd.month}-${company.financialYearEnd.day}` : '(空)';
      diffs.push(`FYE: ${cur} → ${set[FYE_FIELD].month}-${set[FYE_FIELD].day}`);
    }
    if (!diffs.length) continue;

    // 用「回填后的公司」推演会解除多少 blocked（仅统计，不写库）
    const projected = { ...company, ...set };
    let willCreate = 0;
    for (const r of activeRules) {
      if (ruleApplicability(r, projected)) continue;
      const due = calcDueDate(r, projected);
      if (!due) continue;
      const exists = await ComplianceReminder.findOne({ company: company._id, rule: r._id, dueDate: due }).lean();
      if (!exists) willCreate++;
    }
    totalWillCreate += willCreate;

    console.log(`\n  ${String(company.name).slice(0, 40)}  [${company.registrationNumber}]`);
    diffs.forEach((d) => console.log('      ' + d));
    console.log(`      → 预计新增合规提醒 ~${willCreate} 条`);
  }

  console.log(`\n合计预计新增提醒约 ${totalWillCreate} 条`);

  if (!APPLY) {
    console.log('\n[只读模式] 未写库。确认无误后加 --apply 执行（会先备份公司文档与现有提醒）。');
    await mongoose.disconnect();
    return;
  }

  // ── 写入：备份 → 更新 → 补生成提醒 → 复验 ─────────────────────
  const ids = resolved.map((r) => r.company._id);
  const beforeCompanies = await Company.find({ _id: { $in: ids } }).lean();
  const beforeReminders = await ComplianceReminder.find({ company: { $in: ids } }).lean();
  const file = backup('company-dates-backfill-before', {
    generatedAt: new Date().toISOString(),
    operation: 'backfill incorporationDate/brExpiryDate/financialYearEnd + ensureCompanyReminders',
    csv: path.relative(ROOT, CSV_PATH),
    companies: beforeCompanies,
    reminders: beforeReminders
  });
  console.log(`\n📦 已备份 ${beforeCompanies.length} 家公司 + ${beforeReminders.length} 条提醒: ${path.relative(ROOT, file)}`);

  for (const { company, set } of resolved) {
    if (!Object.keys(set).length) continue;
    const res = await Company.updateOne({ _id: company._id }, { $set: set });
    console.log(`  ✏️  ${company.name}: matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  console.log('\n=== 补生成合规提醒（ensureCompanyReminders）===');
  let totalCreated = 0;
  for (const { company } of resolved) {
    const res = await ensureCompanyReminders(company._id, activeRuleIds);
    totalCreated += res.created || 0;
    console.log(`  ${company.name}: created=${res.created} skipped=${res.skipped} blocked=${res.blocked}`);
    if (res.reasons && res.reasons.length) {
      const grouped = {};
      res.reasons.forEach((r) => { grouped[r.reason] = (grouped[r.reason] || 0) + 1; });
      console.log(`      未生成原因: ${Object.entries(grouped).map(([k, v]) => `${k}×${v}`).join(', ')}`);
    }
  }

  console.log('\n=== 复验：写回后的字段值 ===');
  const after = await Company.find({ _id: { $in: ids } })
    .select('registrationNumber name incorporationDate brExpiryDate financialYearEnd')
    .lean();
  after.forEach((c) => {
    const fye = c.financialYearEnd && c.financialYearEnd.month
      ? `${c.financialYearEnd.month}-${c.financialYearEnd.day}` : '-';
    console.log(`  ${String(c.name).slice(0, 38).padEnd(40)} inc=${ymd(c.incorporationDate) || '-'} br=${ymd(c.brExpiryDate) || '-'} fye=${fye}`);
  });
  console.log(`\n✅ 完成：更新 ${resolved.length} 家公司，新增提醒 ${totalCreated} 条。`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ 失败:', err.message);
  process.exit(1);
});
