// docSchema 契约校验测试（node:test 风格）。
//
// 覆盖重点：字段级「未支持关键字」拦截。requiredWhen 长得像生效的条件必填声明，
// 但引擎从不读取它 —— 若放任写入，维护者会得到「以为设了条件必填、实际零校验」
// 的静默失效。这类模板是要递交港交所与公司注册处的正式文件，故在写入闸门直接拒绝。
//
// ⚠️ 本文件走 node:test（server/** 已被根 vitest.config.js 的 exclude 排除），
//    不要改成 vitest 的 describe/it 写法。
const test = require('node:test')
const assert = require('node:assert')

const {
  UNSUPPORTED_FIELD_KEYS,
  SchemaValidationError,
  assertValidDocSchema,
} = require('../constants/templateSchema')
const { getPresets } = require('../data/templatePresets')

/**
 * 构造一个最小合法 docSchema，并允许对首个字段做局部覆盖。
 * @param {Object} [fieldOverrides={}] 合并进首个字段的额外键值
 * @returns {Object} 可直接喂给 assertValidDocSchema 的 docSchema
 */
function makeDocSchema(fieldOverrides = {}) {
  return {
    layoutMode: 'auto',
    fields: [
      {
        key: 'hasDisagreement',
        label: '是否存在意见分歧',
        type: 'boolean',
        source: 'manual',
      },
      Object.assign(
        {
          key: 'disagreementDetail',
          label: '意见分歧详情',
          type: 'textarea',
          source: 'manual',
          visibleWhen: { op: 'eq', field: 'hasDisagreement', value: true },
        },
        fieldOverrides
      ),
    ],
    rules: [],
  }
}

test('templateSchema: UNSUPPORTED_FIELD_KEYS 已导出且包含 requiredWhen', () => {
  assert.ok(Array.isArray(UNSUPPORTED_FIELD_KEYS))
  assert.ok(UNSUPPORTED_FIELD_KEYS.includes('requiredWhen'))
  assert.ok(Object.isFrozen(UNSUPPORTED_FIELD_KEYS))
})

test('templateSchema: 字段带 requiredWhen 时 assertValidDocSchema 抛错并指引 rules', () => {
  const docSchema = makeDocSchema({
    requiredWhen: { op: 'eq', field: 'hasDisagreement', value: true },
  })

  assert.throws(
    () => assertValidDocSchema(docSchema),
    (err) => {
      assert.ok(err instanceof SchemaValidationError, '应抛 SchemaValidationError')
      assert.strictEqual(err.statusCode, 400)
      assert.ok(err.message.includes('requiredWhen'), '错误信息须点名 requiredWhen')
      assert.ok(err.message.includes('rules'), '错误信息须指引改用 rules')
      assert.ok(err.message.includes('fields[1]'), '错误信息须定位到具体字段下标')
      return true
    }
  )
})

test('templateSchema: 未支持关键字取值为 null 同样拦截（不止 truthy 判定）', () => {
  const docSchema = makeDocSchema({ requiredWhen: null })
  assert.throws(() => assertValidDocSchema(docSchema), SchemaValidationError)
})

test('templateSchema: 字段不带 requiredWhen 时正常通过', () => {
  const docSchema = makeDocSchema()
  assert.doesNotThrow(() => assertValidDocSchema(docSchema))
  assert.strictEqual(assertValidDocSchema(docSchema), docSchema)
})

test('templateSchema: 条件必填改用 docSchema.rules 表达时正常通过', () => {
  const docSchema = makeDocSchema()
  docSchema.rules = [
    {
      id: 'dr-disagreement-detail-required',
      scope: 'form',
      message: '存在意见分歧时，必须填写「意见分歧详情」。',
      when: {
        all: [
          { op: 'eq', field: 'hasDisagreement', value: true },
          { op: 'falsy', field: 'disagreementDetail' },
        ],
      },
    },
  ]
  assert.doesNotThrow(() => assertValidDocSchema(docSchema))
})

test('templateSchema: 9 个内置 preset 的 docSchema 全部通过校验', () => {
  const presets = getPresets()
  assert.strictEqual(presets.length, 9, 'preset 总数应为 9')

  presets.forEach((preset, index) => {
    assert.doesNotThrow(
      () => assertValidDocSchema(preset.docSchema),
      `preset[${index}]「${preset.name || preset.presetKey || '未命名'}」docSchema 校验不通过`
    )
  })
})
