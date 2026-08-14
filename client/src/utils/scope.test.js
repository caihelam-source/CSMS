import { test, expect } from 'vitest'
import {
  SCOPE_BYPASS_ROLES,
  toId,
  isScopeBypass,
  normalizeScopeIds,
  inScopeId,
  personnelIdsInScope,
} from './scope.js'

// ── toId：抹平 real（字符串/ObjectId）与 mock（对象）两种形状 ──
test('toId: 字符串原样返回', () => {
  expect(toId('c1')).toBe('c1')
})

test('toId: 对象取 _id，其次 id', () => {
  expect(toId({ _id: 'c1', name: 'Acme' })).toBe('c1')
  expect(toId({ id: 'u2' })).toBe('u2')
})

test('toId: null / undefined 不抛错', () => {
  expect(toId(null)).toBe(null)
  expect(toId(undefined)).toBe(undefined)
})

// ── 豁免角色 ──
test('SCOPE_BYPASS_ROLES 与后端 rbac 对齐（admin + auditor）', () => {
  expect(SCOPE_BYPASS_ROLES).toEqual(['admin', 'auditor'])
})

test('isScopeBypass: admin/auditor 豁免，secretary/manager/viewer 不豁免', () => {
  expect(isScopeBypass({ role: 'admin' })).toBe(true)
  expect(isScopeBypass({ role: 'auditor' })).toBe(true)
  expect(isScopeBypass({ role: 'secretary' })).toBe(false)
  expect(isScopeBypass({ role: 'manager' })).toBe(false)
  expect(isScopeBypass({ role: 'viewer' })).toBe(false)
})

// ── normalizeScopeIds：三态语义（最容易写反的地方）──
test('normalizeScopeIds: admin → null（不受限，即使带了 accessibleCompanies）', () => {
  expect(normalizeScopeIds({ role: 'admin', accessibleCompanies: ['c1'] })).toBe(null)
})

test('normalizeScopeIds: auditor → null（跨公司审计只读，不能被误伤）', () => {
  expect(normalizeScopeIds({ role: 'auditor', accessibleCompanies: [] })).toBe(null)
})

test('normalizeScopeIds: accessibleCompanies 缺失(undefined) → null（旧登录态不过滤）', () => {
  expect(normalizeScopeIds({ role: 'manager' })).toBe(null)
})

test('normalizeScopeIds: accessibleCompanies 为 null → null（不过滤）', () => {
  expect(normalizeScopeIds({ role: 'manager', accessibleCompanies: null })).toBe(null)
})

test('normalizeScopeIds: [] → [] 明确无授权，绝不等于"不限"', () => {
  const out = normalizeScopeIds({ role: 'viewer', accessibleCompanies: [] })
  expect(out).toEqual([])
  expect(out).not.toBe(null)
})

test('normalizeScopeIds: 无 user → null（未登录不过滤，交给路由守卫）', () => {
  expect(normalizeScopeIds(null)).toBe(null)
  expect(normalizeScopeIds(undefined)).toBe(null)
})

test('normalizeScopeIds: 受限用户返回字符串化 ID', () => {
  expect(normalizeScopeIds({ role: 'manager', accessibleCompanies: ['c1', 'c2'] })).toEqual(['c1', 'c2'])
})

test('normalizeScopeIds: 对象形状的 accessibleCompanies 也能归一化', () => {
  const user = { role: 'manager', accessibleCompanies: [{ _id: 'c1' }, { _id: 'c2' }] }
  expect(normalizeScopeIds(user)).toEqual(['c1', 'c2'])
})

test('normalizeScopeIds: 剔除空值', () => {
  const user = { role: 'manager', accessibleCompanies: ['c1', null, undefined, ''] }
  expect(normalizeScopeIds(user)).toEqual(['c1'])
})

// ── inScopeId ──
test('inScopeId: null 恒真（不受限）', () => {
  expect(inScopeId(null, 'c9')).toBe(true)
  expect(inScopeId(null, undefined)).toBe(true)
})

test('inScopeId: [] 恒假（明确无授权）', () => {
  expect(inScopeId([], 'c1')).toBe(false)
})

test('inScopeId: 命中/未命中，且比较前统一 String()', () => {
  expect(inScopeId(['c1', 'c2'], 'c1')).toBe(true)
  expect(inScopeId(['c1', 'c2'], 'c3')).toBe(false)
  expect(inScopeId(['1', '2'], 1)).toBe(true) // 数字 ID 也能命中
  expect(inScopeId(['c1'], null)).toBe(false)
})

// ── personnelIdsInScope：mock 形状 vs real 形状 ──
const MOCK_SHAPE_COMPANIES = [
  {
    _id: 'c1',
    links: [
      { linkModel: 'Personnel', link: { _id: 'p1', name: '施金帆' } },
      { linkModel: 'Personnel', link: { _id: 'p2', name: '施南路' } },
      { linkModel: 'Company', link: { _id: 'c6', name: 'BVI Co' } },
    ],
  },
  {
    _id: 'c2',
    links: [
      { linkModel: 'Personnel', link: { _id: 'p2', name: '施南路' } },
      { linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀' } },
    ],
  },
  {
    _id: 'c3',
    links: [{ linkModel: 'Personnel', link: { _id: 'p3', name: '施中安' } }],
  },
]

const REAL_SHAPE_COMPANIES = [
  {
    _id: '65a000000000000000000001',
    links: [
      { linkModel: 'Personnel', link: '65b000000000000000000001' },
      { linkModel: 'Personnel', link: '65b000000000000000000002' },
      { linkModel: 'Company', link: '65a000000000000000000006' },
    ],
  },
  {
    _id: '65a000000000000000000003',
    links: [{ linkModel: 'Personnel', link: '65b000000000000000000003' }],
  },
]

test('personnelIdsInScope: null scope → null（不受限）', () => {
  expect(personnelIdsInScope(MOCK_SHAPE_COMPANIES, null)).toBe(null)
})

test('personnelIdsInScope: [] scope → 空集合', () => {
  const set = personnelIdsInScope(MOCK_SHAPE_COMPANIES, [])
  expect(set).toBeInstanceOf(Set)
  expect(set.size).toBe(0)
})

test('personnelIdsInScope: mock 形状（link 为对象）反查出人员集合，多公司并集去重', () => {
  const set = personnelIdsInScope(MOCK_SHAPE_COMPANIES, ['c1', 'c2'])
  expect([...set].sort()).toEqual(['p1', 'p2', 'p4'])
  expect(set.has('p3')).toBe(false) // c3 越权，不可见
})

test('personnelIdsInScope: mock 形状 —— 单公司只见本公司人员', () => {
  const set = personnelIdsInScope(MOCK_SHAPE_COMPANIES, ['c3'])
  expect([...set]).toEqual(['p3'])
})

test('personnelIdsInScope: real 形状（link 为 ObjectId 字符串）同样可反查', () => {
  const set = personnelIdsInScope(REAL_SHAPE_COMPANIES, ['65a000000000000000000001'])
  expect([...set].sort()).toEqual(['65b000000000000000000001', '65b000000000000000000002'])
})

test('personnelIdsInScope: 忽略 linkModel !== Personnel 的关联（公司股东不算人员）', () => {
  const set = personnelIdsInScope(MOCK_SHAPE_COMPANIES, ['c1'])
  expect(set.has('c6')).toBe(false)
})

test('personnelIdsInScope: companies 为空/undefined 不抛错', () => {
  expect(personnelIdsInScope(undefined, ['c1']).size).toBe(0)
  expect(personnelIdsInScope([], ['c1']).size).toBe(0)
})

test('personnelIdsInScope: 缺失 links 字段的公司不抛错', () => {
  const set = personnelIdsInScope([{ _id: 'c1' }], ['c1'])
  expect(set.size).toBe(0)
})
