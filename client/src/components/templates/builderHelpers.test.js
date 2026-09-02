import { describe, test, expect } from 'vitest'
import { buildDocPlan, createSampleData } from '../../schemaDoc/schemaUtils'
import { TEMPLATE_CATEGORY_VALUES } from '../../constants/templateCategories'
import {
  BUILDER_FIELD_TYPES,
  CATEGORY_VALUES,
  FIELD_KEY_PATTERN,
  buildDocSchema,
  createBlankColumn,
  createBlankField,
  getFieldTypeLabel,
  moveField,
  parseLinesText,
  parseOptionsText,
  renameFieldKey,
  stringifyLines,
  stringifyOptions,
  validateDraft,
} from './builderHelpers'

/**
 * builderHelpers.test.js — 模板编辑器纯函数层单测（node 环境，无需 jsdom）。
 */

/** 构造一个最小可用的合法草稿。 */
function validDraft() {
  return {
    meta: { name: '董事会决议', category: 'board_resolution' },
    fields: [
      { key: 'companyName', label: '公司名称', type: 'text' },
      { key: 'meetingDate', label: '会议日期', type: 'date' },
    ],
  }
}

describe('BUILDER_FIELD_TYPES / CATEGORY_VALUES', () => {
  test('恰好开放 9 类字段，且值唯一', () => {
    expect(BUILDER_FIELD_TYPES).toHaveLength(9)
    const values = BUILDER_FIELD_TYPES.map((t) => t.value)
    expect(new Set(values).size).toBe(9)
    expect(values).toEqual([
      'text', 'textarea', 'date', 'select', 'boolean',
      'list', 'clauses', 'checklist', 'objectList',
    ])
  })

  test('分类值域与 templateCategories.js 单一真源完全一致（13 项）', () => {
    expect(CATEGORY_VALUES).toEqual(TEMPLATE_CATEGORY_VALUES)
    expect(CATEGORY_VALUES).toHaveLength(13)
  })

  test('getFieldTypeLabel 已知类型返回中文，未知类型原样返回', () => {
    expect(getFieldTypeLabel('objectList')).toBe('对象表格')
    expect(getFieldTypeLabel('unknownType')).toBe('unknownType')
  })
})

describe('createBlankField', () => {
  test('自动分配不与现有 key 冲突的 key', () => {
    expect(createBlankField('text', []).key).toBe('field1')
    expect(createBlankField('text', ['field1']).key).toBe('field2')
    expect(createBlankField('text', ['field1', 'field2']).key).toBe('field3')
  })

  test('已占用的自动 key 会继续递增直到不冲突', () => {
    const field = createBlankField('text', ['field1', 'field3'])
    expect(['field1', 'field3']).not.toContain(field.key)
    expect(FIELD_KEY_PATTERN.test(field.key)).toBe(true)
  })

  test('不同类型补齐各自必需的属性', () => {
    expect(createBlankField('select', []).options.length).toBeGreaterThan(0)
    expect(createBlankField('boolean', []).checkboxLabel).toBeTruthy()
    expect(createBlankField('checklist', []).items).toEqual([])
    expect(createBlankField('objectList', []).columns).toHaveLength(1)
    expect(createBlankField('list', []).default).toEqual([])
  })

  test('不支持的类型回落到 text', () => {
    expect(createBlankField('richtext', []).type).toBe('text')
  })
})

describe('createBlankColumn', () => {
  test('列 key 自动去重', () => {
    expect(createBlankColumn([]).key).toBe('col1')
    expect(createBlankColumn(['col1']).key).toBe('col2')
  })
})

describe('renameFieldKey', () => {
  const fields = [
    { key: 'a', label: 'A', type: 'text' },
    { key: 'b', label: 'B', type: 'text' },
  ]

  test('合法改名成功且不修改原数组', () => {
    const { fields: next, error } = renameFieldKey(fields, 0, 'companyName')
    expect(error).toBe('')
    expect(next[0].key).toBe('companyName')
    expect(next[1].key).toBe('b')
    expect(fields[0].key).toBe('a')
  })

  test('重复 key 被拦截并原样返回', () => {
    const { fields: next, error } = renameFieldKey(fields, 0, 'b')
    expect(error).toContain('已被其它字段占用')
    expect(next).toBe(fields)
  })

  test('非法 key（数字开头 / 含连字符 / 空）被拦截', () => {
    expect(renameFieldKey(fields, 0, '1abc').error).toContain('非法')
    expect(renameFieldKey(fields, 0, 'a-b').error).toContain('非法')
    expect(renameFieldKey(fields, 0, '   ').error).toBe('字段 key 不能为空')
  })

  test('改成自己原来的 key 不算重复', () => {
    expect(renameFieldKey(fields, 0, 'a').error).toBe('')
  })

  test('下标越界返回错误', () => {
    expect(renameFieldKey(fields, 9, 'x').error).toBe('字段不存在')
  })
})

describe('moveField', () => {
  const fields = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]

  test('后移：0 → 2', () => {
    expect(moveField(fields, 0, 2).map((f) => f.key)).toEqual(['b', 'c', 'a'])
  })

  test('前移：2 → 0', () => {
    expect(moveField(fields, 2, 0).map((f) => f.key)).toEqual(['c', 'a', 'b'])
  })

  test('目标越界时夹紧到边界，原数组不被修改', () => {
    expect(moveField(fields, 0, 99).map((f) => f.key)).toEqual(['b', 'c', 'a'])
    expect(moveField(fields, 2, -5).map((f) => f.key)).toEqual(['c', 'a', 'b'])
    expect(fields.map((f) => f.key)).toEqual(['a', 'b', 'c'])
  })

  test('源越界或原地不动时返回等值数组', () => {
    expect(moveField(fields, -1, 1).map((f) => f.key)).toEqual(['a', 'b', 'c'])
    expect(moveField(fields, 1, 1).map((f) => f.key)).toEqual(['a', 'b', 'c'])
  })
})

describe('buildDocSchema', () => {
  test('产物形状正确，layoutMode 恒为 auto', () => {
    const { meta, fields } = validDraft()
    const schema = buildDocSchema({ ...meta, docTitle: '董事会决议' }, fields)
    expect(schema.schemaVersion).toBe(1)
    expect(schema.layoutMode).toBe('auto')
    expect(schema.rules).toEqual([])
    expect(schema.layout).toEqual({ sections: [] })
    expect(schema.meta.docTitle).toBe('董事会决议')
    expect(schema.meta.headerMeta).toEqual([])
    expect(schema.fields).toHaveLength(2)
  })

  test('docTitle 缺省时回退到模板名', () => {
    const schema = buildDocSchema({ name: '年度申报表' }, [])
    expect(schema.meta.docTitle).toBe('年度申报表')
  })

  test('fields 做深拷贝，改动产物不会污染入参', () => {
    const { meta, fields } = validDraft()
    const schema = buildDocSchema(meta, fields)
    schema.fields[0].label = '被改了'
    expect(fields[0].label).toBe('公司名称')
  })
})

describe('validateDraft', () => {
  test('完全合法的草稿返回空数组', () => {
    const { meta, fields } = validDraft()
    expect(validateDraft(meta, fields)).toEqual([])
  })

  test('模板名必填', () => {
    const { fields } = validDraft()
    const errors = validateDraft({ name: '  ', category: 'minutes' }, fields)
    expect(errors).toContain('模板名称必填')
  })

  test('分类必须落在 12 项白名单内', () => {
    const { fields } = validDraft()
    expect(validateDraft({ name: 'x', category: '' }, fields)).toContain('请选择模板分类')
    const errors = validateDraft({ name: 'x', category: 'not_a_category' }, fields)
    expect(errors.some((e) => e.includes('不在允许的分类范围内'))).toBe(true)
  })

  test('至少需要 1 个字段', () => {
    const { meta } = validDraft()
    expect(validateDraft(meta, [])).toContain('至少需要 1 个字段')
  })

  test('key 重复与非法都会报错', () => {
    const { meta } = validDraft()
    const dup = validateDraft(meta, [
      { key: 'a', label: 'A', type: 'text' },
      { key: 'a', label: 'B', type: 'text' },
    ])
    expect(dup.some((e) => e.includes('重复'))).toBe(true)

    const bad = validateDraft(meta, [{ key: '2bad', label: 'A', type: 'text' }])
    expect(bad.some((e) => e.includes('非法'))).toBe(true)
  })

  test('select 必须至少 1 个选项', () => {
    const { meta } = validDraft()
    const errors = validateDraft(meta, [{ key: 'vote', label: '表决', type: 'select', options: [] }])
    expect(errors.some((e) => e.includes('至少需要配置 1 个选项'))).toBe(true)
  })

  test('objectList 必须至少 1 列', () => {
    const { meta } = validDraft()
    const errors = validateDraft(meta, [{ key: 'rows', label: '明细', type: 'objectList', columns: [] }])
    expect(errors.some((e) => e.includes('至少需要配置 1 列'))).toBe(true)
  })

  test('字段名称必填、字段类型必须受支持', () => {
    const { meta } = validDraft()
    const errors = validateDraft(meta, [{ key: 'a', label: '', type: 'richtext' }])
    expect(errors.some((e) => e.includes('字段名称必填'))).toBe(true)
    expect(errors.some((e) => e.includes('不支持的字段类型'))).toBe(true)
  })
})

describe('parseOptionsText / stringifyOptions', () => {
  test('每行一项，支持 value|label 形式', () => {
    expect(parseOptionsText('yes|同意\nno|反对')).toEqual([
      { value: 'yes', label: '同意' },
      { value: 'no', label: '反对' },
    ])
  })

  test('无分隔符时 value 与 label 相同，空行被忽略', () => {
    expect(parseOptionsText('甲\n\n  乙  \n')).toEqual([
      { value: '甲', label: '甲' },
      { value: '乙', label: '乙' },
    ])
  })

  test('stringifyOptions 与 parseOptionsText 互为逆运算', () => {
    const text = 'yes|同意\nno|反对\n弃权'
    expect(stringifyOptions(parseOptionsText(text))).toBe(text)
  })

  test('stringifyOptions 兼容字符串数组与非法项', () => {
    expect(stringifyOptions(['甲', { value: 'b', label: 'b' }, null])).toBe('甲\nb')
    expect(stringifyOptions('not-an-array')).toBe('')
  })
})

describe('parseLinesText / stringifyLines', () => {
  test('多行文本与条目数组互转，兼容 {text} / {label} 形状', () => {
    expect(parseLinesText('第一条\n\n 第二条 ')).toEqual(['第一条', '第二条'])
    expect(stringifyLines([{ text: '甲' }, { label: '乙' }, '丙'])).toBe('甲\n乙\n丙')
  })
})

describe('与 schemaUtils 的集成', () => {
  test('buildDocSchema 的产物能被 buildDocPlan 正常编译成非空计划树', () => {
    const fields = [
      { key: 'companyName', label: '公司名称', type: 'text' },
      { key: 'meetingDate', label: '会议日期', type: 'date' },
      { key: 'writtenResolution', label: '书面决议', type: 'boolean', checkboxLabel: '本决议以书面方式通过' },
      { key: 'resolutions', label: '决议条款', type: 'clauses' },
      { key: 'remark', label: '备注', type: 'textarea' },
      {
        key: 'directors',
        label: '董事名单',
        type: 'objectList',
        columns: [
          { key: 'name', label: '姓名', type: 'text' },
          { key: 'appointedAt', label: '委任日期', type: 'date' },
        ],
      },
    ]
    const schema = buildDocSchema({ name: '董事会决议', category: 'board_resolution' }, fields)
    const data = createSampleData(schema, {})
    const plan = buildDocPlan(schema, data)

    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })

  test('objectList 的 columns 能被 auto 布局识别（契约冲突回归）', () => {
    const fields = [{
      key: 'directors',
      label: '董事名单',
      type: 'objectList',
      columns: [
        { key: 'name', label: '姓名', type: 'text' },
        { key: 'appointedAt', label: '委任日期', type: 'date' },
      ],
    }]
    const schema = buildDocSchema({ name: '名册', category: 'other' }, fields)
    const plan = buildDocPlan(schema, createSampleData(schema, {}))
    const flat = JSON.stringify(plan)

    expect(flat).toContain('姓名')
    expect(flat).toContain('委任日期')
  })
})
