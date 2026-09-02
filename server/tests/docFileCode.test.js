// docFileCode util 单元测试
// 覆盖：
//  1) inferEntityCode：jurisdiction 推断 + stockCode → LISTCO + regNo 兜底
//  2) inferTypeCode：DOC_TYPE_CODE 表 + 兜底 OTH
//  3) parseV6Filename / buildV6DocNumber：round-trip
//  4) renumberCompanyDocs：按 typeCode 分组 + createdAt 升序 + 幂等（重复跑返回空数组）
const test = require('node:test')
const assert = require('node:assert')
const {
  inferEntityCode,
  inferTypeCode,
  parseV6Filename,
  buildV6DocNumber,
  renumberCompanyDocs,
} = require('../utils/docFileCode')

test('inferEntityCode: HK 私人默认 HKOP', () => {
  assert.strictEqual(inferEntityCode({ jurisdiction: 'HK' }), 'HKOP')
  assert.strictEqual(inferEntityCode({ jurisdiction: 'HK', stockCode: '1234' }), 'HKOP') // 4 位不是 5
})

test('inferEntityCode: HK + 5 位 stockCode → LISTCO', () => {
  assert.strictEqual(inferEntityCode({ jurisdiction: 'HK', stockCode: '00700' }), 'LISTCO')
  assert.strictEqual(inferEntityCode({ jurisdiction: 'HK', stockCode: '07513' }), 'LISTCO')
})

test('inferEntityCode: BVI/Cayman/SG', () => {
  assert.strictEqual(inferEntityCode({ jurisdiction: 'BVI' }), 'BVIC')
  assert.strictEqual(inferEntityCode({ jurisdiction: 'Cayman' }), 'CAYM')
  assert.strictEqual(inferEntityCode({ jurisdiction: 'SG' }), 'SGPC')
})

test('inferEntityCode: 其他 jurisdiction 走 regNo 兜底', () => {
  assert.strictEqual(inferEntityCode({ jurisdiction: 'OTHER', registrationNumber: '12345678' }), '5678')
  assert.strictEqual(inferEntityCode({ jurisdiction: 'OTHER' }), 'GEN')
})

test('inferEntityCode: null/undefined 返 GEN', () => {
  assert.strictEqual(inferEntityCode(null), 'GEN')
  assert.strictEqual(inferEntityCode(undefined), 'GEN')
})

test('inferTypeCode: 已知 type 命中映射表', () => {
  assert.strictEqual(inferTypeCode('business_registration'), 'BR')
  assert.strictEqual(inferTypeCode('nar1_return'), 'NAR1')
  assert.strictEqual(inferTypeCode('nn3_return'), 'NN3')
  assert.strictEqual(inferTypeCode('minutes'), 'MIN')
  assert.strictEqual(inferTypeCode('financial_statement'), 'FS')
})

test('inferTypeCode: 未知 type → OTH', () => {
  assert.strictEqual(inferTypeCode(''), 'OTH')
  assert.strictEqual(inferTypeCode('something_weird'), 'OTH')
  assert.strictEqual(inferTypeCode(undefined), 'OTH')
})

test('parseV6Filename: 标准格式', () => {
  const r = parseV6Filename('HKOP-2026-BR-0001')
  assert.deepStrictEqual(r, { ownerCode: 'HKOP', year: 2026, typeCode: 'BR', seq: 1, ext: '' })
})

test('parseV6Filename: 带 .pdf 后缀', () => {
  const r = parseV6Filename('LISTCO-2025-NAR1-0042.pdf')
  assert.deepStrictEqual(r, { ownerCode: 'LISTCO', year: 2025, typeCode: 'NAR1', seq: 42, ext: 'pdf' })
})

test('parseV6Filename: 不规范格式返 null', () => {
  assert.strictEqual(parseV6Filename('some old filename.pdf'), null)
  assert.strictEqual(parseV6Filename(''), null)
  assert.strictEqual(parseV6Filename(null), null)
})

test('buildV6DocNumber + parseV6Filename: round-trip', () => {
  const company = { jurisdiction: 'HK', registrationNumber: '35387857' }
  const num = buildV6DocNumber({ company, type: 'business_registration', createdAt: new Date('2026-03-31'), seq: 1 })
  assert.strictEqual(num, 'HKOP-2026-BR-0001')
  const parsed = parseV6Filename(num)
  assert.strictEqual(parsed.ownerCode, 'HKOP')
  assert.strictEqual(parsed.year, 2026)
  assert.strictEqual(parsed.typeCode, 'BR')
  assert.strictEqual(parsed.seq, 1)
})

test('buildV6DocNumber: seq 4 位补零', () => {
  const num = buildV6DocNumber({ company: { jurisdiction: 'BVI' }, type: 'minutes', seq: 12 })
  assert.strictEqual(num, 'BVIC-2026-MIN-0012')
})

test('renumberCompanyDocs: 按 (year, typeCode) 分组 + createdAt 升序（年内 seq 重置）', () => {
  const company = { jurisdiction: 'HK', registrationNumber: '35387857' }
  // 同一 company 下混 BR（两年份）+ NAR1（两年份）；每年同类型从 1 重新计
  const docs = [
    { _id: 'd1', type: 'business_registration', createdAt: new Date('2024-03-31'), docNumber: 'OLD-BR-1' },
    { _id: 'd2', type: 'nar1_return', createdAt: new Date('2025-09-17'), docNumber: 'OLD-NAR1-1' },
    { _id: 'd3', type: 'nar1_return', createdAt: new Date('2026-09-17'), docNumber: 'OLD-NAR1-2' },
    { _id: 'd4', type: 'business_registration', createdAt: new Date('2026-04-08'), docNumber: 'OLD-BR-2' },
  ]
  const ops = renumberCompanyDocs(company, docs)
  // 4 个都应被更新（docNumber 都是 OLD- 前缀）
  assert.strictEqual(ops.length, 4)
  const d1Op = ops.find((op) => String(op.updateOne.filter._id) === 'd1')
  const d4Op = ops.find((op) => String(op.updateOne.filter._id) === 'd4')
  // BR 2024 与 BR 2026 各自分组，seq 从 1 起
  assert.strictEqual(d1Op.updateOne.update.$set.docNumber, 'HKOP-2024-BR-0001')
  assert.strictEqual(d4Op.updateOne.update.$set.docNumber, 'HKOP-2026-BR-0001')
  // NAR1 同理，2025 与 2026 各自分组
  const d2Op = ops.find((op) => String(op.updateOne.filter._id) === 'd2')
  const d3Op = ops.find((op) => String(op.updateOne.filter._id) === 'd3')
  assert.strictEqual(d2Op.updateOne.update.$set.docNumber, 'HKOP-2025-NAR1-0001')
  assert.strictEqual(d3Op.updateOne.update.$set.docNumber, 'HKOP-2026-NAR1-0001')
})

test('renumberCompanyDocs: 同年多个同类型文档 seq 累加', () => {
  const company = { jurisdiction: 'HK' }
  const docs = [
    { _id: 'd1', type: 'minutes', createdAt: new Date('2026-01-15'), docNumber: 'OLD-MIN-1' },
    { _id: 'd2', type: 'minutes', createdAt: new Date('2026-03-22'), docNumber: 'OLD-MIN-2' },
    { _id: 'd3', type: 'minutes', createdAt: new Date('2026-09-17'), docNumber: 'OLD-MIN-3' },
  ]
  const ops = renumberCompanyDocs(company, docs)
  assert.strictEqual(ops.length, 3)
  assert.strictEqual(ops[0].updateOne.update.$set.docNumber, 'HKOP-2026-MIN-0001')
  assert.strictEqual(ops[1].updateOne.update.$set.docNumber, 'HKOP-2026-MIN-0002')
  assert.strictEqual(ops[2].updateOne.update.$set.docNumber, 'HKOP-2026-MIN-0003')
})

test('renumberCompanyDocs: 编号已对齐 → 不返 op（幂等）', () => {
  const company = { jurisdiction: 'HK' }
  const docs = [
    { _id: 'd1', type: 'business_registration', createdAt: new Date('2026-01-01'), docNumber: 'HKOP-2026-BR-0001' },
  ]
  const ops = renumberCompanyDocs(company, docs)
  assert.deepStrictEqual(ops, [])
})

test('renumberCompanyDocs: 空文档列表', () => {
  assert.deepStrictEqual(renumberCompanyDocs({ jurisdiction: 'HK' }, []), [])
})

test('renumberCompanyDocs: LISTCO 公司用 LISTCO- 前缀', () => {
  const company = { jurisdiction: 'HK', stockCode: '00700' }
  const docs = [
    { _id: 'd1', type: 'business_registration', createdAt: new Date('2026-01-01'), docNumber: 'OLD' },
  ]
  const ops = renumberCompanyDocs(company, docs)
  assert.strictEqual(ops[0].updateOne.update.$set.docNumber, 'LISTCO-2026-BR-0001')
})
