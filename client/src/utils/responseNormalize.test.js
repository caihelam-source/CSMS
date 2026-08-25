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
