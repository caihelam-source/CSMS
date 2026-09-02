// 简化 dedup util 单元测试（node:test 风格，被 npm run test:server 自动收纳）
// 覆盖：
//  1) normalizeCompanyName：去 Limited/Ltd/（HK）/全角空格/标点
//  2) regnoMatch：DEMO-CR- 前缀剥离
//  3) aliasMatch：formerNames 命中对方 name
//  4) fuzzyMatch：Jaro-Winkler 阈值
//  5) findCompanyDuplicates：三层匹配混合排序
const test = require('node:test')
const assert = require('node:assert')
const {
  normalizeCompanyName,
  regnoMatch,
  aliasMatch,
  fuzzyMatch,
  jaroWinkler,
  findCompanyDuplicates,
  DEFAULT_FUZZY_THRESHOLD,
} = require('../utils/dedup')

test('normalizeCompanyName: 英文常见后缀归一', () => {
  assert.strictEqual(normalizeCompanyName('Hong Kong Time Honour Property Limited'), 'hong kong time honour property')
  assert.strictEqual(normalizeCompanyName('Pannix Industrial (Hong Kong) Limited'), 'pannix industrial')
  assert.strictEqual(normalizeCompanyName('Easy Rich Corporation Ltd'), 'easy rich')
  assert.strictEqual(normalizeCompanyName('Bright (HK) Hotels Management Ltd.'), 'bright hotels management')
})

test('normalizeCompanyName: 全角→半角 + CJK 容忍', () => {
  assert.strictEqual(normalizeCompanyName('香港时间荣誉置业有限公司'), '香港时间荣誉置业有限公司')
  assert.strictEqual(normalizeCompanyName('　　香港时间荣誉置业有限公司　　'), '香港时间荣誉置业有限公司')
})

test('normalizeCompanyName: 空 / 空白入参', () => {
  assert.strictEqual(normalizeCompanyName(''), '')
  assert.strictEqual(normalizeCompanyName(null), '')
  assert.strictEqual(normalizeCompanyName(undefined), '')
})

test('regnoMatch: 严格相等', () => {
  assert.strictEqual(regnoMatch({ registrationNumber: '35387857' }, { registrationNumber: '35387857' }), true)
})

test('regnoMatch: DEMO-CR- 前缀剥离（截图 BR 35387857 vs DEMO-CR-35387857）', () => {
  const a = { _id: '1', name: 'A', registrationNumber: '35387857' }
  const b = { _id: '2', name: 'B', registrationNumber: 'DEMO-CR-35387857' }
  assert.strictEqual(regnoMatch(a, b), true)
})

test('regnoMatch: 不同 regno 不命中', () => {
  assert.strictEqual(
    regnoMatch({ registrationNumber: '35387857' }, { registrationNumber: '12345678' }),
    false,
  )
})

test('regnoMatch: 任一方缺失', () => {
  assert.strictEqual(regnoMatch({ registrationNumber: '' }, { registrationNumber: '35387857' }), false)
  assert.strictEqual(regnoMatch({ registrationNumber: '35387857' }, { registrationNumber: undefined }), false)
})

test('aliasMatch: 任一方 formerNames 命中对方 name', () => {
  const a = { _id: '1', name: 'New Name Ltd', formerNames: [{ name: 'Old Name Limited' }] }
  const b = { _id: '2', name: 'Old Name Limited' }
  assert.ok(aliasMatch(a, b))
  const x = { _id: '3', name: 'Another Co' }
  const y = { _id: '4', name: 'Whatever', formerNames: [{ name: 'Another Co' }] }
  assert.ok(aliasMatch(x, y))
})

test('aliasMatch: 无命中返回 null', () => {
  const a = { _id: '1', name: 'Foo Ltd' }
  const b = { _id: '2', name: 'Bar Ltd' }
  assert.strictEqual(aliasMatch(a, b), null)
})

test('jaroWinkler: 完全相同 → 1', () => {
  assert.strictEqual(jaroWinkler('pannix industrial', 'pannix industrial'), 1)
})

test('jaroWinkler: 完全不同 → 0', () => {
  const s = jaroWinkler('abc', 'xyz')
  assert.ok(s < 0.5)
})

test('jaroWinkler: 1 个差异字符（高前缀）→ 高分', () => {
  // "hong kong time honour property" vs "hong kong time honour properties"
  // 应在 0.95+ 区间
  const s = jaroWinkler(
    normalizeCompanyName('Hong Kong Time Honour Property Limited'),
    normalizeCompanyName('Hong Kong Time Honour Properties Limited'),
  )
  assert.ok(s >= DEFAULT_FUZZY_THRESHOLD, `expected >= ${DEFAULT_FUZZY_THRESHOLD}, got ${s}`)
})

test('fuzzyMatch: 中文公司名 Hujun vs HUOJUN (大小写差)', () => {
  // OCR 误差常见场景：HUOJUN INTERNATIONAL HOLDINGS LIMITED vs HuiJun (International) Holdings Ltd
  // 归一化后差异："huojun international holdings" vs "huijun international holdings" → 首词 1 字母差
  const a = { name: 'HUOJUN (INTERNATIONAL) HOLDINGS LIMITED' }
  const b = { name: 'HuiJun (International) Holdings Ltd' }
  const m = fuzzyMatch(a, b)
  assert.ok(m, '应命中 fuzzy')
  assert.ok(m.score >= DEFAULT_FUZZY_THRESHOLD, `score ${m.score} 应 ≥ ${DEFAULT_FUZZY_THRESHOLD}`)
})

test('fuzzyMatch: 完全不相似 → null', () => {
  const a = { name: 'Foo Ltd' }
  const b = { name: 'Bar Ltd' }
  assert.strictEqual(fuzzyMatch(a, b), null)
})

test('fuzzyMatch: 中英混合 + 前缀差', () => {
  // Pannix Industrial (Hong Kong) Limited vs Pannix Industrial (Hong Kong) Ltd （同 Ltd 后缀差）
  const a = { name: 'Pannix Industrial (Hong Kong) Limited' }
  const b = { name: 'Pannix Industrial (Hong Kong) Ltd' }
  const m = fuzzyMatch(a, b)
  assert.ok(m, '应命中 fuzzy（仅后缀差异）')
  assert.strictEqual(m.score, 1, '归一化去后缀后应完全相等')
})

test('findCompanyDuplicates: 三层命中，最强在前', () => {
  const companies = [
    // exact regno pair（最强）
    { _id: 'a', name: 'HUOJUN (INTERNATIONAL) HOLDINGS LIMITED', registrationNumber: '35387857' },
    { _id: 'b', name: 'HuiJun (International) Holdings Ltd (香港時駿控股)', registrationNumber: '35387857', nameChinese: '香港時駿控股' },
    // alias pair
    { _id: 'c', name: 'NewCo Holdings Ltd', registrationNumber: '99999999', formerNames: [{ name: 'OldCo Limited' }] },
    { _id: 'd', name: 'OldCo Limited', registrationNumber: '88888888' },
    // fuzzy pair
    { _id: 'e', name: 'Hong Kong Time Honour Property Limited', registrationNumber: '6382186' },
    { _id: 'f', name: 'Hong Kong Time Honour Property Ltd', registrationNumber: '6382186-DEMO' },
    // unrelated (no pair)
    { _id: 'g', name: 'Bright Hotels Management Ltd', registrationNumber: '11111111' },
  ]
  const pairs = findCompanyDuplicates(companies)
  // 应至少 3 对
  assert.ok(pairs.length >= 3, `expected >= 3 pairs, got ${pairs.length}`)
  // 第一对应是 exact_regno（score 1）
  assert.strictEqual(pairs[0].type, 'exact_regno')
  assert.strictEqual(pairs[0].score, 1)
  // 应有 alias 和 fuzzy
  const types = new Set(pairs.map((p) => p.type))
  assert.ok(types.has('exact_regno'))
  assert.ok(types.has('alias'))
  assert.ok(types.has('fuzzy_name'))
})

test('findCompanyDuplicates: 同对只报一次', () => {
  const companies = [
    { _id: 'a', name: 'Same Co Limited', registrationNumber: '1111' },
    { _id: 'b', name: 'Same Co Ltd', registrationNumber: '1111' },
  ]
  const pairs = findCompanyDuplicates(companies)
  assert.strictEqual(pairs.length, 1, '同对只报一次')
})

test('findCompanyDuplicates: scopeFilter 过滤', () => {
  const companies = [
    { _id: 'a', name: 'A Ltd', registrationNumber: '1', status: 'active' },
    { _id: 'b', name: 'A Limited', registrationNumber: '2', status: 'active' },
    { _id: 'c', name: 'C Co', registrationNumber: '3', status: 'merged' },
  ]
  const pairs = findCompanyDuplicates(companies, {
    scopeFilter: (c) => c.status === 'active',
  })
  // a/b 命中（A Ltd vs A Limited）；c 已被合并，应被 scopeFilter 排除
  assert.strictEqual(pairs.length, 1)
})

test('findCompanyDuplicates: 空集合与全空 regno', () => {
  assert.deepStrictEqual(findCompanyDuplicates([]), [])
  const only = [{ _id: 'a', name: 'Only Co', registrationNumber: '' }]
  assert.deepStrictEqual(findCompanyDuplicates(only), [])
})
