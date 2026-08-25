/**
 * presetIntegration.test.js — 内置 preset × 引擎 集成回归测试。
 *
 * 定位：docPlan.test.js 测的是**引擎**（用手写的最小 docSchema）；
 *       本文件测的是**真实 preset 数据喂进引擎后的业务产出**，
 *       即「模板 3 / 7 / 8 上线前最后一道验收」。
 *
 * 覆盖五项（每项对应一条不可退让的业务红线或引擎边界）：
 *   §1 【业务红线】辞任信 hasDisagreement 强制明示（无默认值 + 条件分支真实生效）
 *   §2 【业务红线】同意函 idNumber 完整显示不遮蔽（防「好心人加脱敏」）
 *   §3 【引擎边界】autoNumber 在隐藏 group 下不跳号（#7 #8 真实结构）
 *   §4 【交叉校验】模板 3 objectList 四条规则 + {{$index1}} / {{$item.module}} 插值
 *   §5 【防回归】9 个 preset 签署格留白段不得退化（等价 verify:presets「空白格 0」）
 *
 * 运行环境：vitest node（无 jsdom）。preset 为 CommonJS，用 createRequire 加载。
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { buildDocPlan, validateSchemaData, BLANK } from './schemaUtils.js'

const requireCjs = createRequire(import.meta.url)
// client/src/schemaDoc → 上溯三级即仓库根
const { templatePresets } = requireCjs('../../../server/data/templatePresets.js')

/* =========================================================
 * 公共工具
 * ========================================================= */

/**
 * 按 presetKey 取 preset 定义（取不到即抛，避免用例静默空跑变成假绿灯）。
 * @param {string} key
 * @returns {object}
 */
function preset(key) {
  const found = templatePresets.find((p) => p && p.presetKey === key)
  if (!found) throw new Error(`preset 不存在：${key}`)
  return found
}

/**
 * 按 field.key 取字段定义。
 * @param {object} docSchema
 * @param {string} key
 * @returns {object|undefined}
 */
function field(docSchema, key) {
  return (docSchema.fields || []).find((f) => f && f.key === key)
}

/**
 * 深度遍历 PlanNode[]，收集所有**会被渲染出来**的字符串。
 * 覆盖 paragraph/heading/note 的 props.text、company 的 props.value、
 * props.runs[].text、infoTable props.rows[].runs[].text、
 * objectTable props.rows[].cells[].text、signBlock props.items[].runs[].text。
 * @param {Array} plan
 * @returns {string[]}
 */
function collectTexts(plan) {
  const out = []
  const pushRuns = (runs) => {
    if (!Array.isArray(runs)) return
    runs.forEach((r) => {
      if (r && typeof r.text === 'string') out.push(r.text)
    })
  }
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((n) => {
      if (!n) return
      const p = n.props || {}
      if (typeof p.text === 'string') out.push(p.text)
      if (typeof p.value === 'string') out.push(p.value)
      if (typeof p.note === 'string') out.push(p.note)
      pushRuns(p.runs)
      if (Array.isArray(p.rows)) {
        p.rows.forEach((row) => {
          if (!row) return
          if (typeof row.label === 'string') out.push(row.label)
          pushRuns(row.runs)
          if (Array.isArray(row.cells)) {
            row.cells.forEach((c) => {
              if (c && typeof c.text === 'string') out.push(c.text)
            })
          }
        })
      }
      if (Array.isArray(p.items)) {
        p.items.forEach((it) => {
          if (!it) return
          if (typeof it.label === 'string') out.push(it.label)
          if (typeof it.text === 'string') out.push(it.text)
          pushRuns(it.runs)
        })
      }
      walk(n.children)
    })
  }
  walk(plan)
  return out
}

/**
 * 收集全文（拼成一个串，便于 toContain 断言）。
 * @param {Array} plan
 * @returns {string}
 */
function fullText(plan) {
  return collectTexts(plan).join('\n')
}

/**
 * 取所有 heading 的最终文本（已含 autoNumber 前缀）。
 * @param {Array} plan
 * @returns {string[]}
 */
function headings(plan) {
  return plan.filter((n) => n.type === 'heading').map((n) => n.props.text)
}

/** 中文序号前缀期望序列（autoNumber 产出形如「一、xxx」）。 */
const CN_ORDER = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/**
 * 断言 heading 列表的序号连续无跳号（仅校验带「、」前缀的 autoNumber heading）。
 * @param {string[]} texts
 */
function expectContinuousNumbering(texts) {
  const numbered = texts.filter((t) => /^[一二三四五六七八九十]+、/.test(t))
  const prefixes = numbered.map((t) => t.slice(0, t.indexOf('、')))
  expect(prefixes).toEqual(CN_ORDER.slice(0, numbered.length))
}

/**
 * 收集计划中所有 signBlock 的 items（含 group 展开后的顶层与嵌套）。
 * @param {Array} plan
 * @returns {Array}
 */
function signItems(plan) {
  const out = []
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((n) => {
      if (!n) return
      if (n.type === 'signBlock' && Array.isArray(n.props.items)) out.push(...n.props.items)
      walk(n.children)
    })
  }
  walk(plan)
  return out
}

/* =========================================================
 * §1 【业务红线】辞任信 hasDisagreement 强制明示
 *
 * 业务依据：上市规则 13.51(2)。该声明原文进入港交所公告，
 * 预设 false 会以辞任董事名义自动生成「并无任何意见分歧」，属重大合规风险。
 * ========================================================= */
describe('§1 director-resignation · hasDisagreement 必须强制明示（上市规则 13.51(2)）', () => {
  const { docSchema } = preset('director-resignation')
  const fld = field(docSchema, 'hasDisagreement')

  /** 除 hasDisagreement 外均填妥的基准数据。 */
  const base = {
    companyName: '华瑞控股有限公司',
    stockCode: '01288',
    directorName: '陈志明',
    directorType: '独立非执行董事',
    effectiveDate: '2026-03-31',
  }

  it('字段存在且为 boolean 类型', () => {
    expect(fld).toBeTruthy()
    expect(fld.type).toBe('boolean')
  })

  it('🔴 字段不得带 default —— 有默认值即为合规缺陷', () => {
    // 断言 default 键根本不存在（不是「存在但为 undefined」），杜绝后续维护者「顺手补个 default: false」。
    expect(Object.prototype.hasOwnProperty.call(fld, 'default')).toBe(false)
    expect(fld.default).toBeUndefined()
  })

  it('🔴 未作选择时校验拦截，禁止导出', () => {
    const errors = validateSchemaData(docSchema, { ...base })
    expect(errors).toContain('请明确声明是否与董事会存在意见分歧 —— 该声明将原文进入港交所公告')
  })

  it('明示选择「否」时不再拦截（false 是合法值，不得被当成未填）', () => {
    const errors = validateSchemaData(docSchema, { ...base, hasDisagreement: false })
    expect(errors.some((e) => e.includes('请明确声明是否与董事会存在意见分歧'))).toBe(false)
  })

  it('选「是」但未填详情 → 拦截；填了详情 → 放行', () => {
    const missing = validateSchemaData(docSchema, { ...base, hasDisagreement: true })
    expect(missing).toContain(
      '已声明与董事会存在意见分歧，必须填写「意见分歧详情」—— 该内容须原文纳入港交所公告。',
    )
    const filled = validateSchemaData(docSchema, {
      ...base,
      hasDisagreement: true,
      disagreementDetail: '就收购代价之估值基础持不同意见。',
    })
    expect(filled.some((e) => e.includes('必须填写「意见分歧详情」'))).toBe(false)
  })

  it('🔴 条件显示真实生效：true / false / 未选 三态产出三种不同正文', () => {
    const NO_DISPUTE = '本人与本公司董事会并无任何意见分歧'
    const HAS_DISPUTE = '本人与本公司董事会存在意见分歧。有关分歧之详情如下：'
    const DETAIL = '就本公司拟收购目标公司之估值基础持不同意见。'

    const textFalse = fullText(buildDocPlan(docSchema, { ...base, hasDisagreement: false }))
    const textTrue = fullText(
      buildDocPlan(docSchema, { ...base, hasDisagreement: true, disagreementDetail: DETAIL }),
    )
    const textUnset = fullText(buildDocPlan(docSchema, { ...base }))

    // 选「否」→ 只出否定声明
    expect(textFalse).toContain(NO_DISPUTE)
    expect(textFalse).not.toContain(HAS_DISPUTE)

    // 选「是」→ 只出肯定声明 + 详情原文（系统不得改写或摘要）
    expect(textTrue).toContain(HAS_DISPUTE)
    expect(textTrue).toContain(DETAIL)
    expect(textTrue).not.toContain(NO_DISPUTE)

    // 未选 → 两个分支都不出，绝不能默默倒向任何一边
    expect(textUnset).not.toContain(NO_DISPUTE)
    expect(textUnset).not.toContain(HAS_DISPUTE)

    // 三态两两互不相同，证明条件显示不是摆设
    expect(textFalse).not.toBe(textTrue)
    expect(textUnset).not.toBe(textFalse)
    expect(textUnset).not.toBe(textTrue)
  })

  it('未选择时，13.51(2) 章节标题仍然存在（只是两个分支正文为空）', () => {
    const hs = headings(buildDocPlan(docSchema, { ...base }))
    expect(hs.some((h) => h.includes('上市规则第 13.51(2) 条声明'))).toBe(true)
  })
})

/* =========================================================
 * §2 【业务红线】同意函 idNumber 完整显示不遮蔽
 *
 * 业务依据：本函为递交香港公司注册处（Form ND2A 支持文件）及联交所之正式存档件，
 * 遮蔽版会被退件并拖延法定 15 日申报期。脱敏由文档流转环节处理，模板层不做。
 * ========================================================= */
describe('§2 director-consent-to-act · idNumber 完整显示、不得脱敏', () => {
  const { docSchema } = preset('director-consent-to-act')

  const ID = 'K123456(7)'
  const PASSPORT = 'EJ1234567890GBR'
  const base = {
    companyName: '华瑞控股有限公司',
    stockCode: '01288',
    appointeeName: '林嘉慧',
    appointeeNameEn: 'LAM Ka Wai, Karen',
    directorType: '独立非执行董事',
    effectiveDate: '2026-04-01',
    serviceAddress: '香港中环德辅道中 100 号华瑞商业大厦 28 楼 2805 室',
  }

  it('字段定义为必填 text，且不带任何 mask / format 遮蔽配置', () => {
    const fld = field(docSchema, 'idNumber')
    expect(fld).toBeTruthy()
    expect(fld.type).toBe('text')
    expect(fld.required).toBe(true)
    // 防「后来加脱敏」：任何 mask 类配置出现即视为回归
    expect(fld.mask).toBeUndefined()
    expect(fld.masked).toBeUndefined()
    expect(fld.format).toBeUndefined()
  })

  it('🔴 香港身份证号完整原样出现，且至少出现两处（资料表 + 正文声明）', () => {
    const texts = collectTexts(buildDocPlan(docSchema, { ...base, idNumber: ID }))
    const hits = texts.filter((t) => t === ID)
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('🔴 护照号（长号）同样完整，无截断、无省略号', () => {
    const texts = collectTexts(buildDocPlan(docSchema, { ...base, idNumber: PASSPORT }))
    expect(texts).toContain(PASSPORT)
    // 任何「沾了号码开头却不是完整号码」的串都说明发生了截断
    const partial = texts.filter((t) => t.includes('EJ1234') && !t.includes(PASSPORT))
    expect(partial).toEqual([])
    expect(texts.some((t) => t.includes('…') || t.includes('...'))).toBe(false)
  })

  it('🔴 渲染产物中不存在 * / X 遮蔽痕迹', () => {
    const texts = collectTexts(buildDocPlan(docSchema, { ...base, idNumber: ID }))
    const masked = texts.filter((t) => /\*{2,}/.test(t) || /[Xx]{4,}/.test(t) || /●{2,}/.test(t))
    expect(masked).toEqual([])
  })

  it('idNumber 未填时按引擎通用规则留白（BLANK），而非渲染成假号码', () => {
    const texts = collectTexts(buildDocPlan(docSchema, { ...base }))
    expect(texts).toContain(BLANK)
    expect(validateSchemaData(docSchema, { ...base })).toContain('「香港身份证／护照号码」为必填项。')
  })
})

/* =========================================================
 * §3 【引擎边界】autoNumber 在隐藏 group 下不跳号
 *
 * 规则：heading.autoNumber 在 visibleWhen 求值**之后**才自增计数器，
 * 被隐藏的 group 及其内部 heading 不占序号。
 * docPlan.test.js:248 已有通用守卫；此处针对 #7 #8 的真实结构再钉一遍。
 * ========================================================= */
describe('§3 autoNumber 在隐藏 group 下不跳号（#7 / #8 真实结构）', () => {
  describe('#8 director-consent-to-act —— 独立性确认整节随 directorType 显隐', () => {
    const { docSchema } = preset('director-consent-to-act')
    const base = {
      companyName: '华瑞控股有限公司',
      appointeeName: '林嘉慧',
      idNumber: 'K123456(7)',
      effectiveDate: '2026-04-01',
    }
    const INED_HEADING = '三、独立性确认（仅适用于独立非执行董事）'

    it('INED → 六章，第三章为「独立性确认」', () => {
      const hs = headings(buildDocPlan(docSchema, { ...base, directorType: '独立非执行董事' }))
      expect(hs).toEqual([
        '一、同意出任',
        '二、资格确认',
        INED_HEADING,
        '四、其他上市公司董事职务',
        '五、承诺及持续责任',
        '六、个人资料之收集、使用及披露',
      ])
      expectContinuousNumbering(hs)
    })

    it('🔴 非 INED（执行董事）→ 整节隐藏，后续章节递补为「三、」而非跳到「四、」', () => {
      const hs = headings(buildDocPlan(docSchema, { ...base, directorType: '执行董事' }))
      expect(hs).toEqual([
        '一、同意出任',
        '二、资格确认',
        '三、其他上市公司董事职务',
        '四、承诺及持续责任',
        '五、个人资料之收集、使用及披露',
      ])
      expectContinuousNumbering(hs)
      expect(hs.some((h) => h.includes('独立性确认'))).toBe(false)
    })

    it('directorType 完全未填 → 同样按隐藏处理，五章连续', () => {
      const hs = headings(buildDocPlan(docSchema, { ...base }))
      expect(hs).toHaveLength(5)
      expectContinuousNumbering(hs)
    })

    it('隐藏 group 内部的正文亦一并消失（不是只藏标题）', () => {
      const inedText = fullText(buildDocPlan(docSchema, { ...base, directorType: '独立非执行董事' }))
      const edText = fullText(buildDocPlan(docSchema, { ...base, directorType: '执行董事' }))
      expect(inedText).toContain('独立性确认')
      expect(edText).not.toContain('独立性确认')
      expect(edText.length).toBeLessThan(inedText.length)
    })
  })

  describe('#7 director-resignation —— 分歧 / 垂注事项双 group 显隐', () => {
    const { docSchema } = preset('director-resignation')
    const base = {
      companyName: '华瑞控股有限公司',
      directorName: '陈志明',
      directorType: '独立非执行董事',
      effectiveDate: '2026-03-31',
    }
    const EXPECTED = [
      '一、辞任声明',
      '二、随同辞去之委员会及其他职务',
      '三、上市规则第 13.51(2) 条声明',
      '四、交还公司财产及持续责任',
      '五、申索及致意',
    ]

    it.each([
      ['全部 group 隐藏（未选分歧、无垂注事项、无委员会职务）', {}],
      ['分歧 group 显示', { hasDisagreement: true, disagreementDetail: '估值基础分歧。' }],
      ['垂注事项 group 显示', { shareholderMatter: '请留意收购估值假设。' }],
      [
        '两个 group 同时显示 + 委员会职务',
        {
          hasDisagreement: true,
          disagreementDetail: '估值基础分歧。',
          shareholderMatter: '请留意收购估值假设。',
          committeeRoles: [{ text: '审核委员会主席', checked: true }],
        },
      ],
    ])('%s → 五章序号恒为 一~五', (_label, extra) => {
      const hs = headings(buildDocPlan(docSchema, { ...base, ...extra }))
      expect(hs).toEqual(EXPECTED)
      expectContinuousNumbering(hs)
    })
  })
})

/* =========================================================
 * §4 【交叉校验】department-self-assessment 的 objectList 四条规则
 *
 * 重点：{{$index1}} / {{$item.module}} 必须被替换成实际值，
 * 而不是把模板串原样吐给用户（此类插值 bug 极常见）。
 * ========================================================= */
describe('§4 department-self-assessment · assessmentItems 四条交叉校验', () => {
  const { docSchema } = preset('department-self-assessment')

  /**
   * 构造一条自评条目（默认「完全合格」，按需覆写以触发单条规则）。
   * @param {object} [over]
   * @returns {object}
   */
  const item = (over = {}) => ({
    module: '财务汇报',
    evidenceRequired: true,
    effective: 'Y',
    evidence: 'FIN-2025-Q4-001',
    note: '',
    ...over,
  })

  /**
   * 只取自评模块相关错误，隔离其他字段的必填噪音。
   * @param {Array} items
   * @returns {string[]}
   */
  const itemErrors = (items) =>
    validateSchemaData(docSchema, { assessmentItems: items }).filter((e) => e.startsWith('自评模块'))

  it('基准：条目全部合格 → 无自评模块类错误', () => {
    expect(itemErrors([item(), item({ module: '营运管理', evidence: 'OPS-1' })])).toEqual([])
  })

  it('规则①未填模块名 —— {{$index1}} 必须替换为真实序号（1-based）', () => {
    // 故意放在第 3 位，若插值实现写成 $index 会得到「第 2 项」
    const errors = itemErrors([item(), item(), item({ module: '' }), item()])
    expect(errors).toContain('自评模块第 3 项尚未填写模块名称。')
    expect(errors).toHaveLength(1)
  })

  it('规则②未选有效性 —— {{$item.module}} 必须替换为真实模块名', () => {
    const errors = itemErrors([item({ module: '资讯科技', effective: '' })])
    expect(errors).toContain('自评模块「资讯科技」尚未选择是否有效。')
    expect(errors).toHaveLength(1)
  })

  it('规则③选 N 未填说明 → 拦截；补上说明 → 放行', () => {
    const hit = itemErrors([item({ module: '资讯科技', effective: 'N', evidence: 'IT-012' })])
    expect(hit).toContain('自评模块「资讯科技」选择 N，必须填写说明及整改安排。')
    expect(hit).toHaveLength(1)

    const pass = itemErrors([
      item({
        module: '资讯科技',
        effective: 'N',
        evidence: 'IT-012',
        note: 'ERP 离职账号未及时停用，已于 2026Q1 上线自动停用流程。',
      }),
    ])
    expect(pass).toEqual([])
  })

  it('规则④证据索引必填 → 拦截', () => {
    const errors = itemErrors([item({ module: '人力资源', evidence: '' })])
    expect(errors).toContain('自评模块「人力资源」须填写证据索引。')
    expect(errors).toHaveLength(1)
  })

  it('规则④豁免：effective = N/A 或 evidenceRequired = false 时不要求证据索引', () => {
    expect(itemErrors([item({ module: '合规管理', effective: 'N/A', evidence: '' })])).toEqual([])
    expect(
      itemErrors([item({ module: '其他事项', evidenceRequired: false, evidence: '' })]),
    ).toEqual([])
  })

  it('规则④边界：未选有效性时不追加证据索引错误（避免同一格报两条）', () => {
    const errors = itemErrors([item({ module: '资讯科技', effective: '', evidence: '' })])
    expect(errors).toEqual(['自评模块「资讯科技」尚未选择是否有效。'])
  })

  it('多条目多规则并发：逐项独立求值，序号与模块名一一对应', () => {
    const errors = itemErrors([
      item({ module: '财务汇报' }), // 合格
      item({ module: '', effective: 'Y', evidence: 'X-1' }), // ① 第 2 项
      item({ module: '资讯科技', effective: 'N', evidence: 'IT-1' }), // ③
      item({ module: '人力资源', effective: 'Y', evidence: '' }), // ④
    ])
    expect(errors).toEqual(
      expect.arrayContaining([
        '自评模块第 2 项尚未填写模块名称。',
        '自评模块「资讯科技」选择 N，必须填写说明及整改安排。',
        '自评模块「人力资源」须填写证据索引。',
      ]),
    )
    expect(errors).toHaveLength(3)
  })

  it('🔴 插值守卫：任何错误信息都不得残留 {{ }} 模板串', () => {
    const errors = itemErrors([
      item({ module: '', effective: '' }),
      item({ module: '资讯科技', effective: 'N', evidence: 'IT-1' }),
      item({ module: '人力资源', evidence: '' }),
    ])
    expect(errors.length).toBeGreaterThan(0)
    errors.forEach((e) => {
      expect(e).not.toContain('{{')
      expect(e).not.toContain('}}')
      expect(e).not.toContain('$index')
      expect(e).not.toContain('$item')
    })
  })

  it('assessmentItems 缺失 / 非数组时不抛异常（引擎健壮性）', () => {
    expect(() => validateSchemaData(docSchema, {})).not.toThrow()
    expect(() => validateSchemaData(docSchema, { assessmentItems: null })).not.toThrow()
    expect(itemErrors([])).toEqual([])
  })

  it('objectTable 渲染：五个预置模块逐行落到 props.rows，序号列 1..N', () => {
    const items = [
      item({ module: '财务汇报' }),
      item({ module: '营运管理', evidence: 'OPS-1' }),
      item({ module: '合规管理', evidence: 'CMP-1' }),
    ]
    const table = buildDocPlan(docSchema, { assessmentItems: items }).find(
      (n) => n.type === 'objectTable',
    )
    expect(table).toBeTruthy()
    expect(table.props.rows).toHaveLength(3)
    const moduleTexts = table.props.rows.map((r) => r.cells.map((c) => c.text).join('|'))
    expect(moduleTexts[0]).toContain('财务汇报')
    expect(moduleTexts[2]).toContain('合规管理')
  })
})

/* =========================================================
 * §5 【防回归】8 个 preset 签署格留白不得退化
 *
 * 历史缺陷：resolveSegments 分支顺序为 join → var → text → blank，
 * text 分支以 `typeof seg.text === 'string'` 判定，**空串也命中并 return**，
 * 故 `{ text: '', blank: BLANK }` 会渲染成「空白无下划线」；
 * 而 `[{}] / []` 则被静默丢弃，产出 0 个 run（纸面上就是一格空白）。
 * 该缺陷曾令 5 处签署格全部失效。
 *
 * 本组用例把 verify:presets 的「空白格 0」固化进 npm test，
 * 不再依赖单独跑验收脚本。
 * ========================================================= */
describe('§5 9 个 preset · 签署格留白防回归（等价 verify:presets「空白格 0」）', () => {
  /** 每个 preset 的签署格数量基线（合计 45，与 verify:presets 对齐）。 */
  const SIGN_CELL_BASELINE = {
    'director-confirmation': 4,
    'du004g-undertaking': 4,
    'department-self-assessment': 4,
    'internal-control-report': 4,
    'board-resolution': 4,
    'project-charter': 4,
    'director-resignation': 7,
    'director-consent-to-act': 11,
    'director-code-compliance-confirmation': 3,
  }

  it('聚合器导出 9 个 preset，presetKey 唯一', () => {
    expect(templatePresets).toHaveLength(9)
    const keys = templatePresets.map((p) => p.presetKey)
    expect(new Set(keys).size).toBe(9)
    expect(keys.sort()).toEqual(Object.keys(SIGN_CELL_BASELINE).sort())
  })

  it('9 个 preset 全部 layoutMode: custom（否则 layout.sections 被静默忽略）', () => {
    templatePresets.forEach((p) => {
      expect(p.docSchema.layoutMode, `${p.presetKey} 的 layoutMode`).toBe('custom')
      expect(Array.isArray(p.docSchema.layout?.sections), `${p.presetKey} 缺 layout.sections`).toBe(
        true,
      )
    })
  })

  // 空数据是最坏情况：所有 var 落空，全部走留白分支。
  it.each(templatePresets.map((p) => [p.presetKey, p]))(
    '%s · 空数据渲染：签署格数量达标，且无「空文字且非 blank」的 run',
    (key, p) => {
      const items = signItems(buildDocPlan(p.docSchema, {}))
      expect(items.length).toBe(SIGN_CELL_BASELINE[key])
      items.forEach((it, i) => {
        // 缺陷形态 A：整格 0 个 run（value 写成 [{}] / [] / 省略）→ 纸面空白
        expect(it.runs, `${key} 第 ${i + 1} 格「${it.label}」runs 为空`).toBeTruthy()
        expect(it.runs.length, `${key} 第 ${i + 1} 格「${it.label}」产出 0 个 run`).toBeGreaterThan(0)
        // 缺陷形态 B：run 文字为空却未标记 blank → 纸面空白无下划线
        it.runs.forEach((r) => {
          const empty = typeof r.text !== 'string' || r.text.trim() === ''
          expect(
            empty && r.blank !== true,
            `${key} 第 ${i + 1} 格「${it.label}」出现空白无下划线的 run`,
          ).toBe(false)
        })
      })
    },
  )

  it.each(templatePresets.map((p) => [p.presetKey, p]))(
    '%s · sampleData 渲染：同样无空白格',
    (key, p) => {
      const items = signItems(buildDocPlan(p.docSchema, p.sampleData || {}))
      expect(items.length).toBe(SIGN_CELL_BASELINE[key])
      items.forEach((it) => {
        expect(it.runs.length).toBeGreaterThan(0)
        it.runs.forEach((r) => {
          const empty = typeof r.text !== 'string' || r.text.trim() === ''
          expect(empty && r.blank !== true).toBe(false)
        })
      })
    },
  )

  it('全仓签署格合计 45 格（与 verify:presets 基线一致）', () => {
    const total = templatePresets.reduce(
      (n, p) => n + signItems(buildDocPlan(p.docSchema, {})).length,
      0,
    )
    expect(total).toBe(45)
  })

  it('纯手签格留白长度为引擎默认 BLANK（8 个全角下划线），无手抄下划线字面量', () => {
    // 取 #8 见证人栏：四格全部纯手签，是 { blank: true } 的密集使用点
    const items = signItems(buildDocPlan(preset('director-consent-to-act').docSchema, {}))
    const witness = items.filter((it) => it.label.startsWith('见证人'))
    expect(witness.length).toBeGreaterThanOrEqual(3)
    witness.forEach((it) => {
      expect(it.runs).toHaveLength(1)
      expect(it.runs[0].text).toBe(BLANK)
      expect(it.runs[0].text).toHaveLength(8)
      expect(it.runs[0].blank).toBe(true)
    })
  })

  it('9 个 preset 的 sampleData 均应通过自身校验（对拍基准必须自洽）', () => {
    templatePresets.forEach((p) => {
      const errors = validateSchemaData(p.docSchema, p.sampleData || {})
      expect(errors, `${p.presetKey} 的 sampleData 未通过校验：${errors.join(' / ')}`).toEqual([])
    })
  })
})
