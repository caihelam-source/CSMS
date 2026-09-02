// 人员姓名统一展示工具。
//
// 背景：底层 Personnel.name / nameChinese 三种来源写法不一致：
//   - NAR1 落库：name="LIN CAIHE"（拼音） + nameChinese="林才賀"（中文，独立字段）
//   - DEMO 旧数据：name="金建榮 (JIN JIANRONG)"（中拼音挤在同一字段，nameChinese 空）
//   - 手工录入：name / nameChinese 各自为政
// 统一规则（已与 Vincent 拍板）：name = 拼音/拉丁化（legal），nameChinese = 简体中文；
// 展示一律 `拼音 · 中文`。本函数在「展示层」把混排 name 即时拆解，无需改动底层数据即可统一视觉。
//
// 解析优先级：
//   R1  name="金建榮 (JIN JIANRONG)" → "JIN JIANRONG · 金建榮"（拆括号）
//   R2  name="LIN CAIHE" + nameChinese="林才賀" → "LIN CAIHE · 林才賀"
//   R3  仅 name（含中文无拼音，如 "施中安 (施侃成)"）→ 原样（别名不进 nameChinese）
//   R4  仅 nameChinese → 原样

export function formatPersonName(p, opts = {}) {
  const withChinese = opts.withChinese !== false
  if (!p) return ''
  const name = (p.name || '').trim()
  const cn = (p.nameChinese || '').trim()
  if (!name && !cn) return ''

  // R1：name 形如「中文 (拼音)」或「中文 (Pinyin)」
  const mixed = name.match(/^([\u4e00-\u9fff]+)\s*[（(]\s*([A-Za-z][A-Za-z\s.-]*?)\s*[）)]\s*$/)
  if (mixed) {
    const han = mixed[1]
    const latin = mixed[2].replace(/\s+/g, ' ').trim().toUpperCase()
    return withChinese ? `${latin} · ${han}` : latin
  }

  // R2：双字段齐备
  if (name && cn) return withChinese ? `${name} · ${cn}` : name

  // R3 / R4：仅一项
  return name || cn
}

// 头像首字：优先中文，其次拉丁化 name
export function personInitial(p) {
  const cn = (p?.nameChinese || '').trim()
  const name = (p?.name || '').trim()
  const src = cn || name
  return (src || '?').charAt(0)
}
