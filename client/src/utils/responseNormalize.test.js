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

test('兜底：未知形状整包作为 payload', () => {
  const body = { foo: 'bar' }
  expect(normalize(body)).toEqual({ data: { data: { foo: 'bar' } } })
})

test('null / undefined 兜底不抛错', () => {
  expect(normalize(null)).toEqual({ data: { data: null } })
  expect(normalize(undefined)).toEqual({ data: { data: undefined } })
})
