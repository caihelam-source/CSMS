/**
 * Personnel 去重工具 — v6.x 人员中枢（Personnel）去重/合并闭环
 *
 * 与 Company dedup 同构，但匹配维度不同：
 *   - 公司靠 registrationNumber / 英文名归一化；人员靠「中文名 token」与「拼音 token」。
 *   - 实测数据：同一人被录入为 纯中文(name) / 中文(含拼音括注) / 拼音(name)+中文(nameChinese) 三种形态。
 *     例：施金帆(#1, name=施金帆) ↔ JINFAN(#13, nameChinese=施金帆) —— 共享中文 token「施金帆」。
 *          施南路(#2, name=施南路) ↔ NANLU(#12, nameChinese=施南路) ↔ SHI Nanlu(#17, nameChinese=施南路)。
 *
 * 三层匹配按强→弱返回 duplicate pairs：
 *   1) EXACT_NRIC    nric 完全相同（容忍 DEMO-NRIC- 前缀）
 *   2) EXACT_CHINESE 任一方 name/nameChinese 的「中文 token」集合与对方相交（最稳，本数据集主命中）
 *   3) ALIAS         任一方 formerNames 命中对方中文 token
 *   4) PINYIN        拼音 token 字符串相互包含（去空格、大写；被包含串长度 ≥ 4，规避姓氏 SHI 误命中）
 *
 * 设计取舍：
 *   - 纯函数（无 mongoose 依赖）→ node:test 可直接单测
 *   - 不引入拼音库：数据本身已带拼音（name 字段或括注），直接抽取比较即可
 *   - 一对命中即返回最强 type，多次匹配不复报
 */
'use strict'

// 默认模糊阈值（pinyin 兜底用，主命中靠 exact_chinese）
const DEFAULT_PINYIN_MIN_LEN = 4

/**
 * 抽取一个姓名串的中/英 token
 *   - chinese: 所有 CJK 连续段（如 "施中安 (施侃成)" → ['施中安','施侃成']）
 *   - pinyin:  所有 ASCII 字母段（≥2 字符，大写；如 "LIN CAI HE" → ['LIN','CAI','HE']，'CAIHE' → ['CAIHE']）
 * @param {string|null|undefined} s
 * @returns {{ chinese: string[], pinyin: string[] }}
 */
function extractPersonnelTokens(s) {
  if (!s) return { chinese: [], pinyin: [] }
  const str = String(s)
  const chinese = (str.match(/[一-鿿]+/g) || []).map((t) => t.trim()).filter(Boolean)
  const pinyin = (str.match(/[A-Za-z]{2,}/g) || [])
    .map((t) => t.toUpperCase())
    .filter(Boolean)
  return { chinese, pinyin }
}

/**
 * 合并一条 Personnel 记录的全部候选 token（name + nameChinese + formerNames）
 * @param {object} p Personnel lean 对象
 * @returns {{ chinese: string[], pinyin: string[] }}
 */
function collectPersonnelTokens(p) {
  const out = { chinese: [], pinyin: [] }
  for (const field of [p.name, p.nameChinese]) {
    const t = extractPersonnelTokens(field)
    out.chinese.push(...t.chinese)
    out.pinyin.push(...t.pinyin)
  }
  for (const fn of (p.formerNames || [])) {
    const t = extractPersonnelTokens(fn.name || fn.nameChinese)
    out.chinese.push(...t.chinese)
    out.pinyin.push(...t.pinyin)
  }
  // 去重
  out.chinese = [...new Set(out.chinese)]
  out.pinyin = [...new Set(out.pinyin)]
  return out
}

/** 抽取括注中文别名（如 "施中安 (施侃成)" 的施侃成），用于 formerNames 追加 */
function extractBracketAliases(s) {
  if (!s) return []
  const out = []
  const re = /[（(]([^（）()]*[一-鿿][^（）()]*)[）)]/g
  let m
  while ((m = re.exec(String(s))) !== null) {
    const inner = m[1].trim()
    if (inner && /[一-鿿]/.test(inner)) out.push(inner)
  }
  return [...new Set(out)]
}

function nricMatch(a, b) {
  const strip = (s) => String(s || '').replace(/^demo-nric-/i, '').replace(/[^0-9a-z]/gi, '').toLowerCase()
  const ra = a.nric
  const rb = b.nric
  if (!ra || !rb) return false
  if (ra === rb) return true
  return strip(ra) && strip(ra) === strip(rb)
}

function chineseMatch(a, b) {
  // 仅比对「当前名」中文 token（name + nameChinese），不含 formerNames
  const setA = new Set(a.__cur)
  const hit = b.__cur.find((c) => setA.has(c))
  return hit || null
}

function aliasMatch(a, b) {
  // a 的 formerNames 中文命中 b 的「当前名」中文 token，反向亦然
  const bSet = new Set(b.__cur)
  const aHit = (a.formerNames || []).find((fn) => {
    const t = extractPersonnelTokens(fn.name || fn.nameChinese)
    return t.chinese.find((c) => bSet.has(c))
  })
  if (aHit) return { from: 'a', token: extractPersonnelTokens(aHit.name || aHit.nameChinese).chinese[0] }
  const aSet = new Set(a.__cur)
  const bHit = (b.formerNames || []).find((fn) => {
    const t = extractPersonnelTokens(fn.name || fn.nameChinese)
    return t.chinese.find((c) => aSet.has(c))
  })
  if (bHit) return { from: 'b', token: extractPersonnelTokens(bHit.name || bHit.nameChinese).chinese[0] }
  return null
}

function pinyinMatch(a, b) {
  const pa = a.__pinyin.join('')
  const pb = b.__pinyin.join('')
  if (!pa || !pb) return null
  const longer = pa.length >= pb.length ? pa : pb
  const shorter = pa.length >= pb.length ? pb : pa
  if (shorter.length >= DEFAULT_PINYIN_MIN_LEN && longer.includes(shorter)) {
    return shorter
  }
  return null
}

/**
 * 主入口：扫描一组人员，返回重复 pair 数组（每对只报一次，含最强匹配 type）
 * @param {Array<object>} personnel 至少含 _id, name, nameChinese, nric, formerNames
 * @param {{ scopeFilter?: (p) => boolean }} [opts]
 * @returns {Array<{ a: object, b: object, type: 'exact_nric'|'exact_chinese'|'alias'|'pinyin', score: number, reason: any }>}
 */
function findPersonnelDuplicates(personnel, opts = {}) {
  const scopeFilter = opts.scopeFilter || (() => true)
  const list = personnel.filter(scopeFilter).map((p) => {
    // __cur: 当前名中文 token（name + nameChinese，不含 formerNames）；__all: 含 formerNames；__pinyin: 全部拼音
    const cur = [...new Set([
      ...extractPersonnelTokens(p.name).chinese,
      ...extractPersonnelTokens(p.nameChinese).chinese,
    ])]
    const all = collectPersonnelTokens(p).chinese
    const pinyin = collectPersonnelTokens(p).pinyin
    return { ...p, __cur: cur, __all: all, __pinyin: pinyin }
  })
  const pairs = []
  const seen = new Set()
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const key = a._id < b._id ? `${a._id}|${b._id}` : `${b._id}|${a._id}`
      if (seen.has(key)) continue

      let hit = null
      if (nricMatch(a, b)) {
        hit = { type: 'exact_nric', score: 1, reason: { nricA: a.nric, nricB: b.nric } }
      } else {
        const ch = chineseMatch(a, b)
        if (ch) {
          hit = { type: 'exact_chinese', score: 1, reason: { matchedChinese: ch } }
        } else {
          const al = aliasMatch(a, b)
          if (al) {
            hit = { type: 'alias', score: 0.99, reason: al }
          } else {
            const py = pinyinMatch(a, b)
            if (py) {
              hit = { type: 'pinyin', score: 0.95, reason: { matchedPinyin: py } }
            }
          }
        }
      }
      if (hit) {
        pairs.push({ a, b, ...hit })
        seen.add(key)
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score)
  return pairs
}

module.exports = {
  DEFAULT_PINYIN_MIN_LEN,
  extractPersonnelTokens,
  collectPersonnelTokens,
  extractBracketAliases,
  nricMatch,
  findPersonnelDuplicates,
}
