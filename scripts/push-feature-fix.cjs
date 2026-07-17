// 追加提交：把 complianceService.js 的 bugfix 追加到 feature/jurisdiction-unify 分支。
// 与 push-feature.cjs 不同，本脚本基于「feature 分支当前 HEAD」派生新 commit（追加，不覆盖），
// 只叠加这一个已变更文件，对应 `git commit --amend`-风格的单文件补丁提交。
// 用法： $env:GITHUB_TOKEN="..."; node scripts/push-feature-fix.cjs
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'caihelam-source';
const REPO = 'CSMS';
const FEATURE_BRANCH = 'feature/jurisdiction-unify';
const ROOT = 'C:\\Users\\Vincent\\WorkBuddy\\Claw';
const COMMIT_MSG = 'fix: financialYearEnd calcDueDate use object instead of string split';

// 仅这一个 bugfix 文件进入本次追加提交
const TARGET_FILES = ['server/services/complianceService.js'];

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
  for (const f of TARGET_FILES) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) { console.error(`MISSING local file: ${f}`); process.exit(1); }
  }
  console.log(`Target files: ${TARGET_FILES.length} (all present locally)`);

  // 1) 取 feature 分支当前 HEAD 作为 base（实现「追加 commit」而非覆盖）
  const ref = await api('GET', `/git/refs/heads/${FEATURE_BRANCH}`);
  const baseSha = ref.object.sha;
  console.log(`Base commit (${FEATURE_BRANCH}): ${baseSha}`);
  const commit = await api('GET', `/git/commits/${baseSha}`);
  const baseTreeSha = commit.tree.sha;

  // 2) 上传 bugfix 文件 blob 并构造 tree entries
  const entries = [];
  for (const f of TARGET_FILES) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    if (buf.length > 50 * 1024 * 1024) { console.error(`SKIP >50MB: ${f}`); continue; }
    const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    entries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
    console.log(`  blob+ ${f} (${buf.length} bytes)`);
  }

  // 3) 基于 feature HEAD 的 tree 叠加这 1 个文件，生成新 tree
  const newTree = await api('POST', '/git/trees', { base_tree: baseTreeSha, tree: entries });
  console.log(`New tree: ${newTree.sha}`);

  // 4) 新 commit，parent = feature HEAD（追加，非覆盖）
  const newCommit = await api('POST', '/git/commits', { message: COMMIT_MSG, tree: newTree.sha, parents: [baseSha] });
  console.log(`New commit: ${newCommit.sha}`);

  // 5) 更新 feature 分支 ref（已存在 → PATCH）
  await api('PATCH', `/git/refs/heads/${FEATURE_BRANCH}`, { sha: newCommit.sha, force: false });
  console.log(`UPDATED ✅ refs/heads/${FEATURE_BRANCH}`);
  console.log(`\nDone. Branch '${FEATURE_BRANCH}' now points to commit ${newCommit.sha}`);
  console.log(`View: https://github.com/${OWNER}/${REPO}/tree/${FEATURE_BRANCH}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
