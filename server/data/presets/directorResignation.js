/**
 * preset 7 · 董事辞任信（Letter of Resignation）
 *
 * 来源：docs/spec-preset-7-8-director-change.md §7（模板 7），逐条转写为 docSchema。
 * 法域：香港《公司条例》(Cap. 622) + 联交所《证券上市规则》（主板）第 13.51(2) 条。
 *
 * 转写要点（对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   §7.1 元信息      → meta.docTitle / docSubtitle / companyField / headerMeta / fileNamePattern / archiveNote
 *   §7.2 字段清单    → fields（自动带入 2 + 人工填写 7 = 9 个业务字段，另见文末「与规格偏差」第 1 条）
 *   §7.3 正文 20 区块 → layout.sections
 *   §7.3.1 交还条款  → clauseList（variant: 'checked'）
 *   §7.4 对拍基准    → sampleData
 *
 * 🔴 三条引擎硬约束（规格 §9.1，务必保持）：
 *   1. layoutMode 必须显式 'custom'，否则引擎按 fields 顺序自动排版、完全无视 layout.sections（静默失败）。
 *   2. 纯手签格子一律 `value: [{ blank: true }]`。写成 `{ text: '', blank: BLANK }` 会被 resolveSegments
 *      的 text 分支先命中并 return，渲染成「空白无下划线」；写成 `[{}]` / `[]` / 省略 value 则被静默丢弃。
 *   3. blank 长度不写即取引擎默认值 BLANK（8 个全角下划线），切勿手抄下划线字面量。
 *
 * ⚠️ 安全红线：不提供 html 区块；条件一律走 JSON DSL（算子白名单见 server/constants/templateSchema.js）。
 */

const { SCHEMA_VERSION, DIRECTOR_TYPES, toCheckItems } = require('./_shared');

/**
 * §7.2.1 `committeeRoles` 备选项（checklist）。
 * 仅作为填写视图的候选清单；字段实值为已勾选之 {text, checked} 条目数组，
 * 未勾选任何职务时该字段为空数组 → falsy → 渲染「并无兼任」句（B9）。
 * @type {ReadonlyArray<string>}
 */
const COMMITTEE_ROLE_OPTIONS = Object.freeze([
  '审核委员会主席',
  '审核委员会成员',
  '薪酬委员会主席',
  '薪酬委员会成员',
  '提名委员会主席',
  '提名委员会成员',
  '企业管治委员会成员',
  '风险管理委员会成员',
  '授权代表（上市规则第 3.05 条）',
  '法律程序代理人（《公司条例》第 16 部）',
  '本公司附属公司之董事职务',
]);

/**
 * §7.3.1 B16 交还公司财产及持续责任 —— 四条固定条款之默认文本。
 *
 * 注：引擎 `makeClauseList()` 的条目一律取自 `data[section.field]`（`normalizeStringList`），
 * **不支持区块内静态条款文本**，故此四条以 `clauses` 字段之 `default` 承载（见文末偏差第 1 条）。
 * 第 1 条原文含 `{effectiveDate}` 变量，而 clauseList 不做变量插值，
 * 默认文案改以「辞任生效日期」表述；对拍用之实际日期见 sampleData（见偏差第 2 条）。
 * @type {ReadonlyArray<string>}
 */
const RETURN_UNDERTAKINGS = Object.freeze([
  '本人已于／将于辞任生效日期或之前，交还所有属于本公司或其附属公司之财产、文件、会计记录、公司印章、门禁卡、名片及电子设备。',
  '本人已删除或交还所有以电子形式持有之本公司机密资料，并不会保留任何形式之副本。',
  '本人明白并同意，本人对本公司所负之保密责任于本人辞任后仍然持续有效，并将继续遵守普通法及本人任职期间根据《公司条例》(Cap. 622) 所承担而于离任后仍具效力之责任。',
  '本人同意在本公司提出合理要求时，签署及办理一切与本人辞任有关之文件（包括但不限于向香港公司注册处提交之 Form ND2A 及联交所所需之确认文件）。',
]);

/** §7.3 B21 文末操作提示（挂于「本公司收讫」签署块之 note） */
const FILING_NOTE =
  '本辞任信一经本公司收讫即告送达。公司秘书须于生效日期起 15 日内向香港公司注册处提交 Form ND2A，'
  + '更新董事登记册，并按上市规则第 13.51(2) 条于联交所网站刊发公告；'
  + '如上文载有意见分歧或须提请股东垂注之事项，该等内容须原文纳入公告。';

/** §7.1 存档说明（正文说明已由 archiveNote 字段承载，可编辑；见 layout B21 之 note） */

/** @type {Object} preset 定义 */
const directorResignation = {
  presetKey: 'director-resignation',
  name: '董事辞任信',
  description:
    '董事向公司董事会递交之书面辞任通知（Letter of Resignation），涵盖辞任职务与生效日期、'
    + '随同辞去之委员会职务、上市规则第 13.51(2) 条「意见分歧」及「须提请股东垂注事项」声明，'
    + '以及交还公司财产之确认。',
  category: 'director_change',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    // 🔴 必须显式 custom：默认值 'auto' 会无视下方 20 个区块（规格 §9.1 第 5 条）
    layoutMode: 'custom',
    meta: {
      docTitle: '董 事 辞 任 信',
      docSubtitle: 'LETTER OF RESIGNATION — Director',
      companyField: 'companyName',
      headerMeta: {
        // 省略 blank，取引擎默认 BLANK（8 个全角下划线）
        left: [{ text: '股份代号：' }, { var: 'stockCode' }],
        right: [{ text: '辞任生效日期：' }, { var: 'effectiveDate', format: 'date' }],
      },
      fileNamePattern: '{{companyName}}-董事辞任信-{{effectiveDate}}',
    },
    fields: [
      // ① 公司名称（自动带入）
      {
        key: 'companyName',
        label: '公司名称',
        type: 'text',
        required: true,
        placeholder: '如：××控股有限公司',
        source: 'company',
        fieldPath: 'name',
      },
      // ② 股份代号（自动带入，非上市主体可留空）
      {
        key: 'stockCode',
        label: '股份代号',
        type: 'text',
        placeholder: '例：01288',
        hint: '自动带入页眉；非上市主体可留空。',
        source: 'company',
        fieldPath: 'stockCode',
      },
      // ③ 辞任董事姓名
      {
        key: 'directorName',
        label: '辞任董事姓名',
        type: 'text',
        required: true,
        placeholder: '例：陈志明',
        hint: '须与董事登记册所载姓名一致。',
        source: 'manual',
        fieldPath: '',
      },
      // ④ 现任董事类别（决定公告用语；INED 另触发上市规则第 3.10/3.11 条补足期限）
      {
        key: 'directorType',
        label: '现任董事类别',
        type: 'select',
        required: true,
        options: [...DIRECTOR_TYPES],
        hint: '独立非执行董事辞任可能触发上市规则第 3.10／3.10A／3.11 条三个月补足期及第 3.21 条审核委员会人数下限，须另行核查。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑤ 辞任生效日期（页眉、正文、导出文件名共用）
      {
        key: 'effectiveDate',
        label: '辞任生效日期',
        type: 'date',
        required: true,
        hint: '同时用于页眉、正文与导出文件名。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑥ 随同辞去之委员会及其他职务（留空 → 渲染「并无兼任」句）
      {
        key: 'committeeRoles',
        label: '随同辞去之委员会及其他职务',
        type: 'checklist',
        default: [],
        options: [...COMMITTEE_ROLE_OPTIONS],
        newItemText: '（请填写随同辞去之职务）',
        addLabel: '添加职务',
        emptyHint: '如并无兼任委员会或其他职务，请留空，正文将自动生成「并无兼任」声明。',
        hint: '多选；委员会职务变动直接影响上市规则第 3.21 条（审核委员会）与第 3.25 条（薪酬委员会）之合规，请据实勾选。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑦ 与董事会是否存在意见分歧
      // 🔴 刻意不设 default（Vincent 已拍板，规格 §7.5）：预设 false 会以辞任董事名义
      //    自动生成「并无任何意见分歧」之法律声明，并原文进入港交所公告。后续维护者请勿「修好」它。
      {
        key: 'hasDisagreement',
        label: '与董事会是否存在意见分歧',
        type: 'boolean',
        // ⚠️ 刻意不写 required: true —— 引擎 isEmptyValue(false) 视 false 为空值，
        //    加 required 会令合法之「否（并无分歧）」永远报「为必填项」而无法导出。
        //    强制明示选择改由 rules「dr-disagreement-must-declare」（op: nin [true,false]）实现：
        //    未选择 → 命中并禁用导出；选 false → 不命中。二者可区分，语义更准确。
        checkboxLabel: '本人与本公司董事会存在意见分歧（上市规则第 13.51(2) 条须予披露）',
        hint: '🔴 必须明示选择，无默认值：该声明将原文进入港交所公告，未作选择前不得导出。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑧ 意见分歧详情（hasDisagreement = true 时显示并转为必填）
      {
        key: 'disagreementDetail',
        label: '意见分歧详情',
        type: 'textarea',
        placeholder: '请具体说明分歧事项、涉及之董事会决议及日期',
        hint: '本栏文字将原文或实质性地写入港交所公告，须经公司法律顾问逐字审阅；系统不作任何自动改写或摘要。',
        visibleWhen: { op: 'eq', field: 'hasDisagreement', value: true },
        // ⚠️ 不要在字段上写 requiredWhen：引擎不消费该关键字，配置会被静默忽略
        //（templateSchema.js 的 UNSUPPORTED_FIELD_KEYS 已将其列为写入即报错）。
        // 条件必填一律改用 docSchema.rules 表达：本字段的「hasDisagreement = true
        // 时必填」由下方规则「dr-disagreement-detail-required」兜底实现。
        source: 'manual',
        fieldPath: '',
      },
      // ⑨ 须提请股东及联交所垂注之事项（留空 → 渲染否定声明）
      {
        key: 'shareholderMatter',
        label: '须提请股东及联交所垂注之事项',
        type: 'textarea',
        placeholder: '如无请留空，系统将自动生成「并无」声明',
        hint: '上市规则第 13.51(2) 条必备要素；留空即自动生成否定声明，确保文书必然载有该项声明。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑩ 交还公司财产及持续责任条款（承载 §7.3.1 四条固定条款；见文末偏差第 1 条）
      {
        key: 'returnUndertakings',
        label: '交还公司财产及持续责任条款',
        type: 'clauses',
        default: [...RETURN_UNDERTAKINGS],
        newItemText: '（请填写交还／持续责任条款）',
        addLabel: '添加条款',
        emptyHint: '暂无条款，请点击「添加」新增。',
        hint: '默认为上市公司通用之四条交接条款，可按实际交接情况增删；本清单兼作公司秘书离任交接工作底稿。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑪ 打印存档说明
      {
        key: 'printArchiveNote',
        label: '打印存档说明',
        type: 'boolean',
        default: true,
        checkboxLabel: '在文件末尾打印存档说明',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'archiveNote',
        label: '存档说明内容',
        type: 'textarea',
        default: FILING_NOTE,
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [
      {
        // 强制明示选择：未选择时 hasDisagreement 既非 true 亦非 false → 命中 nin
        id: 'dr-disagreement-must-declare',
        scope: 'form',
        when: { op: 'nin', field: 'hasDisagreement', value: [true, false] },
        message: '请明确声明是否与董事会存在意见分歧 —— 该声明将原文进入港交所公告',
      },
      {
        // 选「存在分歧」则详情栏转必填，避免只勾选却不说明
        id: 'dr-disagreement-detail-required',
        scope: 'form',
        when: {
          all: [
            { op: 'eq', field: 'hasDisagreement', value: true },
            { op: 'falsy', field: 'disagreementDetail' },
          ],
        },
        message: '已声明与董事会存在意见分歧，必须填写「意见分歧详情」—— 该内容须原文纳入港交所公告。',
      },
    ],
    layout: {
      sections: [
        // B1 致：{companyName}（「本公司」）董事会
        {
          type: 'paragraph',
          flat: true,
          segments: [
            { text: '致：', bold: true },
            { var: 'companyName' },
            { text: '（「本公司」）董事会' },
          ],
        },
        // B2 敬启者：
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          segments: [{ text: '敬启者：' }],
        },
        // B3 资料表（五行两列，全部绑真实字段）
        {
          type: 'infoTable',
          rows: [
            { label: '辞任人姓名', value: [{ var: 'directorName' }] },
            { label: '现任职务', value: [{ var: 'directorType' }] },
            { label: '公司名称', value: [{ var: 'companyName' }] },
            { label: '股份代号', value: [{ var: 'stockCode' }] },
            { label: '辞任生效日期', value: [{ var: 'effectiveDate', format: 'date' }] },
          ],
        },
        // B4 一、辞任声明
        { type: 'heading', autoNumber: true, text: '辞任声明' },
        // B5 辞任声明正文
        {
          type: 'paragraph',
          segments: [
            { text: '本人 ' },
            { var: 'directorName' },
            { text: '，现任本公司' },
            { var: 'directorType' },
            { text: '，谨此通知 贵董事会，本人决定辞去本人于本公司所担任之' },
            { var: 'directorType' },
            { text: '职务，并自 ' },
            { var: 'effectiveDate', format: 'date' },
            { text: '起生效。' },
          ],
        },
        // B6 二、随同辞去之委员会及其他职务
        { type: 'heading', autoNumber: true, text: '随同辞去之委员会及其他职务' },
        // B7 有兼任 → 引导句
        {
          type: 'paragraph',
          visibleWhen: { op: 'truthy', field: 'committeeRoles' },
          segments: [
            { text: '除上述董事职务外，本人同时辞去下列于本公司之职务，并同样自 ' },
            { var: 'effectiveDate', format: 'date' },
            { text: '起生效：' },
          ],
        },
        // B8 有兼任 → 勾选清单
        {
          type: 'checkList',
          field: 'committeeRoles',
          visibleWhen: { op: 'truthy', field: 'committeeRoles' },
          placeholder: '（尚未选择随同辞去之职务）',
        },
        // B9 无兼任 → 否定声明
        {
          type: 'paragraph',
          visibleWhen: { op: 'falsy', field: 'committeeRoles' },
          segments: [
            { text: '除上述董事职务外，本人并无兼任本公司或其任何附属公司之委员会职务或其他职务。' },
          ],
        },
        // B10 三、上市规则第 13.51(2) 条声明
        { type: 'heading', autoNumber: true, text: '上市规则第 13.51(2) 条声明' },
        // B11 无分歧声明（仅在明示选择「否」时出现；未作选择时两个分支均不出现）
        {
          type: 'paragraph',
          visibleWhen: { op: 'eq', field: 'hasDisagreement', value: false },
          segments: [
            {
              text:
                '本人确认，本人与本公司董事会并无任何意见分歧（no disagreement with the Board），'
                + '本人之辞任纯属个人决定。',
            },
          ],
        },
        // B12 有分歧 → 引导句 + 详情（group：整段随条件显隐，内部 heading 编号与父级连续）
        {
          type: 'group',
          visibleWhen: { op: 'eq', field: 'hasDisagreement', value: true },
          children: [
            // B12a
            {
              type: 'paragraph',
              segments: [{ text: '本人与本公司董事会存在意见分歧。有关分歧之详情如下：' }],
            },
            // B12b
            {
              type: 'paragraph',
              segments: [{ var: 'disagreementDetail' }],
            },
          ],
        },
        // B13 无须提请垂注事项 → 否定声明
        {
          type: 'paragraph',
          visibleWhen: { op: 'falsy', field: 'shareholderMatter' },
          segments: [
            {
              text:
                '本人确认，并无任何有关本人辞任之事项须提请本公司股东及香港联合交易所有限公司垂注。',
            },
          ],
        },
        // B14 有须提请垂注事项 → 引导句 + 内容
        {
          type: 'group',
          visibleWhen: { op: 'truthy', field: 'shareholderMatter' },
          children: [
            // B14a
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本人谨此知会下列有关本人辞任之事项，认为须提请本公司股东及'
                    + '香港联合交易所有限公司垂注：',
                },
              ],
            },
            // B14b
            {
              type: 'paragraph',
              segments: [{ var: 'shareholderMatter' }],
            },
          ],
        },
        // B15 四、交还公司财产及持续责任
        { type: 'heading', autoNumber: true, text: '交还公司财产及持续责任' },
        // B16 四条交接条款（逐条 ☑）
        {
          type: 'clauseList',
          field: 'returnUndertakings',
          variant: 'checked',
          placeholder: '（尚未设置交还条款）',
        },
        // B17 五、申索及致意
        { type: 'heading', autoNumber: true, text: '申索及致意' },
        // B18 不提出申索 + 致意（规格列为一个区块、成文为两段，故以 group 承载两段落）
        {
          type: 'group',
          children: [
            {
              type: 'paragraph',
              segments: [
                { text: '本人确认，除截至 ' },
                { var: 'effectiveDate', format: 'date' },
                {
                  text:
                    '止应付予本人之董事袍金及本人于任职期间已实际产生并按本公司政策可获报销之开支外，'
                    + '本人不会就本人之辞任或任期终止向本公司或其任何附属公司提出任何补偿、赔偿或其他形式之申索。',
                },
              ],
            },
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本人谨借此机会衷心感谢董事会同仁于本人任期内给予之支持与协助，'
                    + '并祝愿本公司业务蒸蒸日上。',
                },
              ],
            },
          ],
        },
        // B19 分隔线
        { type: 'divider' },
        // B20 签署区（B20a 辞任董事 + B20b 本公司收讫；B21 操作提示挂于收讫块之 note）
        {
          type: 'group',
          children: [
            {
              type: 'paragraph',
              flat: true,
              bold: true,
              segments: [{ text: '辞任董事' }],
            },
            // B20a：签署与日期为纯手签格 → 必须 value: [{ blank: true }]
            {
              type: 'signBlock',
              items: [
                { label: '董事签署', value: [{ blank: true }] },
                { label: '姓名', value: [{ var: 'directorName' }] },
                { label: '职务', value: [{ var: 'directorType' }] },
                { label: '日期', value: [{ blank: true }] },
              ],
            },
            {
              type: 'paragraph',
              flat: true,
              bold: true,
              segments: [{ text: '本公司收讫' }],
            },
            // B20b：三格全为纯手签格
            {
              type: 'signBlock',
              items: [
                { label: '公司秘书签署', value: [{ blank: true }] },
                { label: '姓名', value: [{ blank: true }] },
                { label: '收件日期', value: [{ blank: true }] },
              ],
            },
            // B21 后续申报及存档提示（可选：printArchiveNote 未显式关闭则打印）
            {
              type: 'note',
              visibleWhen: { field: 'printArchiveNote', op: 'ne', value: false },
              text: { var: 'archiveNote' },
            },
          ],
        },
      ],
    },
  },
  // §7.4 对拍基准
  sampleData: {
    companyName: '华瑞控股有限公司',
    stockCode: '01288',
    directorName: '陈志明',
    directorType: '独立非执行董事',
    effectiveDate: '2026-03-31',
    committeeRoles: toCheckItems(['审核委员会主席', '薪酬委员会成员'], true),
    hasDisagreement: true,
    disagreementDetail:
      '本人就本公司拟收购目标公司之估值基础及尽职审查范围，与董事会其他成员持不同意见。'
      + '本人曾于二零二六年二月十八日董事会会议上要求委聘独立估值师复核收购代价，惟该项建议未获采纳。',
    shareholderMatter:
      '本人建议本公司股东留意上述收购事项之估值假设，并关注本公司于二零二五年年报所披露之'
      + '关连交易内部监控程序于实际执行层面之落实情况。',
    returnUndertakings: [
      '本人已于／将于 2026 年 3 月 31 日或之前，交还所有属于本公司或其附属公司之财产、文件、会计记录、公司印章、门禁卡、名片及电子设备。',
      '本人已删除或交还所有以电子形式持有之本公司机密资料，并不会保留任何形式之副本。',
      '本人明白并同意，本人对本公司所负之保密责任于本人辞任后仍然持续有效，并将继续遵守普通法及本人任职期间根据《公司条例》(Cap. 622) 所承担而于离任后仍具效力之责任。',
      '本人同意在本公司提出合理要求时，签署及办理一切与本人辞任有关之文件（包括但不限于向香港公司注册处提交之 Form ND2A 及联交所所需之确认文件）。',
    ],
  },
};

module.exports = directorResignation;
