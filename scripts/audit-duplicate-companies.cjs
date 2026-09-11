#!/usr/bin/env node
/**
 * audit-duplicate-companies.cjs — 全库重复公司实体审计（**只读**，严禁合并/删除）
 *
 * 背景（2026-09-11）：
 *   生产库 claw_prod 里存在重复公司记录，典型两类：
 *     1) 示范数据（DEMO- 前缀注册号）与正式数据并存
 *        例：China New City Group Ltd (中国新城市集团) reg=DEMO-CR-62264234
 *            ↔ CHINA NEW CITY GROUP LIMITED reg=ENT-CHINANEWCITYGROUPL
 *     2) 同一实体的两种写法（大小写 / Ltd vs Limited / 注册号带 (BR) 后缀）
 *        例：Zhong An Intelligent Living Service Ltd reg=73240801(BR)
 *            ↔ Zhong An Intelligent Living Service Limited reg=73240801
 *   合并会**删除/改写数据**，风险高，必须人工确认。本脚本因此**只出报告，绝不写库**。
 *
 * 检测分两级（避免把「众安资本」和「众安资本(中国)」这类不同实体误并成一组）：
 *   【强证据 → 收敛成「重复组」】
 *     - regno_exact      : 注册号归一后完全相同（剥 DEMO-CR-/CR- 前缀与尾部 BR）
 *     - name_exact       : 英文名「严格归一」相同（不去括号内容，避免 (China)/(HK) 歧义）
 *     - nameChinese_exact: 中文名严格归一相同
 *     - alias            : 任一方 formerNames 命中对方名称（复用 server/utils/dedup.js）
 *   【弱证据 → 单独列为「待人工确认」的候选对，不并入组】
 *     - parenthetical_only: 仅去掉括号内容后才相同（如 '...(中国新城市集团)' ↔ '...'）
 *     - fuzzy(score)      : Jaro-Winkler ≥ --threshold（默认 0.92），复用 server/utils/dedup.js
 *
 * 每家附 documents / compliancereminders / 反向关联 计数 + status / mergedInto（含被指向公司的
 * 名称），便于判断保留哪一条、以及该重复是否已经闭环。
 *
 * 用法：
 *   node scripts/audit-duplicate-companies.cjs                    # 只读审计（默认）
 *   node scripts/audit-duplicate-companies.cjs --threshold=0.9    # 放宽模糊阈值
 *   node scripts/audit-duplicate-companies.cjs --exclude-merged   # 排除 status=merged 的源公司
 *
 * 产物：
 *   .workbuddy/artifacts/duplicate-companies-<ts>.json   （结构化，供后续 merge 规划消费）
 *   .workbuddy/artifacts/duplicate-companies-<ts>.md     （人读报告）
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
const ARTIFACTS_DIR = path.join(ROOT, '.workbuddy', 'artifacts');

const EXCLUDE_MERGED = process.argv.includes('--exclude-merged');

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

const THRESHOLD = parseFloat(arg('threshold', '0.92'));

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
 * 名称归一核心实现。
 * @param {string|null|undefined} s 原始名
 * @param {boolean} stripParenthetical 是否去掉括号内容（false = 严格，true = 宽松）
 * @returns {string} 归一后的 key；空串表示无法用于比对
 */
function normalizeName(s, stripParenthetical) {
  if (!s) return '';
  let out = String(s)
    // 全角标点 → 半角
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
  if (stripParenthetical) {
    // 去括号内容：(中国新城市集团) / (BVI) / [BR] 等 —— 这些是修饰语，不是主体标识。
    // 但 (China)/(HK) 也可能是主体差异（众安资本 vs 众安资本(中国)），故仅作「弱证据」使用。
    out = out
      .replace(/\([^)]*\)/g, ' ')
      .replace(/（[^）]*）/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/【[^】]*】/g, ' ');
  }
  out = out.toLowerCase();
  // 公司法律形式后缀统一（保留 group/holdings 等业务词，避免过度归一）
  out = out
    .replace(/\b(limited|ltd|llc|llp|inc|incorporated|corporation|corp|company|co)\b/g, ' ')
    .replace(/(股份有限公司|有限公司|公司)$/g, '');
  // 只保留字母数字与 CJK：空格 / 连字符 / 点号 / 下划线 差异全部抹平
  out = out.replace(/[^0-9a-z\u4e00-\u9fff]/g, '');
  return out;
}

/**
 * 英文名严格归一（保留括号内容）。
 * @param {string|null|undefined} s 原始名
 * @returns {string} 归一 key
 */
function strictNameKey(s) {
  return normalizeName(s, false);
}

/**
 * 英文名宽松归一（去掉括号内容）。
 * @param {string|null|undefined} s 原始名
 * @returns {string} 归一 key
 */
function looseNameKey(s) {
  return normalizeName(s, true);
}

/**
 * 注册号归一：只留字母数字，剥 DEMO-CR- / CR- 前缀与尾部 BR 后缀。
 * 例：'DEMO-CR-62264234' → '62264234'；'73240801(BR)' → '73240801'；'CR-123456' → '123456'
 * @param {string|null|undefined} s 原始注册号
 * @returns {string} 归一后的 key；空串表示无法用于比对
 */
function normalizeRegno(s) {
  if (!s) return '';
  let out = String(s).toLowerCase().replace(/[^0-9a-z]/g, '');
  out = out.replace(/^democr/, '').replace(/^cr/, '');
  // 尾部 BR 后缀（如 73240801(BR)）；仅当剩余主体够长时才剥，避免把纯 'br' 变成空串
  if (out.length > 6) out = out.replace(/br$/, '');
  return out;
}

/** 并查集：把「共享同一强证据」的公司收敛成组 */
class UnionFind {
  /**
   * @param {number} n 元素个数
   */
  constructor(n) {
    this.parent = new Array(n).fill(0).map((_, i) => i);
  }

  /**
   * 查找代表元（带路径压缩）。
   * @param {number} i 下标
   * @returns {number} 代表元下标
   */
  find(i) {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  /**
   * 合并两个集合。
   * @param {number} a 下标
   * @param {number} b 下标
   * @returns {void}
   */
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

async function main() {
  const mongoose = require(path.join(ROOT, 'node_modules', 'mongoose'));
  const Company = require(path.join(ROOT, 'server', 'models', 'Company'));
  const { fuzzyMatch, aliasMatch } = require(path.join(ROOT, 'server', 'utils', 'dedup'));

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  console.log('✅ 已连接 Atlas:', db.databaseName);

  const filter = EXCLUDE_MERGED ? { status: { $ne: 'merged' } } : {};
  const companies = await Company.find(filter).sort({ jurisdiction: 1, name: 1 }).lean();

  console.log('\n=== 1. 扫描范围 ===');
  console.log(`公司总数: ${companies.length}${EXCLUDE_MERGED ? '（已排除 status=merged）' : '（含 status=merged）'}`);
  console.log(`模糊阈值: ${THRESHOLD}`);

  const strictNameOf = companies.map((c) => strictNameKey(c.name));
  const strictCnOf = companies.map((c) => strictNameKey(c.nameChinese));
  const looseNameOf = companies.map((c) => looseNameKey(c.name));
  const regOf = companies.map((c) => normalizeRegno(c.registrationNumber));

  // ---------- 2. 强证据 → 并查集 ----------
  const uf = new UnionFind(companies.length);

  /**
   * 按 key 分桶，同桶内两两合并（强证据）。
   * @param {Array<string>} keys 每家公司的 key
   * @returns {number} 命中的桶数
   */
  const unionByKey = (keys) => {
    const map = new Map();
    keys.forEach((k, i) => {
      if (!k || k.length < 3) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    });
    let n = 0;
    for (const idxs of map.values()) {
      if (idxs.length < 2) continue;
      n++;
      for (let x = 1; x < idxs.length; x++) uf.union(idxs[0], idxs[x]);
    }
    return n;
  };

  const nameBuckets = unionByKey(strictNameOf);
  const cnBuckets = unionByKey(strictCnOf);
  const regBuckets = unionByKey(regOf);

  // alias：一方 formerNames 命中另一方名称
  let aliasHits = 0;
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      if (aliasMatch(companies[i], companies[j])) {
        uf.union(i, j);
        aliasHits++;
      }
    }
  }

  console.log('\n=== 2. 强证据命中 ===');
  console.log(`英文名严格相同: ${nameBuckets} 桶`);
  console.log(`中文名严格相同: ${cnBuckets} 桶`);
  console.log(`注册号归一相同: ${regBuckets} 桶`);
  console.log(`formerNames 别名命中: ${aliasHits} 对`);

  // ---------- 3. 弱证据（不并入组，单独列出） ----------
  const weakPairs = [];
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      if (uf.find(i) === uf.find(j)) continue; // 已由强证据同组
      const reasons = [];
      if (looseNameOf[i] && looseNameOf[i].length >= 3 && looseNameOf[i] === looseNameOf[j]) {
        reasons.push('parenthetical_only');
      }
      const fz = fuzzyMatch(companies[i], companies[j], THRESHOLD);
      if (fz) reasons.push(`fuzzy(${fz.score.toFixed(3)})`);
      if (reasons.length) {
        weakPairs.push({ i, j, reasons, score: fz ? fz.score : 0 });
      }
    }
  }

  // ---------- 4. 收敛成组 ----------
  const byRoot = new Map();
  companies.forEach((c, i) => {
    const r = uf.find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  });
  const groupIdx = [...byRoot.values()].filter((idxs) => idxs.length > 1);

  console.log(`\n候选重复组（强证据）: ${groupIdx.length} 组 / 涉及 ${groupIdx.reduce((a, g) => a + g.length, 0)} 家公司`);
  console.log(`弱候选对（需人工确认，未并组）: ${weakPairs.length} 对`);

  // ---------- 5. 补充计数与 mergedInto 指向 ----------
  const involvedIds = [...groupIdx.flat(), ...weakPairs.flatMap((p) => [p.i, p.j])]
    .map((i) => companies[i]._id);

  /**
   * 统计每个公司被多少条关联数据引用。
   * @param {string} collection 集合名
   * @param {string} field 关联字段名
   * @returns {Promise<Map<string, number>>} companyId → 条数
   */
  const countBy = async (collection, field) => {
    if (!involvedIds.length) return new Map();
    const rows = await db.collection(collection).aggregate([
      { $match: { [field]: { $in: involvedIds } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map((r) => [String(r._id), r.n]));
  };

  const docCounts = await countBy('documents', 'company');
  const remCounts = await countBy('compliancereminders', 'company');
  const linkCounts = await countBy('companies', 'links.link');

  // mergedInto 指向的公司名称（用于判断重复是否已闭环）
  const mergedTargets = new Set();
  companies.forEach((c) => { if (c.mergedInto) mergedTargets.add(c.mergedInto); });
  const targetDocs = mergedTargets.size
    ? await Company.find({ _id: { $in: [...mergedTargets] } }).select('name registrationNumber').lean()
    : [];
  const targetNames = new Map(targetDocs.map((c) => [String(c._id), c.name]));

  /**
   * 构造成员摘要（组报告与弱候选共用）。
   * @param {number} i 下标
   * @returns {object} 成员摘要
   */
  const memberOf = (i) => {
    const c = companies[i];
    return {
      _id: String(c._id),
      name: c.name,
      nameChinese: c.nameChinese || '',
      registrationNumber: c.registrationNumber || '',
      jurisdiction: c.jurisdiction,
      status: c.status,
      isListed: !!c.isListed,
      stockCode: c.stockCode || '',
      nonHongKongCompany: !!c.nonHongKongCompany,
      mergedInto: c.mergedInto ? String(c.mergedInto) : null,
      mergedIntoName: c.mergedInto ? (targetNames.get(String(c.mergedInto)) || '(已删除?)') : '',
      formerNamesCount: (c.formerNames || []).length,
      documentsCount: docCounts.get(String(c._id)) || 0,
      remindersCount: remCounts.get(String(c._id)) || 0,
      inboundLinksCount: linkCounts.get(String(c._id)) || 0,
    };
  };

  /**
   * 组内两 members 的强证据列表。
   * @param {number} i 下标 A
   * @param {number} j 下标 B
   * @returns {Array<string>} 证据列表
   */
  const strongEvidence = (i, j) => {
    const out = [];
    if (regOf[i] && regOf[i] === regOf[j]) out.push('regno_exact');
    if (strictNameOf[i] && strictNameOf[i] === strictNameOf[j]) out.push('name_exact');
    if (strictCnOf[i] && strictCnOf[i] === strictCnOf[j]) out.push('nameChinese_exact');
    if (aliasMatch(companies[i], companies[j])) out.push('alias');
    return out;
  };

  const groupReports = groupIdx.map((idxs, gi) => {
    const members = idxs.map(memberOf);
    const pairs = [];
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const ev = strongEvidence(idxs[x], idxs[y]);
        if (ev.length) {
          pairs.push({
            a: members[x]._id, b: members[y]._id,
            aName: members[x].name, bName: members[y].name,
            evidence: ev,
          });
        }
      }
    }
    const hasDemo = members.some((m) => /^demo/i.test(m.registrationNumber));
    const allMerged = members.every((m) => m.status === 'merged');
    const someMerged = members.some((m) => m.status === 'merged');
    return {
      groupId: `G${String(gi + 1).padStart(2, '0')}`,
      size: members.length,
      hasDemoData: hasDemo,
      closure: allMerged ? 'all_merged' : (someMerged ? 'partial_merged' : 'open'),
      strongestEvidence: [...new Set(pairs.flatMap((p) => p.evidence))].sort(),
      members,
      pairs,
    };
  });

  const rankOf = (g) => (g.strongestEvidence.includes('regno_exact') ? 0 : 1);
  groupReports.sort((a, b) => rankOf(a) - rankOf(b) || b.size - a.size);

  console.log('\n=== 3. 强证据重复组 ===');
  if (!groupReports.length) console.log('  （无）');
  groupReports.forEach((g) => {
    const closureTag = { all_merged: '✅全部已合并', partial_merged: '🟡部分已合并', open: '🔴未处理' }[g.closure];
    console.log(
      `\n[${g.groupId}] ${g.size} 家  ${closureTag}  证据: ${g.strongestEvidence.join(', ')}` +
      `${g.hasDemoData ? '   ⚠️ 含 DEMO 示范数据' : ''}`
    );
    g.members.forEach((m) => {
      console.log(
        `   - ${String(m.name).slice(0, 40).padEnd(42)}` +
        `reg=${String(m.registrationNumber).padEnd(24)}` +
        `jur=${String(m.jurisdiction).padEnd(7)}` +
        `${String(m.status).padEnd(8)}` +
        `docs=${String(m.documentsCount).padEnd(3)}` +
        `rem=${String(m.remindersCount).padEnd(3)}` +
        `links=${String(m.inboundLinksCount).padEnd(3)}` +
        (m.mergedInto ? `→ ${m.mergedIntoName}` : '')
      );
    });
  });

  console.log('\n=== 4. 弱候选对（仅括号差异或模糊相似，未并组，需人工确认）===');
  if (!weakPairs.length) console.log('  （无）');
  weakPairs
    .sort((p, q) => q.score - p.score)
    .forEach((p, k) => {
      const a = memberOf(p.i);
      const b = memberOf(p.j);
      console.log(
        `  W${String(k + 1).padStart(2, '0')}  ${p.reasons.join(' + ').padEnd(28)}` +
        `${String(a.name).slice(0, 34).padEnd(36)}(reg=${a.registrationNumber})` +
        ` ↔ ${String(b.name).slice(0, 34)}(reg=${b.registrationNumber})`
      );
    });

  const demoGroups = groupReports.filter((g) => g.hasDemoData);
  console.log(`\n=== 5. 涉及 DEMO 示范数据的组：${demoGroups.length} / ${groupReports.length} ===`);
  demoGroups.forEach((g) => {
    console.log(`  [${g.groupId}] ${g.closure.padEnd(14)} ${g.members.map((m) => `${m.name}(${m.registrationNumber})`).join('  ↔  ')}`);
  });

  // ---------- 6. 落盘报告 ----------
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const payload = {
    generatedAt: new Date().toISOString(),
    database: db.databaseName,
    scannedCompanies: companies.length,
    excludeMerged: EXCLUDE_MERGED,
    fuzzyThreshold: THRESHOLD,
    strongGroupCount: groupReports.length,
    strongInvolvedCompanies: groupReports.reduce((a, g) => a + g.size, 0),
    weakPairCount: weakPairs.length,
    note: '只读审计报告。未执行任何合并/删除；如需合并须人工确认后单独处理。',
    groups: groupReports,
    weakPairs: weakPairs.map((p, k) => ({
      pairId: `W${String(k + 1).padStart(2, '0')}`,
      reasons: p.reasons,
      score: p.score,
      a: memberOf(p.i),
      b: memberOf(p.j),
    })),
  };
  const jsonPath = path.join(ARTIFACTS_DIR, `duplicate-companies-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const md = [
    '# 重复公司实体审计报告（只读）',
    '',
    `- 生成时间: ${payload.generatedAt}`,
    `- 数据库: ${payload.database}`,
    `- 扫描公司数: ${payload.scannedCompanies}（excludeMerged=${EXCLUDE_MERGED}）`,
    `- 模糊阈值: ${THRESHOLD}`,
    `- 强证据重复组: ${payload.strongGroupCount} 组 / 涉及 ${payload.strongInvolvedCompanies} 家公司`,
    `- 弱候选对: ${payload.weakPairCount} 对`,
    '',
    '> 本报告**只读**生成，未执行任何合并或删除。合并涉及删数据，需人工确认后单独处理。',
    '',
    '## A. 强证据重复组',
    '',
  ];
  groupReports.forEach((g) => {
    const closureTag = { all_merged: '全部已合并', partial_merged: '部分已合并', open: '未处理' }[g.closure];
    md.push(`### ${g.groupId} — ${g.size} 家（${closureTag}；证据: ${g.strongestEvidence.join(', ')}${g.hasDemoData ? '；含 DEMO 数据' : ''}）`);
    md.push('');
    md.push('| # | 名称 | 中文名 | 注册号 | 属地 | 状态 | 上市代码 | 文档 | 提醒 | 反向关联 | 已并入 |');
    md.push('|---|---|---|---|---|---|---|---|---|---|---|');
    g.members.forEach((m, i) => {
      md.push(`| ${i + 1} | ${m.name} | ${m.nameChinese} | ${m.registrationNumber} | ${m.jurisdiction} | ${m.status} | ${m.isListed ? (m.stockCode || '是') : '否'} | ${m.documentsCount} | ${m.remindersCount} | ${m.inboundLinksCount} | ${m.mergedIntoName || ''} |`);
    });
    md.push('');
  });
  md.push('## B. 弱候选对（需人工确认）');
  md.push('');
  md.push('| # | 证据 | A | B | 分值 |');
  md.push('|---|---|---|---|---|');
  weakPairs.sort((p, q) => q.score - p.score).forEach((p, k) => {
    const a = memberOf(p.i);
    const b = memberOf(p.j);
    md.push(`| W${String(k + 1).padStart(2, '0')} | ${p.reasons.join(' + ')} | ${a.name}（${a.registrationNumber}） | ${b.name}（${b.registrationNumber}） | ${p.score ? p.score.toFixed(3) : '-'} |`);
  });
  md.push('');
  const mdPath = path.join(ARTIFACTS_DIR, `duplicate-companies-${ts}.md`);
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log(`\n📄 JSON 报告: ${jsonPath}`);
  console.log(`📄 Markdown 报告: ${mdPath}`);
  console.log('\n⚠️  本报告只读。脚本未对数据库做任何写入/删除。');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
