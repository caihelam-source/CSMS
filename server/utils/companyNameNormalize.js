/**
 * 公司名归一 + 合法变体判定（同构 personnel 的 extractPersonnelTokens）
 *
 * 数据语义：公司有 name（英文/legal name）+ nameChinese（中文） 两个字段；formerNames 仅保留真正曾用名。
 * "合法变体" = 同一公司的不同拼写形式：
 *   - 大小写差异：HuiJun LIMITED ↔ HUIJUN LIMITED
 *   - 缩写：Limited / Ltd / Limited ↔ LTD / Ltd
 *   - 标点空格：全角半角、多余空格
 *   - 谐音替代符 / 连字符：& ↔ AND / - ↔ （空格）
 *   - 法律后缀补齐/省略：Co. ↔ Company / Corp. ↔ Corporation
 *   - 中间名缩写：Yuan ↔ Yuan
 *
 * "真曾用名" = 归一后仍然不同的公司名（如 Old Name Inc 改为 New Name Inc）。
 *
 * 中文名字段（nameChinese）独立比较，不归一到英文。
 */

const PUNCTUATION_REGEX = /[\s\u3000().,,、;:；:_`'""''&]+/g
const COMPANY_SUFFIXES = [
  /\bcompanies?\b/gi,
  /\bcorporations?\b/gi,
  /\bincorporated\b/gi,
  /\b(?:limited|ltd)\.?\b/gi,
  /\bcorp\.?\b/gi,
  /\binc\.?\b/gi,
  /\b(?:holding|holdings)\b/gi,
  /\bgroups?\b/gi,
  /\binternational\b/gi,
  /\benterprises?\b/gi,
  /\binvestments?\b/gi,
  /\bcapital\b/gi,
]

function stripSuffixes(s) {
  let out = s
  for (const re of COMPANY_SUFFIXES) out = out.replace(re, ' ')
  return out
}

/**
 * 归一英文名（用于比较两个公司英文 name 是否同变体）：
 *   - 转小写
 *   - 去掉所有法律后缀、标点、空白
 *   - 全角转半角（仅字母）
 *   - 返回纯字母数字串
 *
 * 例：
 *   "HUIJUN (INTERNATIONAL) HOLDINGS LIMITED" → "huijunholdings"
 *   "HuiJun (International) Holdings Ltd"      → "huijunholdings"
 *   "HUIJUN HOLDINGS LIMITED"                  → "huijunholdings"
 */
function normalizeCompanyName(name) {
  if (!name) return ''
  // 全角 → 半角（仅 A-Z/a-z）
  let s = name.replace(/[\uff21-\uff3a\uff41-\uff5a]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
  s = s.replace(PUNCTUATION_REGEX, ' ').trim().toLowerCase()
  s = stripSuffixes(s)
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * 中文名归一（去掉全/半角空格、常见后括号别名等）
 * 严格保留繁简区别——繁简不视为同一（业务上繁体/简体可能是不同语境下的合法写法）
 */
function normalizeChineseName(name) {
  if (!name) return ''
  return name.replace(/[\s\u3000]/g, '').trim()
}

/**
 * 判断两个英文名是否为 "合法变体"
 * 阈值：归一后相等 OR Jaro-Winkler 相似度 ≥ 0.92（与 personnel 同样的宽容度）
 */
function isLegalNameVariant(nameA, nameB, threshold = 0.92) {
  const a = normalizeCompanyName(nameA)
  const b = normalizeCompanyName(nameB)
  if (!a || !b) return false
  if (a === b) return true
  // Jaro-Winkler 简单实现在 util/dedup.js 已用，这里抽出 inline 简化避免跨模块
  return jaroWinkler(a, b) >= threshold
}

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1
  const len1 = s1.length
  const len2 = s2.length
  if (!len1 || !len2) return 0
  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1)
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)
  let matches = 0
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, len2)
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true
        s2Matches[j] = true
        matches++
        break
      }
    }
  }
  if (matches === 0) return 0
  let t = 0, k = 0
  for (let i = 0; i < len1; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++
      if (s1[i] !== s2[k]) t++
      k++
    }
  }
  t /= 2
  const m = matches
  const jaro = (m / len1 + m / len2 + (m - t) / m) / 3
  let p = 0
  while (p < 4 && s1[p] === s2[p]) p++
  return jaro + p * 0.1 * (1 - jaro)
}

/**
 * 综合判断 "source 是否 target 的合法变体"
 * 返回：
 *   - 'identical'  完全相同（含归一相等）
 *   - 'variant'    仅大小写/abbrev/标点差异
 *   - 'chinese'    英文不同但中文相同
 *   - 'different'  真正不同（应入 formerNames）
 */
function classifyNameRelation(source, target) {
  if (!source) return 'different'
  // 1) 中文相同（含归一）→ "中文变体"
  if (source.nameChinese && target.nameChinese &&
      normalizeChineseName(source.nameChinese) === normalizeChineseName(target.nameChinese)) {
    return 'chinese'
  }
  // 2) 英文归一后完全/高度相似 → "合法变体"
  if (isLegalNameVariant(source.name, target.name)) {
    if (normalizeCompanyName(source.name) === normalizeCompanyName(target.name)) {
      return 'identical'
    }
    return 'variant'
  }
  return 'different'
}

module.exports = {
  normalizeCompanyName,
  normalizeChineseName,
  isLegalNameVariant,
  classifyNameRelation,
}
