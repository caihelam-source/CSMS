/**
 * preset 9 · 董事遵守标准守则之确认函（Letter of Confirmation — Model Code）
 *
 * 来源：真实 Word 文档（众安集团有限公司 · 遵守标准守则之年度确认函），正文逐字转写，
 * 不作任何法律措辞增删；仅把「公司名称 / 地址 / 期间结算日 / 董事姓名 / 日期」抽为可填字段。
 *
 * 法域依据：《香港联合交易所有限公司证券上市规则》附录 C3 —— 《上市发行人董事进行证券交易的
 * 标准守则》。上市发行人须采纳条文不逊于标准守则之证券买卖守则，并于中期／年度报告披露
 * 全体董事之遵守情况；本函即为该披露之书面底稿。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   「致：董事会 / 公司 / 地址两行」      → 4 个 { type:'paragraph', flat:true }（收信人区不缩排）
 *   「敬启者」「有关：…」                 → { type:'paragraph', flat:true, bold:true }
 *   正文确认段                            → { type:'paragraph' }
 *   横线 + 姓名 + 日期                    → { type:'divider' } + { type:'signBlock' }
 *
 * ⚠️ 两条引擎硬约束（与另外 8 个 preset 完全一致，务必保持）：
 *   1. 纯手签格一律写 `value: [{ blank: true }]`。`resolveSegments()` 分支序为
 *      join → var → text → blank，`{ text: '', blank: BLANK }` 会先命中 text 分支并 return，
 *      blank 被吞掉 → 渲染成「空白无下划线」，不报错、肉眼极难发现。
 *      本文件共 3 个签署格，其中「董事签署」为纯手签格，已按 { blank: true } 写法核对。
 *   2. `layoutMode` 必须显式 `'custom'`。默认 `'auto'` 会依 fields 顺序自动排版并**完全无视**
 *      本文件的 layout.sections，且不报任何错。
 */

const { SCHEMA_VERSION, BLANK, BLANK_MD } = require('./_shared');

/** 存档说明（文末可选 note 区块，受 printArchiveNote 字段控制；取消勾选则不打印，避免重复） */
const ARCHIVE_NOTE =
  '存档说明：本确认函正本由公司秘书存入合规底稿（中期／年度）（档案编号：MC-Compliance-期间-董事编号），'
  + '作为《上市规则》附录 C3 标准守则遵守情况披露之书面证据，保存期不少于七年。';

/** @type {Object} preset 定义 */
const directorCodeComplianceConfirmation = {
  presetKey: 'director-code-compliance-confirmation',
  name: '董事遵守标准守则之确认函',
  description:
    '董事就其于报告期间内一直遵守本公司所采纳、条文不逊于《上市规则》附录 C3'
    + '《上市发行人董事进行证券交易的标准守则》之证券买卖守则，所作出之书面确认函。'
    + '可生成半年度（截至六个月期间）或年度（截至十二个月期间）确认函。',
  category: 'compliance_filing',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    // 🔴 必须显式 'custom'：默认 'auto' 会无视下方 9 个区块，且不报任何错
    layoutMode: 'custom',
    meta: {
      docTitle: '董 事 遵 守 标 准 守 则 之 确 认 函',
      docSubtitle:
        'LETTER OF CONFIRMATION — Compliance with the Model Code (Listing Rules Appendix C3)',
      companyField: 'companyName',
      headerMeta: {
        // 原件页眉只有右上角日期一处，左栏刻意留空（引擎允许 left 缺省）
        right: [{ text: '日期：' }, { var: 'signDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern:
        '{{companyName}}-董事遵守标准守则之确认函-{{periodType}}-{{periodEndDate}}-{{directorName}}',
    },
    fields: [
      // ① 公司名称（自动带入；抬头与事由行共用）
      {
        key: 'companyName',
        label: '公司名称',
        type: 'text',
        required: true,
        placeholder: '如：众安集团有限公司',
        source: 'company',
        fieldPath: 'name',
      },
      // ② 收信地址第一行
      {
        key: 'addressLine1',
        label: '公司地址（第一行）',
        type: 'text',
        placeholder: '如：中国浙江省杭州市',
        hint: '按原件抬头分两行排印；如地址较短可只填第一行。',
        source: 'manual',
        fieldPath: '',
      },
      // ③ 收信地址第二行
      {
        key: 'addressLine2',
        label: '公司地址（第二行）',
        type: 'text',
        placeholder: '如：萧山区萧绍路996号',
        source: 'manual',
        fieldPath: '',
      },
      // ④ 报告期间结算日（正文「截至 ×××× 止六个月期间」）
      {
        key: 'periodEndDate',
        label: '截至期间结算日',
        type: 'date',
        required: true,
        placeholder: '如：2026-06-30',
        hint: '中期报告填半年度结算日，年度报告填财政年度结算日。',
        source: 'manual',
        fieldPath: '',
      },
      // ④-b 确认期间类别（半年度 / 年度）
      {
        key: 'periodType',
        label: '确认期间类别',
        type: 'select',
        required: true,
        options: ['半年度', '年度'],
        default: '半年度',
        placeholder: '选择半年度或年度确认',
        hint: '中期报告填「半年度」（截至六个月期间）；年度报告填「年度」（截至十二个月期间）。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑤ 董事姓名（签署栏与导出文件名共用）
      {
        key: 'directorName',
        label: '董事姓名',
        type: 'text',
        required: true,
        placeholder: '如：陈大文',
        hint: '须与董事登记册所载姓名完全一致。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑥ 签署日期（页眉与签署栏共用）
      {
        key: 'signDate',
        label: '签署日期',
        type: 'date',
        source: 'system',
        fieldPath: 'today',
      },
      // ⑦ 打印存档说明（可选；取消勾选则正式文档不输出存档说明）
      {
        key: 'printArchiveNote',
        label: '打印存档说明',
        type: 'boolean',
        default: true,
        source: 'manual',
        fieldPath: '',
        hint: '取消勾选：正式文档不打印底部「存档说明」一行（部分场景无需归档底稿说明）。',
      },
      {
        key: 'archiveNote',
        label: '存档说明内容',
        type: 'textarea',
        default: ARCHIVE_NOTE,
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    // 本模板不涉及条件分支或跨字段勾稽：directorName / periodEndDate 的必填已由
    // 字段级 required 覆盖，无须再写表单级规则。
    rules: [],
    layout: {
      sections: [
        // ① 致：董事会
        {
          type: 'paragraph',
          flat: true,
          segments: [{ text: '致：', bold: true }, { text: ' 董事会' }],
        },
        // ② 公司名称
        {
          type: 'paragraph',
          flat: true,
          segments: [{ var: 'companyName', blank: BLANK_MD }],
        },
        // ③ 地址第一行
        {
          type: 'paragraph',
          flat: true,
          segments: [{ var: 'addressLine1', blank: BLANK_MD }],
        },
        // ④ 地址第二行
        {
          type: 'paragraph',
          flat: true,
          segments: [{ var: 'addressLine2', blank: BLANK_MD }],
        },
        // ⑤ 敬启者：
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          segments: [{ text: '敬启者：' }],
        },
        // ⑥ 有关：××公司（「贵公司」）遵守标准守则之确认函（按期间类别切换）
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          visibleWhen: { field: 'periodType', op: 'eq', value: '半年度' },
          segments: [
            { text: '有关：' },
            { var: 'companyName', blank: BLANK_MD },
            { text: '（「贵公司」）遵守标准守则之中期确认函' },
          ],
        },
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          visibleWhen: { field: 'periodType', op: 'eq', value: '年度' },
          segments: [
            { text: '有关：' },
            { var: 'companyName', blank: BLANK_MD },
            { text: '（「贵公司」）遵守标准守则之年度确认函' },
          ],
        },
        // ⑦ 正文确认段（按期间类别切换：半年度→六个月期间；年度→十二个月期间（年度））
        {
          type: 'paragraph',
          visibleWhen: { field: 'periodType', op: 'eq', value: '半年度' },
          segments: [
            { text: '本人为贵公司的董事，确认本人于截至 ' },
            { var: 'periodEndDate', format: 'date', blank: BLANK_MD },
            {
              text:
                ' 止六个月期间，一直遵守贵公司采纳有关董事进行证券交易之证券买卖守则，'
                + '其条文不逊于《香港联合交易所有限公司证券上市规则》附录 C3 所载之'
                + '上市发行人董事进行证券交易的标准守则所规定之标准。',
            },
          ],
        },
        {
          type: 'paragraph',
          visibleWhen: { field: 'periodType', op: 'eq', value: '年度' },
          segments: [
            { text: '本人为贵公司的董事，确认本人于截至 ' },
            { var: 'periodEndDate', format: 'date', blank: BLANK_MD },
            {
              text:
                ' 止十二个月期间（年度），一直遵守贵公司采纳有关董事进行证券交易之证券买卖守则，'
                + '其条文不逊于《香港联合交易所有限公司证券上市规则》附录 C3 所载之'
                + '上市发行人董事进行证券交易的标准守则所规定之标准。',
            },
          ],
        },
        // ⑧ 分隔线（对应原件签署横线上方留白）
        { type: 'divider' },
        // ⑨ 签署区
        {
          type: 'signBlock',
          items: [
            // 🔴 纯手签格：必须 { blank: true }，写 { text: '', blank: BLANK } 会被 text 分支吞掉
            { label: '董事签署', value: [{ blank: true }] },
            { label: '姓名', value: [{ var: 'directorName', blank: BLANK_MD }] },
            { label: '日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
          ],
        },
        // ⑩ 存档说明（可选：默认打印；取消勾选 printArchiveNote 才隐藏，且只此一处，避免重复）
        {
          type: 'note',
          visibleWhen: { field: 'printArchiveNote', op: 'ne', value: false },
          text: { var: 'archiveNote' },
        },
      ],
    },
  },
  /** 对拍基准示例数据（取自原件真实值，便于与 Word 版逐字比对） */
  sampleData: {
    companyName: '众安集团有限公司',
    addressLine1: '中国浙江省杭州市',
    addressLine2: '萧山区萧绍路996号',
    periodEndDate: '2026-06-30',
    periodType: '半年度',
    directorName: '陈大文',
    signDate: '2026-07-15',
  },
};

module.exports = directorCodeComplianceConfirmation;
