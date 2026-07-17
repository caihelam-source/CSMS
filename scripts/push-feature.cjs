// 选择性推送：从 main 派生 feature 分支，只提交指定的 Phase 1-3 文件。
// 用法： $env:GITHUB_TOKEN="..."; node scripts/push-feature.cjs
// 注意：不会触碰本地其他改动（其他 WIP / 根目录杂项），它们不会进入远端。
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'caihelam-source';
const REPO = 'CSMS';
const BASE_BRANCH = 'main';
const FEATURE_BRANCH = 'feature/jurisdiction-unify';
const ROOT = 'C:\\Users\\Vincent\\WorkBuddy\\Claw';
const COMMIT_MSG = 'feat: jurisdiction unified + compliance rules expanded (Phase 1-3)';

// 仅这些文件进入 feature 分支（经人工确认的 Phase 1-3 范围）
const TARGET_FILES = [
  'server/models/Company.js',
  'server/models/ComplianceRule.js',
  'server/models/ComplianceReminder.js',
  'server/services/presetRules.js',
  'server/services/complianceService.js',
  'server/routes/companies.js',
  'server/routes/admin.js',
  'server/services/reminderGenerator.js',
  'server/index.js',
  'client/src/components/UIHelpers.jsx',
  'client/src/pages/Companies.jsx',
  'client/src/pages/CompanyDetail.jsx',
  'client/src/pages/ComplianceRules.jsx',
  'client/src/pages/EquityGraph.jsx',
  'client/src/services/mock.js',
  'client/src/utils/romDocx.js',
  'scripts/migrate-jurisdiction.js',
];

if (!TOKEN) { console.error('NO TOKEN (set $env:GITHUB_TOKEN)'); process.exit(1); }

function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opt = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${p}`,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'claw-deploy',
        'Accept': 'application/vnd.github+json',
      },
    };
    if (data) {
      opt.headers['Content-Type'] = 'application/json';
      opt.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request(opt, (res) => {
      let ch = '';
      res.on('data', (c) => (ch += c));
      res.on('end', () => {
        let j; try { j = JSON.parse(ch); } catch { j = ch; }
        if (res.statusCode >= 400) reject(new Error(`GitHub ${res.statusCode} ${method} ${p}: ${typeof j === 'string' ? j : JSON.stringify(j).slice(0, 600)}`));
        else resolve(j);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function gitBlobSha(buf) {
  const h = crypto.createHash('sha1');
  h.update(`blob ${buf.length}\0`);
  h.update(buf);
  return h.digest('hex');
}

(async () => {
  // 1) 校验本地文件齐全
  for (const f of TARGET_FILES) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) { console.error(`MISSING local file: ${f}`); process.exit(1); }
  }
  console.log(`Target files: ${TARGET_FILES.length} (all present locally)`);

  // 2) 取 main 的 HEAD 与 tree 作为 base
  const ref = await api('GET', `/git/refs/heads/${BASE_BRANCH}`);
  const baseSha = ref.object.sha;
  console.log(`Base commit (${BASE_BRANCH}): ${baseSha}`);
  const commit = await api('GET', `/git/commits/${baseSha}`);
  const baseTreeSha = commit.tree.sha;

  // 3) 上传 17 个 blob 并构造 tree entries
  const entries = [];
  for (const f of TARGET_FILES) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    if (buf.length > 50 * 1024 * 1024) { console.error(`SKIP >50MB: ${f}`); continue; }
    const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    entries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
    console.log(`  blob+ ${f} (${buf.length} bytes)`);
  }

  // 4) 基于 main 的 tree 叠加这 17 个文件，生成新 tree
  const newTree = await api('POST', '/git/trees', { base_tree: baseTreeSha, tree: entries });
  console.log(`New tree: ${newTree.sha}`);

  // 5) 新 commit，parent = main HEAD
  const newCommit = await api('POST', '/git/commits', { message: COMMIT_MSG, tree: newTree.sha, parents: [baseSha] });
  console.log(`New commit: ${newCommit.sha}`);

  // 6) 创建（或更新）feature 分支 ref
  let created = false;
  try {
    await api('GET', `/git/refs/heads/${FEATURE_BRANCH}`);
  } catch (e) {
    if (String(e.message).includes('404')) created = true;
    else throw e;
  }
  if (created) {
    await api('POST', '/git/refs', { ref: `refs/heads/${FEATURE_BRANCH}`, sha: newCommit.sha });
    console.log(`CREATED ✅ refs/heads/${FEATURE_BRANCH}`);
  } else {
    await api('PATCH', `/git/refs/heads/${FEATURE_BRANCH}`, { sha: newCommit.sha, force: false });
    console.log(`UPDATED ✅ refs/heads/${FEATURE_BRANCH}`);
  }
  console.log(`\nDone. Branch '${FEATURE_BRANCH}' now points to commit ${newCommit.sha}`);
  console.log(`View: https://github.com/${OWNER}/${REPO}/tree/${FEATURE_BRANCH}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
