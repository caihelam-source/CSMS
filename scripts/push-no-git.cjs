const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN || (() => {
  try {
    const s = fs.readFileSync('C:\\Users\\Vincent\\WorkBuddy\\Claw\\.workbuddy\\memory\\SECRETS.md', 'utf8');
    const m = s.match(/github_pat_[A-Za-z0-9_]+/);
    return m ? m[0] : null;
  } catch { return null; }
})();
const OWNER = 'caihelam-source';
const REPO = 'CSMS';
const BRANCH = 'main';
const ROOT = 'C:\\Users\\Vincent\\WorkBuddy\\Claw';
const COMMIT_MSG = 'v6.1 Rules闭环修复——Task完成反向同步Reminder状态+合规文档智能分类(类型/来源/类别)+移除无意义归档锁定按钮+来源链接增强(合规紫/会议蓝)';

if (!TOKEN) { console.error('NO TOKEN'); process.exit(1); }

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
        if (res.statusCode >= 400) reject(new Error(`GitHub ${res.statusCode} ${method} ${p}: ${typeof j === 'string' ? j : JSON.stringify(j).slice(0,500)}`));
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

function parseGitignore(root) {
  const f = path.join(root, '.gitignore');
  const rules = [];
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (t && !t.startsWith('#')) rules.push(t);
    }
  }
  return rules;
}

function isIgnored(rel, rules) {
  for (const rule of rules) {
    let r = rule, neg = false;
    if (r.startsWith('!')) { neg = true; r = r.slice(1); }
    const isDir = r.endsWith('/');
    if (isDir) r = r.slice(0, -1);
    let m = false;
    if (r.includes('*')) {
      const re = '^' + r.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (isDir ? '(/.*)?$' : '$');
      const rx = new RegExp(re);
      const base = rel.split('/').pop();
      m = rx.test(rel) || rx.test(base);
    } else {
      const segs = rel.split('/');
      m = rel === r || rel.startsWith(r + '/') || segs.includes(r);
    }
    if (m) return !neg;
  }
  return false;
}

const localFiles = new Map();
function walk(dir, rel, rules) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.name === '.git') continue;
    if (isIgnored(r, rules)) continue;
    if (e.isDirectory()) walk(abs, r, rules);
    else if (e.isFile()) {
      const buf = fs.readFileSync(abs);
      if (buf.length > 50 * 1024 * 1024) { console.log(`SKIP >50MB: ${r}`); continue; }
      localFiles.set(r, { buf, sha: gitBlobSha(buf) });
    }
  }
}

(async () => {
  const rules = parseGitignore(ROOT);
  walk(ROOT, '', rules);

  console.log(`Local files scanned: ${localFiles.size}`);

  const ref = await api('GET', `/git/refs/heads/${BRANCH}`);
  const baseSha = ref.object.sha;
  console.log(`Base commit: ${baseSha}`);
  const commit = await api('GET', `/git/commits/${baseSha}`);
  const baseTreeSha = commit.tree.sha;
  const tree = await api('GET', `/git/trees/${baseTreeSha}?recursive=1`);
  const gh = new Map();
  for (const e of tree.tree) if (e.type === 'blob') gh.set(e.path, e.sha);
  console.log(`GitHub files: ${gh.size}`);

  const entries = [];
  let changed = 0, added = 0;
  for (const [p, info] of localFiles) {
    const ghSha = gh.get(p);
    if (ghSha === info.sha) continue; // unchanged
    if (ghSha) changed++; else added++;
    const blob = await api('POST', '/git/blobs', { content: info.buf.toString('base64'), encoding: 'base64' });
    entries.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
  }
  let deleted = 0;
  for (const [p] of gh) {
    if (!localFiles.has(p)) { deleted++; entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); }
  }

  console.log(`→ changed: ${changed}, added: ${added}, deleted: ${deleted}`);
  if (entries.length === 0) { console.log('Nothing to push.'); return; }

  if (process.env.DRY_RUN) {
    console.log('DRY_RUN: 未实际推送。确认 deleted 数量正常后去掉 DRY_RUN 再运行。');
    return;
  }

  const newTree = await api('POST', '/git/trees', { base_tree: baseTreeSha, tree: entries });
  const newCommit = await api('POST', '/git/commits', { message: COMMIT_MSG, tree: newTree.sha, parents: [baseSha] });
  await api('PATCH', `/git/refs/heads/${BRANCH}`, { sha: newCommit.sha, force: false });
  console.log(`PUSHED ✅ new commit: ${newCommit.sha}`);
  console.log('Render will auto-build and deploy in a few minutes.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
