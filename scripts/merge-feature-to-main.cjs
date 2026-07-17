/**
 * merge-feature-to-main.cjs
 * 将 feature/jurisdiction-unify 合入 main（走 GitHub REST API，沙箱无 git）。
 *
 * 安全策略：
 *   1) 先 GET /compare/main...feature 确认两者关系；
 *   2) status='ahead'  → 直接 fast-forward main 到 feature HEAD（PATCH refs/heads/main, force:false）；
 *   3) status='diverged' → 创建 merge commit（POST /merges）再更新 main；
 *   4) status='behind'|'identical' → 不操作，避免覆盖 main 已有提交。
 * 若 main 启用了 branch protection 要求 PR，则 PATCH 会 422，脚本报错退出（不强制破坏）。
 *
 * 用法：
 *   GITHUB_TOKEN=xxx node scripts/merge-feature-to-main.cjs
 */
const OWNER = 'caihelam-source';
const REPO = 'CSMS';
const BASE = 'main';
const HEAD = 'feature/jurisdiction-unify';

const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

async function gh(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'claw-merge',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch {}
  if (!res.ok) {
    console.error('❌ GitHub API', res.status, p, '|', (json && json.message) || txt.slice(0, 200));
    throw new Error('API ' + res.status);
  }
  return json;
}

(async () => {
  if (!process.env.GITHUB_TOKEN) { console.error('❌ 未设置 GITHUB_TOKEN'); process.exit(1); }

  const cmp = await gh('GET', `/compare/${BASE}...${HEAD}`);
  console.log(`compare status: ${cmp.status} | ahead_by: ${cmp.ahead_by} | behind_by: ${cmp.behind_by} | total_commits: ${cmp.total_commits}`);
  // 用 ref API 读取 feature HEAD（compare 端点的 head_commit 在某些状态可能缺省）
  const featureRef = await gh('GET', `/git/refs/heads/${HEAD}`);
  const headSha = featureRef.object.sha;
  console.log('feature HEAD:', headSha);

  if (cmp.status === 'identical') {
    console.log('✅ feature 已合入 main，无需操作');
    return;
  }
  if (cmp.status === 'behind') {
    console.log('⚠️ feature 落后于 main，无需合入');
    return;
  }
  if (cmp.status === 'ahead') {
    console.log('→ fast-forward main 至 feature HEAD...');
    await gh('PATCH', `/git/refs/heads/${BASE}`, { sha: headSha, force: false });
    console.log('✅ main 已 fast-forward 至', headSha);
    return;
  }
  if (cmp.status === 'diverged') {
    console.log('→ 检测到分叉，创建 merge commit...');
    const m = await gh('POST', `/merges`, { base: BASE, head: headSha });
    const mergeSha = m.sha;
    console.log('merge commit:', mergeSha);
    await gh('PATCH', `/git/refs/heads/${BASE}`, { sha: mergeSha, force: false });
    console.log('✅ main 已更新至 merge commit', mergeSha);
    return;
  }
  console.log('⚠️ 未知 status:', cmp.status);
})().catch((e) => { console.error('失败:', e.message); process.exit(1); });
