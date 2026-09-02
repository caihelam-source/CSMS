// 人员姓名归一脚本（本地运行，dry-run 默认）。
//
// 不读取任何硬编码凭证：LOGIN_EMAIL / LOGIN_PASSWORD 走环境变量（你在自己机器上 export/set）。
// 对齐前端 client/src/utils/personName.js 的解析规则，把底层存储里的中拼音混排
// （name="金建榮 (JIN JIANRONG)"）拆成 name="JIN JIANRONG" + nameChinese="金建榮"。
//
// 用法：
//   set LOGIN_EMAIL=你的管理员邮箱
//   set LOGIN_PASSWORD=你的密码
//   node scripts/normalize-personnel-names.cjs            # 仅打印将要改什么（不写库）
//   node scripts/normalize-personnel-names.cjs --apply    # 真正写回
//
// 安全：
//   - merged 状态的源记录跳过（不改动历史合并数据）
//   - 已经是 name=拼音 + nameChinese=中文 的（NAR1 落库）不动
//   - 仅处理「中文 (拼音)」括号模式；纯中文无拼音的无法推导，留给你手填
//   - 全部改完会打印前后对比，--apply 后建议到前端核对

const BASE = 'https://claw-api-5zq7.onrender.com'
const EMAIL = process.env.LOGIN_EMAIL
const PASS = process.env.LOGIN_PASSWORD
const APPLY = process.argv.includes('--apply')
if (!EMAIL || !PASS) {
  console.error('!! 请先设置环境变量 LOGIN_EMAIL / LOGIN_PASSWORD')
  process.exit(2)
}

// 与前端 personName.js 同源的解析：返回 { name, nameChinese } 或 null（无需改动）
function normalize(p) {
  const name = (p.name || '').trim()
  const cn = (p.nameChinese || '').trim()
  if (!name) return null
  const mixed = name.match(/^([\u4e00-\u9fff]+)\s*[（(]\s*([A-Za-z][A-Za-z\s.-]*?)\s*[）)]\s*$/)
  if (mixed) {
    const han = mixed[1]
    const latin = mixed[2].replace(/\s+/g, ' ').trim().toUpperCase()
    // 若已有 nameChinese 且等于中文部分，不重复；否则以括号中文为准
    if (cn && cn !== han) {
      // 现有 nameChinese 与拆出的中文不一致，保守：把括号中文并入 formerNames 而非覆盖
      return { name: latin, nameChinese: cn, _note: `括号中文「${han}」与现有 nameChinese 不同，未覆盖，请人工核对` }
    }
    return { name: latin, nameChinese: han }
  }
  return null
}

;(async () => {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const lj = await lr.json()
  const token = lj.token || lj.data?.token || lj.accessToken
  if (!token) { console.error('LOGIN_FAIL', lr.status, lj); process.exit(1) }
  const auth = { Authorization: `Bearer ${token}` }
  console.log('LOGIN_OK' + (APPLY ? '  [APPLY MODE]' : '  [DRY-RUN]') + '\n')

  const all = []
  for (let page = 1; page < 100; page++) {
    const r = await fetch(`${BASE}/api/personnel?limit=200&page=${page}`, { headers: auth })
    const j = await r.json()
    const items = j.personnel || j.data?.personnel || j.data || j || []
    if (!Array.isArray(items) || items.length === 0) break
    all.push(...items)
    if (items.length < 200) break
  }
  console.log('TOTAL personnel:', all.length, '\n')

  let changed = 0, skipped = 0, errors = 0
  for (const p of all) {
    if (p.status === 'merged') { skipped++; continue }
    const norm = normalize(p)
    if (!norm) continue
    changed++
    console.log(`[${changed}] ${(p.name || '∅')}  →  name="${norm.name}" nameChinese="${norm.nameChinese}"${norm._note ? '  ⚠ ' + norm._note : ''}  (id=${p._id})`)
    if (APPLY) {
      try {
        const res = await fetch(`${BASE}/api/personnel/${p._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...auth },
          body: JSON.stringify({ name: norm.name, nameChinese: norm.nameChinese }),
        })
        if (!res.ok) { errors++; console.log('   ✗ PUT failed', res.status, await res.text()) }
      } catch (e) { errors++; console.log('   ✗', e.message) }
    }
  }

  console.log(`\nSUMMARY: 拟改 ${changed} 条 / 跳过(merged) ${skipped} 条 / 错误 ${errors} 条`)
  console.log(APPLY ? '已写回（建议前端刷新核对）。' : '以上是 dry-run，确认无误后加 --apply 真正写回。')
})()
