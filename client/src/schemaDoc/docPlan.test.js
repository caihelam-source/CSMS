/**
 * docPlan.test.js — DOC_CLASS 注册表守卫 + buildDocPlan 计划树断言。
 *
 * ⚠️ 设计 §2.4 / §7.6：DOC_CLASS 中的每个 class 都是 docxFromDom.js 的导出锚点，
 *    "顺手"重命名会静默破坏 Word 导出。本测试逐项断言类名未变（R-P1-5）。
 *
 * 运行环境：vitest node（无 jsdom）；不依赖任何 DOM。
 */
import { test, expect, describe } from 'vitest'
import { DOC_CLASS, buildDocPlan, BLANK } from './schemaUtils.js'

// 设计 §7.6 定义、且 §T02 验收点 5 明确列举的 class 名集合（共 26 个）。
const EXPECTED_CLASSES = [
  'doc',
  'doc-page',
  'doc-company',
  'doc-title',
  'doc-subtitle',
  'doc-rule',
  'doc-meta',
  'doc-p',
  'doc-p-flat',
  'doc-h2',
  'doc-label',
  'doc-blank',
  'doc-quote',
  'doc-table',
  'doc-th-key',
  'doc-center',
  'doc-list',
  'doc-box',
  'doc-ol',
  'doc-sign',
  'doc-sign-grid',
  'doc-sign-row',
  'doc-sign-label',
  'doc-line',
  'doc-note',
  'doc-empty',
]

describe('DOC_CLASS 注册表（docx 导出锚点守卫）', () => {
  test('26 个 key 与 26 个 class 名逐一对应，无重复', () => {
    const keys = Object.keys(DOC_CLASS)
    expect(keys).toHaveLength(26)
    const values = Object.values(DOC_CLASS)
    expect(new Set(values).size).toBe(26) // 无重复
  })

  test('导出的 class 名集合与预期完全一致（顺序无关）', () => {
    const sortedActual = [...Object.values(DOC_CLASS)].sort()
    const sortedExpected = [...EXPECTED_CLASSES].sort()
    expect(sortedActual).toEqual(sortedExpected)
  })

  test('每个命名 key 映射到正确 class（防重命名）', () => {
    expect(DOC_CLASS.page).toBe('doc-page')
    expect(DOC_CLASS.root).toBe('doc')
    expect(DOC_CLASS.company).toBe('doc-company')
    expect(DOC_CLASS.title).toBe('doc-title')
    expect(DOC_CLASS.subtitle).toBe('doc-subtitle')
    expect(DOC_CLASS.rule).toBe('doc-rule')
    expect(DOC_CLASS.meta).toBe('doc-meta')
    expect(DOC_CLASS.p).toBe('doc-p')
    expect(DOC_CLASS.pFlat).toBe('doc-p-flat')
    expect(DOC_CLASS.h2).toBe('doc-h2')
    expect(DOC_CLASS.label).toBe('doc-label')
    expect(DOC_CLASS.blank).toBe('doc-blank')
    expect(DOC_CLASS.quote).toBe('doc-quote')
    expect(DOC_CLASS.table).toBe('doc-table')
    expect(DOC_CLASS.thKey).toBe('doc-th-key')
    expect(DOC_CLASS.center).toBe('doc-center')
    expect(DOC_CLASS.list).toBe('doc-list')
    expect(DOC_CLASS.box).toBe('doc-box')
    expect(DOC_CLASS.ol).toBe('doc-ol')
    expect(DOC_CLASS.sign).toBe('doc-sign')
    expect(DOC_CLASS.signGrid).toBe('doc-sign-grid')
    expect(DOC_CLASS.signRow).toBe('doc-sign-row')
    expect(DOC_CLASS.signLabel).toBe('doc-sign-label')
    expect(DOC_CLASS.line).toBe('doc-line')
    expect(DOC_CLASS.note).toBe('doc-note')
    expect(DOC_CLASS.empty).toBe('doc-empty')
  })
})

describe('buildDocPlan — 10 类区块全覆盖，className 全部来自 DOC_CLASS', () => {
  const docSchema = {
    layoutMode: 'custom',
    meta: {
      docTitle: '测 试 文 书',
      docSubtitle: 'TEST DOCUMENT',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '编号：' }, { var: 'stockCode', blank: '＿＿＿＿' }],
        right: [{ text: '日期：' }, { var: 'letterDate', format: 'date' }],
      },
      archiveNote: '存档说明：保存期不少于七年。',
    },
    fields: [
      { key: 'companyName', type: 'text' },
      { key: 'stockCode', type: 'text' },
      { key: 'letterDate', type: 'date' },
      { key: 'confirmations', type: 'checklist' },
      { key: 'independentReview', type: 'boolean' },
      { key: 'scope', type: 'clauses' },
      { key: 'assessmentItems', type: 'objectList' },
      { key: 'representative', type: 'text' },
    ],
    layout: {
      sections: [
        { type: 'heading', text: '一、背景', autoNumber: false },
        { type: 'paragraph', segments: [{ text: '本人 ' }, { var: 'companyName', blank: '＿＿＿＿' }, { text: '，现任本公司。' }, { var: 'representative' }] },
        {
          type: 'infoTable',
          rows: [
            { label: '公司名称', value: [{ var: 'companyName', blank: '＿＿＿＿' }] },
            { label: '股份代号', value: [{ var: 'stockCode', blank: '＿＿＿＿' }] },
          ],
        },
        { type: 'checkList', mode: 'items', field: 'confirmations' },
        { type: 'checkList', mode: 'single', field: 'independentReview', text: '独立非执行董事附加确认。' },
        { type: 'clauseList', field: 'scope', variant: 'checked' },
        {
          type: 'objectTable',
          field: 'assessmentItems',
          columns: [
            { key: '$index', label: '序号', type: 'index', width: 6, align: 'center' },
            { key: 'module', label: '内控模块', type: 'value', width: 38, blank: '＿＿＿＿＿＿' },
            {
              key: 'evidence',
              label: '证据索引',
              type: 'value',
              width: 18,
              blankWhen: { cond: { field: '$item.evidenceRequired', op: 'truthy' }, whenTrue: '＿＿＿＿', whenFalse: '—' },
            },
          ],
        },
        {
          type: 'signBlock',
          items: [
            { label: '董事姓名', value: [{ var: 'companyName', blank: '＿＿＿＿' }] },
            { label: '签署日期', value: [{ var: 'letterDate', format: 'date' }] },
          ],
          note: '存档说明：本函正本由公司秘书存入底稿。',
        },
        { type: 'note', text: '备注：本文件为测试样例。' },
        { type: 'divider' },
        {
          type: 'group',
          children: [{ type: 'heading', text: '（附则说明）' }],
        },
      ],
    },
  }

  const data = {
    companyName: '宏基国际控股有限公司',
    stockCode: '01234.HK',
    letterDate: '2026-03-20',
    confirmations: [
      { text: '已细阅年度报告', checked: true },
      { text: '已提出询问', checked: false },
    ],
    independentReview: false,
    scope: ['范围一', '范围二'],
    representative: '',
    assessmentItems: [
      { module: '财务汇报', evidenceRequired: true, evidence: 'FIN-001' },
      { module: '信息科技', evidenceRequired: true, evidence: '' },
      { module: '', evidenceRequired: false, evidence: '' },
    ],
  }

  const plan = buildDocPlan(docSchema, data)

  test('所有节点 className 均取自 DOC_CLASS（无内联字符串字面量）', () => {
    const allowed = new Set(Object.values(DOC_CLASS))
    plan.forEach((node) => {
      expect(allowed.has(node.className)).toBe(true)
    })
  })

  test('抬头/标题/分隔线/页眉/存档说明节点存在', () => {
    expect(plan.find((n) => n.type === 'company')?.props.value).toBe('宏基国际控股有限公司')
    expect(plan.find((n) => n.type === 'title')?.props.text).toBe('测 试 文 书')
    expect(plan.some((n) => n.type === 'divider' && n.className === DOC_CLASS.rule)).toBe(true)
    expect(plan.find((n) => n.type === 'meta')).toBeTruthy()
    // layout 内联 note 与 meta.archiveNote 追加之 note 应同时出现，且 archiveNote 在末尾
    const noteTexts = plan.filter((n) => n.type === 'note').map((n) => n.props.text)
    expect(noteTexts).toContain('备注：本文件为测试样例。')
    expect(noteTexts).toContain('存档说明：保存期不少于七年。')
    expect(noteTexts[noteTexts.length - 1]).toBe('存档说明：保存期不少于七年。')
  })

  test('段落 segments 空值渲染为 BLANK', () => {
    const para = plan.find((n) => n.type === 'paragraph')
    const blankRun = para.props.runs.find((r) => r.blank)
    expect(blankRun?.text).toBe(BLANK)
    // 有值变量解析为普通文本
    expect(para.props.runs.some((r) => r.text === '宏基国际控股有限公司')).toBe(true)
  })

  test('infoTable / checkList(双模式) / clauseList / signBlock 结构正确', () => {
    const info = plan.find((n) => n.type === 'infoTable')
    expect(info.props.rows).toHaveLength(2)
    expect(info.props.rows[0].label).toBe('公司名称')

    const itemCheck = plan.find((n) => n.type === 'checkList' && n.props.mode === 'items')
    expect(itemCheck.props.items).toHaveLength(2)
    expect(itemCheck.props.items[0].checked).toBe(true)

    const singleCheck = plan.find((n) => n.type === 'checkList' && n.props.mode === 'single')
    expect(singleCheck.props.checked).toBe(false)
    expect(singleCheck.props.text).toBe('独立非执行董事附加确认。')

    const clause = plan.find((n) => n.type === 'clauseList')
    expect(clause.props.items).toEqual(['范围一', '范围二'])

    const sign = plan.find((n) => n.type === 'signBlock')
    expect(sign.props.items).toHaveLength(2)
    expect(sign.props.note).toBe('存档说明：本函正本由公司秘书存入底稿。')
  })

  test('objectTable 空值三态（blankWhen）：有值→值；空且 required→＿＿＿＿；空且非 required→—', () => {
    const obj = plan.find((n) => n.type === 'objectTable')
    const rows = obj.props.rows
    expect(rows).toHaveLength(3)
    // 行1：module 有值、evidence 有值
    expect(rows[0].cells[1].text).toBe('财务汇报')
    expect(rows[0].cells[1].blank).toBe(false)
    expect(rows[0].cells[2].text).toBe('FIN-001')
    // 行2：module 有值、evidence 空且 evidenceRequired=true → ＿＿＿＿（blank）
    expect(rows[1].cells[2].text).toBe('＿＿＿＿')
    expect(rows[1].cells[2].blank).toBe(true)
    // 行3：module 空（列 blank='＿＿＿＿＿＿'）→ 该列留白；evidence 空且 evidenceRequired=false → —
    expect(rows[2].cells[1].text).toBe('＿＿＿＿＿＿')
    expect(rows[2].cells[1].blank).toBe(true)
    expect(rows[2].cells[2].text).toBe('—')
    expect(rows[2].cells[2].blank).toBe(false)
  })

  test('group 透明展开：子 heading 上提为顶层节点', () => {
    const groupChildHeading = plan.find((n) => n.type === 'heading' && n.props.text === '（附则说明）')
    expect(groupChildHeading).toBeTruthy()
  })
})

describe('buildDocPlan — autoNumber 连续（六章隐藏场景）', () => {
  test('隐藏条件章节后，下一章序号为「六、」而非「七、」', () => {
    const docSchema = {
      layoutMode: 'custom',
      meta: { docTitle: 'T' },
      layout: {
        sections: [
          { type: 'heading', text: '背景', autoNumber: true },
          { type: 'heading', text: '目标', autoNumber: true },
          { type: 'heading', text: '范围', autoNumber: true },
          { type: 'heading', text: '汇报', autoNumber: true },
          { type: 'heading', text: '里程碑', autoNumber: true },
          {
            type: 'group',
            visibleWhen: { field: 'showExtra', op: 'eq', value: 'yes' },
            children: [{ type: 'heading', text: '无内审说明', autoNumber: true }],
          },
          { type: 'heading', text: '签批', autoNumber: true },
        ],
      },
    }
    const headings = buildDocPlan(docSchema, {})
      .filter((n) => n.type === 'heading')
      .map((n) => n.props.text)
    expect(headings).toEqual(['一、背景', '二、目标', '三、范围', '四、汇报', '五、里程碑', '六、签批'])
  })
})

/* =========================================================
 * 纯留白段 { blank } 守卫
 *
 * 背景：resolveSegments 对「join / var / text / blank 四者皆不中」的段是**静默跳过**的
 * （不报错、不留痕，只是消失）。签署格若写成 value: [{}] 会渲染成空白而非下划线，
 * 在纸质签署件上属可见缺陷且极难在 code review 中发现。
 * 故引入一等公民的 { blank: true } 段，并用下列用例把行为钉死。
 * resolveSegments 经 valueToRuns 被 paragraph / infoTable / signBlock 三处共用，
 * 因此三处各有一条用例。
 * ========================================================= */
describe('buildDocPlan — 纯留白段 { blank } 与空段静默跳过', () => {
  /**
   * 构造只含一个 signBlock 的最小 docSchema。
   * @param {Array} value signBlock 首项的 value
   * @returns {object}
   */
  const signSchema = (value) => ({
    layoutMode: 'custom',
    meta: { docTitle: 'T' },
    layout: { sections: [{ type: 'signBlock', items: [{ label: '董事签署', value }] }] },
  })

  /**
   * 取出 signBlock 首项的 runs。
   * @param {Array} value signBlock 首项的 value
   * @param {object} [data] 表单数据
   * @returns {Array}
   */
  const signRuns = (value, data = {}) =>
    buildDocPlan(signSchema(value), data).find((n) => n.type === 'signBlock').props.items[0].runs

  test('反例现状：value:[{}] 空段被静默跳过，runs 长度为 0（故必须用 blank 段）', () => {
    // ⚠️ 这是**已知且刻意保留**的引擎行为，不是待修缺陷：
    //    四种形态皆不中的段不产出 run。此用例用于防止有人"顺手修好"它，
    //    同时提醒 schema 作者：想留白请写 { blank: true }，不要写 {} 或依赖哑 var。
    expect(signRuns([{}])).toHaveLength(0)
    expect(signRuns([])).toHaveLength(0)
  })

  test('{ blank: true } → BLANK（8 全角下划线）且标记 blank:true', () => {
    const runs = signRuns([{ blank: true }])
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe(BLANK)
    expect(runs[0].text).toHaveLength(8)
    expect(runs[0].blank).toBe(true)
  })

  test('{ blank: "＿＿＿＿" } → 自定义长度留白且标记 blank:true', () => {
    const runs = signRuns([{ blank: '＿＿＿＿' }])
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe('＿＿＿＿')
    expect(runs[0].blank).toBe(true)
  })

  test('{ var } 且 data 无该键 → BLANK 且 blank:true（保护既有留白行为）', () => {
    const runs = signRuns([{ var: 'signerName' }])
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe(BLANK)
    expect(runs[0].blank).toBe(true)
  })

  test('{ var } 且 data 有值 → 显示实际值，不标记 blank', () => {
    const runs = signRuns([{ var: 'signerName' }], { signerName: '陈大文' })
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe('陈大文')
    expect(runs[0].blank).not.toBe(true)
  })

  test('paragraph：文本段 + 留白段混排 → 2 个 run，仅第 2 个为留白', () => {
    const docSchema = {
      layoutMode: 'custom',
      meta: { docTitle: 'T' },
      layout: {
        sections: [{ type: 'paragraph', segments: [{ text: '董事签署：' }, { blank: true }] }],
      },
    }
    const runs = buildDocPlan(docSchema, {}).find((n) => n.type === 'paragraph').props.runs
    expect(runs).toHaveLength(2)
    expect(runs[0].text).toBe('董事签署：')
    expect(runs[0].blank).not.toBe(true)
    expect(runs[1].text).toBe(BLANK)
    expect(runs[1].blank).toBe(true)
  })

  test('infoTable：行 value 为 [{ blank: true }] → 该行渲染为留白', () => {
    const docSchema = {
      layoutMode: 'custom',
      meta: { docTitle: 'T' },
      layout: {
        sections: [
          {
            type: 'infoTable',
            rows: [
              { label: '文件编号', value: [{ blank: true }] },
              { label: '公司名称', value: [{ var: 'companyName' }] },
            ],
          },
        ],
      },
    }
    const rows = buildDocPlan(docSchema, { companyName: '宏基国际控股有限公司' }).find(
      (n) => n.type === 'infoTable',
    ).props.rows
    expect(rows[0].runs).toHaveLength(1)
    expect(rows[0].runs[0].text).toBe(BLANK)
    expect(rows[0].runs[0].blank).toBe(true)
    expect(rows[1].runs[0].text).toBe('宏基国际控股有限公司')
  })

  test('{ text } 段行为不变：不因新增 blank 分支而重复 push', () => {
    // blank 分支置于 text 分支之后，且 text 分支已 return，
    // 故 { text, blank } 并存时只按 text 处理（历史行为）。
    const runs = signRuns([{ text: '固定文字', blank: true }])
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe('固定文字')
    expect(runs[0].blank).not.toBe(true)
  })
})

describe('autoSections — objectList 列定义兜底 field.columns', () => {
  test('layoutMode 缺省（auto）时，用 columns 定义的 objectList 编译出 1 序号列 + 3 数据列', () => {
    const docSchema = {
      meta: { docTitle: 'T' },
      fields: [
        {
          key: 'directorList',
          type: 'objectList',
          label: '董事名单',
          columns: [
            { key: 'name', label: '姓名', type: 'text' },
            { key: 'role', label: '职位', type: 'text' },
            { key: 'appointedAt', label: '委任日期', type: 'date' },
          ],
        },
      ],
    }
    const objectTable = buildDocPlan(docSchema, {}).find((n) => n.type === 'objectTable')
    expect(objectTable).toBeTruthy()
    // 1 列序号（autoSections 恒插）+ 3 列来自 columns
    expect(objectTable.props.columns).toHaveLength(4)
    expect(objectTable.props.columns[0].type).toBe('index')
    expect(objectTable.props.columns.map((c) => c.label)).toEqual(['序号', '姓名', '职位', '委任日期'])
  })

  test('itemDefFields 优先级高于 columns（既有 preset 写法不受影响）', () => {
    const docSchema = {
      meta: { docTitle: 'T' },
      fields: [
        {
          key: 'items',
          type: 'objectList',
          itemDefFields: [{ key: 'module', label: '内控模块' }],
          itemDataFields: [{ key: 'evidence', label: '证据索引' }],
          columns: [{ key: 'shouldBeIgnored', label: '不应出现' }],
        },
      ],
    }
    const objectTable = buildDocPlan(docSchema, {}).find((n) => n.type === 'objectTable')
    expect(objectTable.props.columns.map((c) => c.label)).toEqual(['序号', '内控模块', '证据索引'])
  })
})

/* =========================================================
 * 可编辑存档说明（note.text 支持 { var } 引用字段）
 *
 * 背景：原 note.text 仅支持静态字符串，导致「存档说明」一行无法在 UI 修改。
 * 现支持 text 为 { var: 'archiveNote' }，使说明文字来自可编辑字段；
 * 配合 printArchiveNote 勾选框控制整行显隐。本用例锁定该行为。
 * ========================================================= */
describe('buildDocPlan — note.text 支持 { var } 引用字段（可编辑存档说明）', () => {
  const docSchema = {
    layoutMode: 'custom',
    meta: { docTitle: 'T' },
    fields: [
      { key: 'printArchiveNote', type: 'boolean', default: true },
      { key: 'archiveNote', type: 'textarea', default: '存档说明：默认存档提示文字。' },
    ],
    layout: {
      sections: [
        {
          type: 'note',
          visibleWhen: { field: 'printArchiveNote', op: 'ne', value: false },
          text: { var: 'archiveNote' },
        },
      ],
    },
  }

  test('note.text 为 { var } 且 data 有值 → 渲染为字段实际值', () => {
    const plan = buildDocPlan(docSchema, {
      printArchiveNote: true,
      archiveNote: '本函由秘书存入合规底稿。',
    })
    const note = plan.find((n) => n.type === 'note')
    expect(note).toBeTruthy()
    expect(note.props.text).toBe('本函由秘书存入合规底稿。')
  })

  test('note.text 为 { var } 且 data 为空 → 渲染为 BLANK 留白（可手写），仍保留 note 节点', () => {
    const plan = buildDocPlan(docSchema, { printArchiveNote: true, archiveNote: '' })
    const note = plan.find((n) => n.type === 'note')
    expect(note).toBeTruthy()
    expect(note.props.text).toBe(BLANK)
  })

  test('printArchiveNote 取消勾选 → note 整节点不出现（显隐不受影响）', () => {
    const plan = buildDocPlan(docSchema, { printArchiveNote: false, archiveNote: '任意说明' })
    expect(plan.find((n) => n.type === 'note')).toBeUndefined()
  })

  test('静态字符串 text 行为不变（向后兼容）', () => {
    const staticSchema = {
      layoutMode: 'custom',
      meta: { docTitle: 'T' },
      layout: { sections: [{ type: 'note', text: '备注：静态说明。' }] },
    }
    const note = buildDocPlan(staticSchema, {}).find((n) => n.type === 'note')
    expect(note.props.text).toBe('备注：静态说明。')
  })
})
