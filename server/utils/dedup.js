/**
 * Company 去重工具 — v6.x 公司去重/合并闭环 (Companies.jsx 检重按钮 + merge 接口)
 *
 * 三层匹配按强→弱返回 duplicate pairs：
 *   1) EXACT_REGNO   registrationNumber 完全相同（截图里 DEMO-CR-35387857 与 35387857 即此）
 *   2) ALIAS         任一方 formerNames 命中对方 name/nameChinese
 *   3) FUZZY_NAME    归一化 + Jaro-Winkler 相似度 ≥ DEFAULT_FUZZY_THRESHOLD（0.92）
 *
 * 设计取舍：
 *   - 纯函数 (无 mongoose 依赖) → vitest 可直接测，后端 service 层仅做 fan-out + 元数据补全
 *   - Jaro-Winkler 自实现，避免引入 fast-jaro-winkler/string-similarity 等第三方包
 *   - 归一化抽 Ltd/Limited/(HK)/空格/中英文标点 → CJK 与英文在同一相似度算法中可比较
 *   - 一对命中即返回最强 type，多次匹配不复报
 */
'use strict'

// 默认模糊阈值；与公司名称常见差异（结尾 Ltd/Limited、空白、连字符）容忍度足够
const DEFAULT_FUZZY_THRESHOLD = 0.92

// 后缀 / 修饰词清单（按需扩展；保留预编译正则以便 vitest 可单测）
const SUFFIX_PATTERNS = [
  /\bLimited\b/gi,
  /\bLtd\.?\b/gi,
  /\bLLC\b/gi,
  /\bInc\.?\b/gi,
  /\bCorporation\b/gi,
  /\bCorp\.?\b/gi,
  /\bCompany\b/gi,
  /\bCo\.?\b/gi,
  /（香港）/g,
  /\(HK\)/gi,
  /\(Hong Kong\)/gi,
  /（HK）/g,
  /\(BVI\)/gi,
  /（BVI）/g,
  /\(Cayman\)/gi,
  /（开曼）/g,
]

/**
 * 归一化公司名用于 fuzzy 比对：
 *   - 小写
 *   - 去除常见后缀 (Limited/Ltd/HK 修饰)
 *   - 全角→半角标点归一
 *   - 去除 CJK 与英文之间的空白与标点差异
 *   - 合并多空白为单空格
 *
 * @param {string|null|undefined} s
 * @returns {string} 归一化名；空字符串表示无法用作比对
 */
function normalizeCompanyName(s) {
  if (!s) return ''
  let out = String(s)
  // 全角标点→半角（CJK 公司名常夹全角空格/括号）
  out = out
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ') // 全角空格 → 半角空格
  // 去后缀
  for (const re of SUFFIX_PATTERNS) out = out.replace(re, ' ')
  // 去除 CJK-ASCII 边界标点（如 "(香港)有限公司" → "有限公司" → 经 Limited/Ltd 后再清）
  out = out.replace(/[\]\s\-.,_'`’"“”()（）[【】{}<>《》]+/g, ' ').trim()
  return out.toLowerCase()
}

/**
 * Jaro 相似度（两字符串前缀公共字符占比）
 *
 * 实现要点（与教科书 Jaro/Winkler 一致）：
 *   - 匹配窗口 = floor(max(|s1|,|s2|)/2) - 1，按 j 自然序贪心匹配
 *   - transposition = s2 中被 s1[i] 占用的 j 序列里"顺序倒置"的对数（除 2）
 *
 * ⚠️ 历史教训：第一版用 k 累加器会导致 s2 占用顺序 ≠ j 自然序时（如 MARTHA/MARHTA）错误递增 k，
 * transposition 计数翻倍。修法：维护 s1ToS2[i] 显式按 i 序记录 s2 位置，再两两对比倒置对。
 *
 * @param {string} s1
 * @param {string} s2
 * @returns {number} [0, 1]
 */
function jaro(s1, s2) {
  if (!s1.length && !s2.length) return 1
  if (!s1.length || !s2.length) return 0

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0)
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)
  const s1ToS2 = new Array(s1.length).fill(-1)
  let matches = 0

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue
      if (s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      s1ToS2[i] = j
      matches++
      break
    }
  }
  if (matches === 0) return 0

  // 按 s1 顺序取出对应的 s2 j 序列；该序列的非严格升位置数量 / 2 = transpositions
  const s2Seq = []
  for (let i = 0; i < s1.length; i++) if (s1Matches[i]) s2Seq.push(s1ToS2[i])
  let transpositions = 0
  for (let k = 0; k + 1 < s2Seq.length; k++) {
    if (s2Seq[k] > s2Seq[k + 1]) transpositions++
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions) / matches) / 3
}

/**
 * Jaro-Winkler 相似度（前缀加权；公司名常以相同前缀出现）
 * @param {string} s1
 * @param {string} s2
 * @param {number} [prefixScale=0.1] Jaro-Winkler scaling factor（标准 0.1）
 * @returns {number} [0, 1]
 */
function jaroWinkler(s1, s2, prefixScale = 0.1) {
  const j = jaro(s1, s2)
  if (j === 0) return 0
  let prefix = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return j + prefix * prefixScale * (1 - j)
}

/**
 * 一对公司是否构成 fuzzy 重复
 * @param {object} a 公司 lean 对象 { _id, name, nameChinese, registrationNumber, formerNames }
 * @param {object} b
 * @param {number} [threshold=DEFAULT_FUZZY_THRESHOLD]
 * @returns {{score: number, nameA: string, nameB: string}|null}
 */
function fuzzyMatch(a, b, threshold = DEFAULT_FUZZY_THRESHOLD) {
  const namesA = [a.name, a.nameChinese].filter(Boolean).map(normalizeCompanyName).filter(Boolean)
  const namesB = [b.name, b.nameChinese].filter(Boolean).map(normalizeCompanyName).filter(Boolean)
  if (!namesA.length || !namesB.length) return null
  let best = 0
  let nameA = ''
  let nameB = ''
  for (const na of namesA) {
    for (const nb of namesB) {
      const s = jaroWinkler(na, nb)
      if (s > best) {
        best = s
        nameA = na
        nameB = nb
      }
    }
  }
  if (best >= threshold) return { score: best, nameA, nameB }
  return null
}

/**
 * alias 命中：a 的 formerNames 命中 b 的 name/nameChinese，反向亦然
 * @returns {{fromA: object, fromB: object}|null}
 */
function aliasMatch(a, b) {
  const aHas = (a.formerNames || []).find((fn) =>
    [b.name, b.nameChinese].filter(Boolean).some(
      (n) => normalizeCompanyName(fn.name) === normalizeCompanyName(n),
    ),
  )
  if (aHas) return { fromA: aHas, fromB: null }
  const bHas = (b.formerNames || []).find((fn) =>
    [a.name, a.nameChinese].filter(Boolean).some(
      (n) => normalizeCompanyName(fn.name) === normalizeCompanyName(n),
    ),
  )
  if (bHas) return { fromA: null, fromB: bHas }
  return null
}

/**
 * 注册号完全匹配（容忍 DEMO-CR- 前缀 —— 截图 BR 35387857 vs DEMO-CR-35387857 即此场景）
 */
function regnoMatch(a, b) {
  const stripDemo = (s) => String(s || '').replace(/^demo-cr-/i, '').replace(/[^0-9a-z]/gi, '').toLowerCase()
  const ra = a.registrationNumber
  const rb = b.registrationNumber
  if (!ra || !rb) return false
  if (ra === rb) return true
  return stripDemo(ra) && stripDemo(ra) === stripDemo(rb)
}

/**
 * 主入口：扫描一组公司，返回重复 pair 数组（每对只报一次，包含最强匹配 type）
 * @param {Array<object>} companies company.lean() 列表；至少包含 _id, name, nameChinese, registrationNumber, formerNames
 * @param {{ fuzzyThreshold?: number, scopeFilter?: (c) => boolean }} [opts]
 * @returns {Array<{ a: object, b: object, type: 'exact_regno'|'fuzzy_name'|'alias', score: number, reason: any }>}
 */
function findCompanyDuplicates(companies, opts = {}) {
  const fuzzyThreshold = opts.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD
  const scopeFilter = opts.scopeFilter || (() => true)
  const list = companies.filter(scopeFilter)
  const pairs = []
  const seen = new Set()
  // O(n^2)；NAR1 实测 14 家无压力；>500 公司建议升级到 minhash/lsh（v6.x 后续）
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const key = a._id < b._id ? `${a._id}|${b._id}` : `${b._id}|${a._id}`
      if (seen.has(key)) continue

      let hit = null
      // 1) 强匹配优先
      if (regnoMatch(a, b)) {
        hit = { type: 'exact_regno', score: 1, reason: { registrationNumberA: a.registrationNumber, registrationNumberB: b.registrationNumber } }
      } else {
        // 2) alias 命中
        const alias = aliasMatch(a, b)
        if (alias) {
          hit = { type: 'alias', score: 0.99, reason: alias }
        } else {
          // 3) fuzzy name
          const fz = fuzzyMatch(a, b, fuzzyThreshold)
          if (fz) {
            hit = { type: 'fuzzy_name', score: fz.score, reason: { normalizedA: fz.nameA, normalizedB: fz.nameB } }
          }
        }
      }
      if (hit) {
        pairs.push({ a, b, ...hit })
        seen.add(key)
      }
    }
  }
  // 强匹配优先
  pairs.sort((x, y) => y.score - x.score)
  return pairs
}

module.exports = {
  DEFAULT_FUZZY_THRESHOLD,
  normalizeCompanyName,
  jaro,
  jaroWinkler,
  fuzzyMatch,
  aliasMatch,
  regnoMatch,
  findCompanyDuplicates,
}
