/**
 * 同源守卫单测（O6 / B4）
 *
 * 前端镜像 `client/src/constants/templateCategories.js` 与后端唯一事实源
 * `shared/templateCategories.json` 必须**逐项全等**。改一边不改另一边 ⇒ 本测试红。
 *
 * B4 根因回顾：前端下拉给出的 category 不在后端 Model enum 内 ⇒ 保存必 500。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from 'vitest'
import {
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_BADGE,
  TEMPLATE_CATEGORY_OPTIONS,
  categoryLabel,
  categoryBadge,
  isValidCategory,
} from './templateCategories.js'

// client/src/constants/ → 上三层即仓库根目录 Claw/
const sharedJsonPath = fileURLToPath(new URL('../../../shared/templateCategories.json', import.meta.url))
const shared = JSON.parse(readFileSync(sharedJsonPath, 'utf-8'))

test('shared/templateCategories.json 可读且结构合法', () => {
  expect(Array.isArray(shared.values)).toBe(true)
  expect(typeof shared.labels).toBe('object')
  expect(shared.values).toHaveLength(13)
})

test('values 数组与前端镜像逐项全等（含顺序）', () => {
  expect(TEMPLATE_CATEGORY_VALUES).toEqual(shared.values)
})

test('labels 对象与前端镜像逐项全等', () => {
  expect(TEMPLATE_CATEGORY_LABELS).toEqual(shared.labels)
})

test('每个 value 都有 label 与徽标配色，无遗漏', () => {
  for (const value of shared.values) {
    expect(typeof TEMPLATE_CATEGORY_LABELS[value]).toBe('string')
    expect(TEMPLATE_CATEGORY_LABELS[value].length).toBeGreaterThan(0)
    expect(typeof TEMPLATE_CATEGORY_BADGE[value]).toBe('string')
  }
})

test('labels 不含 values 之外的多余键', () => {
  expect(Object.keys(TEMPLATE_CATEGORY_LABELS).sort()).toEqual([...shared.values].sort())
})

test('OPTIONS 与 values 同序同长', () => {
  expect(TEMPLATE_CATEGORY_OPTIONS.map((o) => o.value)).toEqual(shared.values)
  expect(TEMPLATE_CATEGORY_OPTIONS.map((o) => o.label)).toEqual(shared.values.map((v) => shared.labels[v]))
})

test('内置 6 个 preset 使用的分类均在白名单内（设计 §7.1 映射）', () => {
  const presetCategories = [
    'annual_report',        // 董事确认函
    'ipo_filing',           // DU004G 董事声明及承诺
    'internal_control',     // 部门管理层年度内控自评表
    'internal_control',     // 内控评估报告模板
    'board_resolution',     // 董事会声明和决议记录
    'project_governance',   // 项目章程
  ]
  for (const c of presetCategories) {
    expect(shared.values).toContain(c)
    expect(isValidCategory(c)).toBe(true)
  }
})

test('辅助函数对未知分类安全回退', () => {
  expect(categoryLabel('not_exist')).toBe('not_exist')
  expect(categoryLabel('')).toBe('其他')
  expect(categoryBadge('not_exist')).toBe(TEMPLATE_CATEGORY_BADGE.other)
  expect(isValidCategory('not_exist')).toBe(false)
  expect(isValidCategory(undefined)).toBe(false)
})
