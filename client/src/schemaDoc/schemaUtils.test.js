/**
 * schemaUtils.test.js — 纯函数内核单测（vitest node 环境，无 jsdom）。
 * 覆盖：条件 DSL 算子、校验、初值、派生变量、文件名解析、autoNumber 连续。
 */
import { test, expect, describe } from 'vitest'
import {
  BLANK,
  evalCondition,
  formatDate,
  createInitialData,
  createSampleData,
  validateSchemaData,
  deriveVariables,
  resolveFileName,
  buildDocPlan,
  isFieldVisible,
  isEmptyValue,
} from './schemaUtils.js'

describe('evalCondition — 10 算子 + 3 组合器', () => {
  const data = { a: 'X', n: 5, flag: true, list: ['p', 'q'], box: [{ text: 'o', checked: false }, { text: 'k', checked: true }] }

  test('eq / ne（String 比较）', () => {
    expect(evalCondition({ field: 'a', op: 'eq', value: 'X' }, data)).toBe(true)
    expect(evalCondition({ field: 'a', op: 'eq', value: 'x' }, data)).toBe(false)
    expect(evalCondition({ field: 'a', op: 'ne', value: 'Y' }, data)).toBe(true)
  })

  test('in / nin（值属于数组）', () => {
    expect(evalCondition({ field: 'a', op: 'in', value: ['X', 'Y'] }, data)).toBe(true)
    expect(evalCondition({ field: 'a', op: 'nin', value: ['Y', 'Z'] }, data)).toBe(true)
    expect(evalCondition({ field: 'a', op: 'in', value: ['Y'] }, data)).toBe(false)
  })

  test('gt / gte / lt / lte（数值比较，NaN 恒 false）', () => {
    expect(evalCondition({ field: 'n', op: 'gt', value: 3 }, data)).toBe(true)
    expect(evalCondition({ field: 'n', op: 'gte', value: 5 }, data)).toBe(true)
    expect(evalCondition({ field: 'n', op: 'lt', value: 10 }, data)).toBe(true)
    expect(evalCondition({ field: 'n', op: 'lte', value: 5 }, data)).toBe(true)
    expect(evalCondition({ field: 'n', op: 'gt', value: 100 }, data)).toBe(false)
    expect(evalCondition({ field: 'a', op: 'gt', value: 1 }, data)).toBe(false) // NaN
  })

  test('truthy / falsy（含空串 / 空数组 / false / 未勾选 checklist）', () => {
    expect(evalCondition({ field: 'flag', op: 'truthy' }, data)).toBe(true)
    expect(evalCondition({ field: 'flag', op: 'falsy' }, data)).toBe(false)
    expect(evalCondition({ field: 'a', op: 'falsy' }, { a: '' })).toBe(true)
    expect(evalCondition({ field: 'list', op: 'truthy' }, { list: [] })).toBe(false)
    expect(evalCondition({ field: 'box', op: 'truthy' }, data)).toBe(true) // 任一勾选
    expect(evalCondition({ field: 'box', op: 'truthy' }, { box: [{ text: 'x', checked: false }] })).toBe(false)
  })

  test('组合器 all / any / not', () => {
    expect(evalCondition({ all: [{ field: 'a', op: 'eq', value: 'X' }, { field: 'n', op: 'gt', value: 3 }] }, data)).toBe(true)
    expect(evalCondition({ any: [{ field: 'a', op: 'eq', value: 'Z' }, { field: 'n', op: 'gt', value: 3 }] }, data)).toBe(true)
    expect(evalCondition({ not: { field: 'a', op: 'eq', value: 'Z' } }, data)).toBe(true)
    expect(evalCondition({ all: [{ field: 'a', op: 'eq', value: 'Z' }] }, data)).toBe(false)
  })

  test('逐项作用域 $item / $index / $index1', () => {
    const scope = { $item: { effective: 'N', module: '财务' }, $index: 2, $index1: 3 }
    expect(evalCondition({ field: '$item.effective', op: 'eq', value: 'N' }, {}, scope)).toBe(true)
    expect(evalCondition({ field: '$index', op: 'eq', value: 2 }, {}, scope)).toBe(true)
    expect(evalCondition({ field: '$index1', op: 'eq', value: 3 }, {}, scope)).toBe(true)
  })

  test('白名单外算子：返回 false 且不抛错（绝不 eval）', () => {
    expect(() => evalCondition({ field: 'a', op: 'regex', value: '.*' }, data)).not.toThrow()
    expect(evalCondition({ field: 'a', op: 'regex', value: '.*' }, data)).toBe(false)
    expect(evalCondition(null, data)).toBe(false)
    expect(evalCondition({ field: 'a' }, data)).toBe(false)
  })
})

describe('formatDate', () => {
  test('YYYY-MM-DD → 中文长日期', () => {
    expect(formatDate('2026-03-20')).toBe('2026年3月20日')
  })
  test('空值 → 默认 BLANK', () => {
    expect(formatDate('')).toBe(BLANK)
    expect(formatDate('   ')).toBe(BLANK)
  })
  test('非法字符串原样返回', () => {
    expect(formatDate('2026/03/20')).toBe('2026/03/20')
  })
})

describe('createInitialData / createSampleData', () => {
  const schema = {
    fields: [
      { key: 'name', type: 'text' },
      { key: 'done', type: 'boolean' },
      { key: 'items', type: 'list' },
      { key: 'checks', type: 'checklist' },
      { key: 'sel', type: 'select', default: 'A' },
      { key: 'date', type: 'date' },
    ],
  }
  test('初值按类型生成', () => {
    const d = createInitialData(schema)
    expect(d.name).toBe('')
    expect(d.done).toBe(false)
    expect(d.items).toEqual([])
    expect(d.checks).toEqual([])
    expect(d.sel).toBe('A')
    expect(d.date).toBe('')
  })
  test('示例数据覆盖初值', () => {
    const d = createSampleData(schema, { name: '张三', done: true, items: ['x', 'y'] })
    expect(d.name).toBe('张三')
    expect(d.done).toBe(true)
    expect(d.items).toEqual(['x', 'y'])
    expect(d.sel).toBe('A') // 未被 sample 覆盖
  })
})

describe('validateSchemaData', () => {
  const schema = {
    fields: [
      { key: 'name', label: '公司名称', type: 'text', required: true },
      { key: 'directorType', label: '董事类别', type: 'select' },
      { key: 'independent', label: '独立确认', type: 'boolean', visibleWhen: { field: 'directorType', op: 'eq', value: '独立非执行董事' }, required: true },
    ],
    rules: [
      { id: 'indep', scope: 'form', when: { field: 'directorType', op: 'eq', value: '独立非执行董事' }, message: '独立非执行董事必须填写附加确认。' },
      { id: 'item', scope: 'item:rows', when: { field: '$item.module', op: 'falsy' }, message: '第 {{$index1}} 项模块名称为空。' },
    ],
  }
  test('必填未填 → 报告', () => {
    const errs = validateSchemaData(schema, { name: '' })
    expect(errs).toContain('「公司名称」为必填项。')
  })
  test('隐藏字段不校验', () => {
    const errs = validateSchemaData(schema, { name: 'X', directorType: '执行董事' })
    expect(errs).toHaveLength(0) // independent 隐藏，form 级 indiep 规则也不触发
  })
  test('form 级规则触发', () => {
    const errs = validateSchemaData(schema, { name: 'X', directorType: '独立非执行董事' })
    expect(errs).toContain('独立非执行董事必须填写附加确认。')
  })
  test('item 级规则 + 模板填充', () => {
    const errs = validateSchemaData(schema, { name: 'X', rows: [{ module: '' }, { module: '财务' }] })
    expect(errs).toContain('第 1 项模块名称为空。')
    expect(errs).not.toContain('第 2 项模块名称为空。')
  })
})

describe('deriveVariables', () => {
  test('由 fields 派生变量清单', () => {
    const schema = {
      fields: [
        { key: 'companyName', label: '公司', type: 'text', source: 'company', fieldPath: 'name' },
        { key: 'manual', label: '手动', type: 'text' },
      ],
    }
    expect(deriveVariables(schema)).toEqual([
      { key: 'companyName', label: '公司', source: 'company', fieldPath: 'name' },
      { key: 'manual', label: '手动', source: 'manual', fieldPath: '' },
    ])
  })
})

describe('resolveFileName', () => {
  test('{{fieldKey}} 与内置 {{today}} 替换', () => {
    const out = resolveFileName('{{companyName}}-董事确认函-{{today}}', { companyName: '宏基国际' })
    expect(out.startsWith('宏基国际-董事确认函-')).toBe(true)
    expect(/^\d{8}$/.test(out.slice('宏基国际-董事确认函-'.length))).toBe(true)
  })
  test('空字段按空串处理', () => {
    expect(resolveFileName('{{x}}-y', {})).toBe('-y')
  })
})

describe('isFieldVisible / isEmptyValue', () => {
  test('visibleWhen 走 DSL', () => {
    const f = { key: 'k', type: 'boolean', visibleWhen: { field: 't', op: 'eq', value: 'Y' } }
    expect(isFieldVisible(f, { t: 'Y' })).toBe(true)
    expect(isFieldVisible(f, { t: 'N' })).toBe(false)
    expect(isFieldVisible({ key: 'k', type: 'text' }, {})).toBe(true)
  })
  test('isEmptyValue 按类型', () => {
    expect(isEmptyValue({ type: 'text' }, '')).toBe(true)
    expect(isEmptyValue({ type: 'boolean' }, false)).toBe(true)
    expect(isEmptyValue({ type: 'boolean' }, true)).toBe(false)
    expect(isEmptyValue({ type: 'list' }, [])).toBe(true)
    expect(isEmptyValue({ type: 'checklist' }, [{ text: 'a', checked: false }])).toBe(true)
    expect(isEmptyValue({ type: 'checklist' }, [{ text: 'a', checked: true }])).toBe(false)
  })
})

describe('buildDocPlan — autoNumber 连续（条件章节隐藏）', () => {
  test('隐藏 group 内的 heading 不占序号', () => {
    const docSchema = {
      layoutMode: 'custom',
      meta: { docTitle: '测试文书' },
      layout: {
        sections: [
          { type: 'heading', text: '背景', autoNumber: true },
          { type: 'heading', text: '目标', autoNumber: true },
          { type: 'heading', text: '范围', autoNumber: true },
          { type: 'heading', text: '汇报', autoNumber: true },
          { type: 'heading', text: '里程碑', autoNumber: true },
          // 隐藏的条件章节（含一个 heading）→ 不应占号
          {
            type: 'group',
            visibleWhen: { field: 'showExtra', op: 'eq', value: 'yes' },
            children: [{ type: 'heading', text: '（隐藏章）', autoNumber: true }],
          },
          { type: 'heading', text: '签批', autoNumber: true },
        ],
      },
    }
    const plan = buildDocPlan(docSchema, {}) // showExtra 为空 → group 隐藏
    const headings = plan.filter((n) => n.type === 'heading').map((n) => n.props.text)
    // 期望：一、二、三、四、五、六（隐藏章不占号，签批为「六、」而非「七、」）
    expect(headings).toEqual(['一、背景', '二、目标', '三、范围', '四、汇报', '五、里程碑', '六、签批'])
  })

  test('group 可见时其内 heading 正常占号', () => {
    const docSchema = {
      layoutMode: 'custom',
      meta: { docTitle: '测试文书' },
      layout: {
        sections: [
          { type: 'heading', text: '甲', autoNumber: true },
          {
            type: 'group',
            visibleWhen: { field: 'showExtra', op: 'eq', value: 'yes' },
            children: [{ type: 'heading', text: '乙', autoNumber: true }],
          },
          { type: 'heading', text: '丙', autoNumber: true },
        ],
      },
    }
    const plan = buildDocPlan(docSchema, { showExtra: 'yes' })
    const headings = plan.filter((n) => n.type === 'heading').map((n) => n.props.text)
    expect(headings).toEqual(['一、甲', '二、乙', '三、丙'])
  })
})
