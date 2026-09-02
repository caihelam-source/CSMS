// 人员去重工具单元测试（node:test 风格，被 npm run test:server 自动收纳）
// 覆盖：
//  1) extractPersonnelTokens：CJK / 拼音 token 抽取
//  2) extractBracketAliases：括注中文别名（如「施侃成」）
//  3) nricMatch：DEMO-NRIC- 前缀剥离
//  4) findPersonnelDuplicates：exact_chinese / pinyin / alias 三层命中 + 无伪命中
const test = require('node:test')
const assert = require('node:assert')
const {
  extractPersonnelTokens,
  extractBracketAliases,
  nricMatch,
  findPersonnelDuplicates,
  collectPersonnelTokens,
} = require('../utils/personnelDedup')

test('extractPersonnelTokens: 纯中文 + 括注拼音', () => {
  const t = extractPersonnelTokens('林才賀 (LIN CAI HE)')
  assert.deepStrictEqual(t.chinese, ['林才賀']) // 仅外壳中文段；括注为拼音非中文
  assert.ok(t.chinese.includes('林才賀'))
  assert.deepStrictEqual(t.pinyin.sort(), ['CAI', 'HE', 'LIN'])
})

test('extractPersonnelTokens: 拼音+中文(nameChinese)', () => {
  const t = extractPersonnelTokens('CAIHE')
  assert.deepStrictEqual(t.chinese, [])
  assert.deepStrictEqual(t.pinyin, ['CAIHE'])
})

test('extractPersonnelTokens: 中文名 ↔ 含空格拼音', () => {
  const a = extractPersonnelTokens('施金帆')
  const b = extractPersonnelTokens('JINFAN')
  assert.deepStrictEqual(a.chinese, ['施金帆'])
  assert.deepStrictEqual(b.pinyin, ['JINFAN'])
})

test('extractBracketAliases: 抽取中文别名', () => {
  assert.deepStrictEqual(extractBracketAliases('施中安 (施侃成)'), ['施侃成'])
  assert.deepStrictEqual(extractBracketAliases('林才賀 (LIN CAI HE)'), []) // 括注为拼音，非中文
  assert.deepStrictEqual(extractBracketAliases('施金帆'), [])
})

test('nricMatch: DEMO-NRIC- 前缀剥离', () => {
  assert.strictEqual(nricMatch({ nric: 'DEMO-NRIC-P1' }, { nric: 'DEMO-NRIC-P1' }), true)
  assert.strictEqual(nricMatch({ nric: 'P1' }, { nric: 'DEMO-NRIC-P1' }), true)
  assert.strictEqual(nricMatch({ nric: 'DEMO-NRIC-P1' }, { nric: 'DEMO-NRIC-P2' }), false)
  assert.strictEqual(nricMatch({ nric: '' }, { nric: 'DEMO-NRIC-P1' }), false)
})

test('findPersonnelDuplicates: 纯中文 ↔ 拼音+中文 命中 exact_chinese', () => {
  const people = [
    { _id: '1', name: '施金帆', nameChinese: '' },
    { _id: '2', name: 'JINFAN', nameChinese: '施金帆' },
  ]
  const pairs = findPersonnelDuplicates(people)
  assert.strictEqual(pairs.length, 1)
  assert.strictEqual(pairs[0].type, 'exact_chinese')
  assert.strictEqual(pairs[0].score, 1)
})

test('findPersonnelDuplicates: 三态（纯中文/拼音/含空格拼音）收敛为一组', () => {
  const people = [
    { _id: '1', name: '施南路', nameChinese: '' },
    { _id: '2', name: 'NANLU', nameChinese: '施南路' },
    { _id: '3', name: 'SHI Nanlu', nameChinese: '施南路' },
  ]
  const pairs = findPersonnelDuplicates(people)
  // 3 条 → 3 对（O(n^2)）但同组；type 应为 exact_chinese（共享中文 token 施南路）
  assert.ok(pairs.length >= 2)
  assert.ok(pairs.every((p) => p.type === 'exact_chinese'))
})

test('findPersonnelDuplicates: 拼音相互包含（JIANRONG vs JIN JIANRONG）', () => {
  const people = [
    { _id: '1', name: '金建榮 (JIN JIANRONG)', nameChinese: '' },
    { _id: '2', name: 'JIANRONG', nameChinese: '金建榮' },
  ]
  const pairs = findPersonnelDuplicates(people)
  assert.strictEqual(pairs.length, 1)
  assert.strictEqual(pairs[0].type, 'exact_chinese') // 主命中仍是中文 token
})

test('findPersonnelDuplicates: alias 命中（formerNames）', () => {
  const people = [
    { _id: '1', name: 'Old Name', formerNames: [{ name: '施金帆' }] },
    { _id: '2', name: '施金帆', nameChinese: '施金帆' },
  ]
  const pairs = findPersonnelDuplicates(people)
  assert.ok(pairs.length >= 1)
  assert.ok(pairs.some((p) => p.type === 'alias'))
})

test('findPersonnelDuplicates: 不同人不伪命中（施南路 vs 施中安）', () => {
  const people = [
    { _id: '1', name: 'NANLU', nameChinese: '施南路' },
    { _id: '2', name: 'ZHONGAN', nameChinese: '施中安' },
    { _id: '3', name: 'SHI ZHONGAN', nameChinese: '' },
  ]
  const pairs = findPersonnelDuplicates(people)
  // NANLU vs 施中安/ZHONGAN 不应命中；ZHONGAN 与 SHI ZHONGAN 命中（中文 token 施中安）
  const nanluPairs = pairs.filter((p) => [String(p.a._id), String(p.b._id)].includes('1'))
  assert.strictEqual(nanluPairs.length, 0, '施南路 不应与 施中安 命中')
})

test('findPersonnelDuplicates: 拼音姓氏 SHI 不误命中（min len 4）', () => {
  const people = [
    { _id: '1', name: 'SHI Nanlu', nameChinese: '施南路' },
    { _id: '2', name: 'ZHONGAN', nameChinese: '施中安' },
  ]
  const pairs = findPersonnelDuplicates(people)
  assert.strictEqual(pairs.length, 0, 'SHI(3) 不应作为子串命中 ZHONGAN')
})

test('findPersonnelDuplicates: 已合并(status=merged) 被 scopeFilter 排除', () => {
  const people = [
    { _id: '1', name: '施金帆', nameChinese: '', status: 'merged' },
    { _id: '2', name: 'JINFAN', nameChinese: '施金帆' },
  ]
  const pairs = findPersonnelDuplicates(people, { scopeFilter: (p) => p.status !== 'merged' })
  assert.strictEqual(pairs.length, 0)
})

test('findPersonnelDuplicates: 空集合', () => {
  assert.deepStrictEqual(findPersonnelDuplicates([]), [])
})

test('collectPersonnelTokens: 合并 name + nameChinese + formerNames', () => {
  const p = { name: 'JINFAN', nameChinese: '施金帆', formerNames: [{ name: 'Shi Jinfan' }] }
  const t = collectPersonnelTokens(p)
  assert.ok(t.chinese.includes('施金帆'))
  assert.ok(t.pinyin.includes('JINFAN'))
})
