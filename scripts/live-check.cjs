// 实证验证线上 Render 部署：登录 -> GET /api/companies -> 统计 merged 是否仍泄漏。
const BASE = 'https://claw-api-5zq7.onrender.com';
(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hk1321@agent.qq.com', password: 'lin19900731' }),
  });
  if (!login.ok) { console.log('LOGIN FAIL', login.status, await login.text()); process.exit(1); }
  const { token } = await login.json();
  const res = await fetch(`${BASE}/api/companies`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  const list = json.data || json.companies || [];
  const merged = list.filter(c => c.status === 'merged');
  const names = list.map(c => c.name);
  console.log('LIVE /api/companies -> total returned:', list.length);
  console.log('merged records leaked:', merged.length, merged.length ? '(BUG STILL PRESENT)' : '(OK, none)');
  if (merged.length) merged.forEach(c => console.log('  LEAKED:', c.name, c._id));
  // 抽样打印前几个名字，确认无重复同名牌
  console.log('sample names:', names.slice(0, 6));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
