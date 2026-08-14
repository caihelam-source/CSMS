// 行级数据范围 —— Personnel 反查单测（无需数据库）
// 说明：Personnel 无 company 字段，可见性唯一事实源是 Company.links[{link, linkModel:'Personnel'}]。
// 本文件用 stub 替换 Company.aggregate / Company.exists，只验证 scope 中间件的语义，不触碰 MongoDB。
const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const Company = require('../models/Company')
const {
  scopeMiddleware,
  applyListScope,
  inScope,
  getScopeCompanies,
  toObjectIds,
  resolvePersonnelIdsInScope,
  personnelInScope,
} = require('../middleware/scope')

// ── 固定 ObjectId 夹具 ──
const C1 = '65a000000000000000000001'
const C2 = '65a000000000000000000002'
const C3 = '65a000000000000000000003'
const P1 = '65b000000000000000000001'
const P2 = '65b000000000000000000002'
const P3 = '65b000000000000000000003'

// 内存版 Company.links 表：company -> personnel[]
const LINKS = {
  [C1]: [P1, P2],
  [C2]: [P2], // 与 C1 有交集，用于验证「合并去重」
  [C3]: [P3],
}

/** 用内存数据模拟 Company.aggregate 的 $match/$unwind/$group 管道结果 */
function stubAggregate() {
  Company.aggregate = async (pipeline) => {
    const match = pipeline.find((s) => s.$match && s.$match._id)
    const oids = (match?.$match?._id?.$in || []).map(String)
    const set = new Set()
    oids.forEach((cid) => (LINKS[cid] || []).forEach((pid) => set.add(pid)))
    return [...set].map((pid) => ({ _id: new mongoose.Types.ObjectId(pid) }))
  }
}

/** 模拟 Company.exists({_id:{$in}, links:{$elemMatch:{linkModel,link}}}) */
function stubExists() {
  Company.exists = async (filter) => {
    const oids = (filter?._id?.$in || []).map(String)
    const target = String(filter?.links?.$elemMatch?.link || '')
    const hit = oids.some((cid) => (LINKS[cid] || []).includes(target))
    return hit ? { _id: new mongoose.Types.ObjectId(oids[0]) } : null
  }
}

stubAggregate()
stubExists()

const reqWith = (scopeCompanies) => ({ scopeCompanies })

// ── getScopeCompanies / scopeMiddleware：三态语义 ──
test('getScopeCompanies: admin / auditor 返回 null（不受限）', () => {
  assert.strictEqual(getScopeCompanies({ user: { role: 'admin', accessibleCompanies: [C1] } }), null)
  assert.strictEqual(getScopeCompanies({ user: { role: 'auditor', accessibleCompanies: [] } }), null)
})

test('getScopeCompanies: 受限角色空 accessibleCompanies 返回 []（明确无授权，绝非不限）', () => {
  const ids = getScopeCompanies({ user: { role: 'manager', accessibleCompanies: [] } })
  assert.deepStrictEqual(ids, [])
  assert.notStrictEqual(ids, null)
})

test('getScopeCompanies: 受限角色返回字符串化 ID 数组', () => {
  const ids = getScopeCompanies({ user: { role: 'viewer', accessibleCompanies: [new mongoose.Types.ObjectId(C1)] } })
  assert.deepStrictEqual(ids, [C1])
})

test('scopeMiddleware: 把结果挂到 req.scopeCompanies 并放行', () => {
  const req = { user: { role: 'manager', accessibleCompanies: [C1, C2] } }
  let nextCalled = false
  scopeMiddleware(req, {}, () => { nextCalled = true })
  assert.strictEqual(nextCalled, true)
  assert.deepStrictEqual(req.scopeCompanies, [C1, C2])
})

// ── toObjectIds：非法 ID 静默丢弃，不抛 CastError ──
test('toObjectIds: 过滤非法 ID，保留合法 ObjectId', () => {
  const out = toObjectIds([C1, 'not-an-objectid', '', null, C2])
  assert.strictEqual(out.length, 2)
  assert.deepStrictEqual(out.map(String), [C1, C2])
})

// ── applyListScope ──
test('applyListScope: null 不注入任何约束', () => {
  const q = {}
  applyListScope(q, reqWith(null), 'company')
  assert.deepStrictEqual(q, {})
})

test('applyListScope: [] 注入 $in:[] → 结果必为空', () => {
  const q = {}
  applyListScope(q, reqWith([]), 'company')
  assert.deepStrictEqual(q, { company: { $in: [] } })
})

test('applyListScope: field=_id 时约束 Company 自身', () => {
  const q = {}
  applyListScope(q, reqWith([C1]), '_id')
  assert.deepStrictEqual(q, { _id: { $in: [C1] } })
})

// ── inScope ──
test('inScope: null 恒真；[] 恒假；命中/未命中', () => {
  assert.strictEqual(inScope(reqWith(null), C3), true)
  assert.strictEqual(inScope(reqWith([]), C1), false)
  assert.strictEqual(inScope(reqWith([C1, C2]), new mongoose.Types.ObjectId(C1)), true)
  assert.strictEqual(inScope(reqWith([C1, C2]), C3), false)
  assert.strictEqual(inScope(reqWith([C1]), null), false)
})

// ── resolvePersonnelIdsInScope ──
test('resolvePersonnelIdsInScope: admin/auditor（null）返回 null（不受限）', async () => {
  assert.strictEqual(await resolvePersonnelIdsInScope(reqWith(null)), null)
})

test('resolvePersonnelIdsInScope: 空 scope 返回 []（明确无授权）', async () => {
  const out = await resolvePersonnelIdsInScope(reqWith([]))
  assert.deepStrictEqual(out, [])
  assert.notStrictEqual(out, null)
})

test('resolvePersonnelIdsInScope: 多公司做并集（OR）且去重', async () => {
  const out = (await resolvePersonnelIdsInScope(reqWith([C1, C2]))).map(String).sort()
  assert.deepStrictEqual(out, [P1, P2].sort()) // P2 同属 C1/C2，只出现一次
})

test('resolvePersonnelIdsInScope: 单公司只返回该公司人员', async () => {
  const out = (await resolvePersonnelIdsInScope(reqWith([C3]))).map(String)
  assert.deepStrictEqual(out, [P3])
})

test('resolvePersonnelIdsInScope: 全为非法 ID 时返回 []（不退化成不限）', async () => {
  const out = await resolvePersonnelIdsInScope(reqWith(['bogus', '123']))
  assert.deepStrictEqual(out, [])
})

// ── personnelInScope ──
test('personnelInScope: null scope 恒真', async () => {
  assert.strictEqual(await personnelInScope(reqWith(null), P3), true)
})

test('personnelInScope: 空 scope 恒假', async () => {
  assert.strictEqual(await personnelInScope(reqWith([]), P1), false)
})

test('personnelInScope: 命中返回 true，越权返回 false', async () => {
  assert.strictEqual(await personnelInScope(reqWith([C1]), P1), true)
  assert.strictEqual(await personnelInScope(reqWith([C1]), P3), false)
  assert.strictEqual(await personnelInScope(reqWith([C3]), P3), true)
})

test('personnelInScope: personnelId 缺失返回 false', async () => {
  assert.strictEqual(await personnelInScope(reqWith([C1]), null), false)
})

// ── 列表交集语义：?company=<越权公司> 应得空列表而非 403 ──
test('列表交集：显式 company 过滤与 scope 取交集，越权时为空集', async () => {
  const req = reqWith([C1])
  const scopedPids = await resolvePersonnelIdsInScope(req)
  // 模拟用户传 ?company=C3（越权）后 role/company 聚合得到的 query._id
  const query = { _id: { $in: [new mongoose.Types.ObjectId(P3)] } }
  const allow = new Set(scopedPids.map(String))
  query._id = { $in: query._id.$in.filter((id) => allow.has(String(id))) }
  assert.deepStrictEqual(query._id.$in, []) // 空列表，不报错
})

test('列表交集：合法 company 过滤保留交集结果', async () => {
  const req = reqWith([C1, C2])
  const scopedPids = await resolvePersonnelIdsInScope(req)
  const query = { _id: { $in: [P2, P3].map((p) => new mongoose.Types.ObjectId(p)) } }
  const allow = new Set(scopedPids.map(String))
  query._id = { $in: query._id.$in.filter((id) => allow.has(String(id))) }
  assert.deepStrictEqual(query._id.$in.map(String), [P2])
})
