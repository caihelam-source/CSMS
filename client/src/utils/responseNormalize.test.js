import { test, expect } from 'vitest'
import { normalize } from './responseNormalize.js'

test('双层嵌套直接透传 (data.data)', () => {
  const body = { data: { data: { id: 1, name: 'Acme' } } }
  expect(normalize(body)).toEqual({ data: { data: { id: 1, name: 'Acme' } } })
})

test('单层嵌套包成 data.data', () => {
  const body = { success: true, data: [{ a: 1 }, { a: 2 }] }
  expect(normalize(body)).toEqual({ data: { data: [{ a: 1 }, { a: 2 }] } })
})

test('扁平响应提取主负载实体键 (personnel)', () => {
  const body = { success: true, personnel: { _id: 'p1', name: 'Vincent' } }
  expect(normalize(body)).toEqual({ data: { data: { _id: 'p1', name: 'Vincent' } } })
})

test('扁平响应提取主负载实体键 (companies 列表)', () => {
  const body = { success: true, count: 2, companies: [{ _id: 'c1' }, { _id: 'c2' }] }
  expect(normalize(body)).toEqual({ data: { data: [{ _id: 'c1' }, { _id: 'c2' }] } })
})

test('扁平响应提取主负载实体键 (rules 列表) —— 修复 CompanyDetail 白屏', () => {
  const body = { success: true, count: 2, rules: [{ _id: 'r1', jurisdiction: 'HK' }, { _id: 'r2', jurisdiction: 'ALL' }] }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(true)
  expect(out).toEqual({ data: { data: [{ _id: 'r1', jurisdiction: 'HK' }, { _id: 'r2', jurisdiction: 'ALL' }] } })
})

test('扁平响应提取主负载实体键 (rule 单条)', () => {
  const body = { success: true, rule: { _id: 'r1', ruleName: 'HK AR' } }
  expect(normalize(body)).toEqual({ data: { data: { _id: 'r1', ruleName: 'HK AR' } } })
})

test('rules 空列表也应返回数组而非兜底整包', () => {
  const body = { success: true, count: 0, rules: [] }
  expect(normalize(body)).toEqual({ data: { data: [] } })
})

test('扁平响应提取主负载实体键 (templates 列表) —— 修复 B1 模板页白屏', () => {
  const body = { success: true, count: 2, templates: [{ _id: 't1' }, { _id: 't2' }] }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(true)
  expect(out).toEqual({ data: { data: [{ _id: 't1' }, { _id: 't2' }] } })
})

test('扁平响应提取主负载实体键 (template 单条)', () => {
  const body = { success: true, template: { _id: 't1', name: '董事确认函' } }
  expect(normalize(body)).toEqual({ data: { data: { _id: 't1', name: '董事确认函' } } })
})

test('templates 空列表也应返回数组而非兜底整包', () => {
  const body = { success: true, count: 0, templates: [] }
  expect(normalize(body)).toEqual({ data: { data: [] } })
})

test('单数 template 优先于复数 templates（两者同时存在时取单条）', () => {
  const body = { success: true, template: { _id: 't1' }, templates: [{ _id: 't2' }] }
  expect(normalize(body)).toEqual({ data: { data: { _id: 't1' } } })
})

test('兜底：未知形状整包作为 payload', () => {
  const body = { foo: 'bar' }
  expect(normalize(body)).toEqual({ data: { data: { foo: 'bar' } } })
})

test('null / undefined 兜底不抛错', () => {
  expect(normalize(null)).toEqual({ data: { data: null } })
  expect(normalize(undefined)).toEqual({ data: { data: undefined } })
})

// ===== 复合响应（多数据字段）根因修复 =====
// 旧实现第 3 条只抽第一个 ENTITY_KEYS 实体键，会丢弃 totalCompanies / summary 等同级字段，
// 导致合规「数据缺口」diagnose 接口解构崩溃。现统一保留全部 sibling。

test('复合型扁平响应保留全部 sibling（diagnose: companies + totalCompanies + summary）', () => {
  const body = {
    success: true,
    companies: [{ _id: 'c1', missingFields: ['incorporationDate'] }],
    companiesWithGaps: 1,
    totalCompanies: 3,
    summary: { byField: { incorporationDate: 1 }, totalMissing: 1 },
  }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(false)
  expect(out.data.data).toEqual({
    companies: [{ _id: 'c1', missingFields: ['incorporationDate'] }],
    companiesWithGaps: 1,
    totalCompanies: 3,
    summary: { byField: { incorporationDate: 1 }, totalMissing: 1 },
  })
})

test('规范形状 { success, data } 合并 sibling（saveRules: data + counts）', () => {
  const body = {
    success: true,
    data: { version: '2026-01', revision: 2 },
    counts: { rules: 3, parties: 1 },
  }
  const out = normalize(body)
  expect(out.data.data).toEqual({
    version: '2026-01',
    revision: 2,
    counts: { rules: 3, parties: 1 },
  })
})

test('实体键带 sibling 也保留（signTasks sign: task + allSigned）', () => {
  const body = {
    success: true,
    task: { _id: 't1', status: 'completed' },
    allSigned: true,
  }
  const out = normalize(body)
  expect(out.data.data).toEqual({
    task: { _id: 't1', status: 'completed' },
    allSigned: true,
  })
})

test('无实体键多字段仍整包作为 payload（resultsTimetable list: results）', () => {
  const body = { success: true, results: [{ _id: 'r1' }] }
  const out = normalize(body)
  expect(out.data.data).toEqual({ results: [{ _id: 'r1' }] })
})

// ===== 列表型 + 分页 meta（规则 E）根因修复 =====
// 历史教训：08-31 personnel 列表崩「O.map is not a function」, 后端 {success, count, total, page, pageSize, personnel}
// 走 D 复合型 → payload 是 {personnel, total, page, pageSize} 对象 → 前端 .map 白屏。
// 修复：识别「单实体键(数组) + 仅分页 meta」，抽数组作 payload，分页 meta 放 result.paging。

test('规则 E: paging 列表抽数组作 payload（personnel 含 total/page/pageSize）', () => {
  const body = {
    success: true,
    count: 2,
    total: 25,
    page: 1,
    pageSize: 10,
    personnel: [{ _id: 'p1', name: 'A' }, { _id: 'p2', name: 'B' }],
  }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(true)
  expect(out.data.data).toEqual([{ _id: 'p1', name: 'A' }, { _id: 'p2', name: 'B' }])
  expect(out.paging).toEqual({ total: 25, page: 1, pageSize: 10 })
})

test('规则 E: paging 列表不带 page/pageSize（usePaging=false，只 total）', () => {
  const body = { success: true, count: 3, total: 12, documents: [{ _id: 'd1' }, { _id: 'd2' }, { _id: 'd3' }] }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(true)
  expect(out.data.data).toEqual([{ _id: 'd1' }, { _id: 'd2' }, { _id: 'd3' }])
  expect(out.paging).toEqual({ total: 12 })
})

test('规则 E: paging 列表空数组（count=0）也应返回数组', () => {
  const body = { success: true, count: 0, total: 0, tasks: [] }
  const out = normalize(body)
  expect(out.data.data).toEqual([])
  expect(out.paging).toEqual({ total: 0 })
})

test('规则 E: duplicates 接口 { success, duplicates, total } → 数组 + paging', () => {
  const body = {
    success: true,
    duplicates: [{ key: 'name+nric', records: [{ _id: 'p1' }, { _id: 'p2' }] }],
    total: 1,
  }
  const out = normalize(body)
  expect(Array.isArray(out.data.data)).toBe(true)
  expect(out.data.data).toEqual([{ key: 'name+nric', records: [{ _id: 'p1' }, { _id: 'p2' }] }])
  expect(out.paging).toEqual({ total: 1 })
})

test('规则 E: 单实体键不是数组时降级走 D 复合型（保安全）', () => {
  // 异常响应：实体键是对象而非数组（理论上不会发生，但防御性兜底）
  const body = { success: true, count: 1, total: 1, personnel: { _id: 'p1' } }
  const out = normalize(body)
  // entityKeys=['personnel'], body.personnel 不是数组 → 不命中 E → 命中 D
  expect(out.data.data).toEqual({ count: undefined, personnel: { _id: 'p1' }, total: 1 })
})

test('规则 E: 数据键含非分页 meta 时降级走 D 复合型（不强行抽）', () => {
  const body = {
    success: true,
    count: 1,
    total: 1,
    companies: [{ _id: 'c1' }],
    summary: { byJurisdiction: { HK: 1 } }, // 非分页 meta → 不命中 E
  }
  const out = normalize(body)
  expect(out.data.data).toEqual({
    companies: [{ _id: 'c1' }],
    summary: { byJurisdiction: { HK: 1 } },
    total: 1,
  })
})

