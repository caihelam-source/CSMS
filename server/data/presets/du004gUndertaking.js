/**
 * preset 2 · DU004G 董事声明及承诺
 * （Declaration and Undertaking with regard to Directors — Form DU004G）
 *
 * 来源：MVP `hk-compliance-templates/src/templates.jsx` → `templateDu004g`
 * （fields 13 项 / render() 四大部分 JSX 已逐条转写为 layout.sections）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   「第 N 部分 — ×××」 → { type:'heading', autoNumber:false }（文案自带序号，不再自动编号）
 *   <InfoTable rows>     → { type:'infoTable', rows:[{label, value:[segments]}] }
 *   <CheckLine checked>  → { type:'checkList', mode:'single', field, text }
 *   <ClauseList items>   → { type:'clauseList', variant:'checked' }（☑ + （1）（2）编号）
 *   <div doc-quote>      → { type:'clauseList', variant:'plain', quote:true }
 *                          （normalizeStringList 按换行拆行，等价 MVP MultiLine）
 *   <SignBlock>          → { type:'signBlock' }
 */

const {
  SCHEMA_VERSION,
  BLANK,
  BLANK_MD,
  BLANK_SM,
  DIRECTOR_TYPES,
  ID_TYPES,
} = require('./_shared');

/** DU004G · 默认标准承诺条款（与 MVP UNDERTAKING_TEXTS 逐字一致） */
const UNDERTAKING_TEXTS = [
  '本人承诺遵守《香港联合交易所有限公司证券上市规则》之各项规定，包括但不限于附录 C3《上市发行人董事进行证券交易的标准守则》。',
  '本人承诺遵守本公司之组织章程大纲及细则，并按其规定履行董事职责。',
  '本人承诺遵守香港特别行政区及本公司注册成立地之一切适用法例、法规及监管规定，包括《证券及期货条例》项下之披露责任。',
  '本人承诺于本人之个人资料、于本公司或其相联法团证券之权益、所担任之其他职务或本表格所载任何事项发生变动时，即时以书面通知本公司及联交所。',
  '本人承诺就联交所、证券及期货事务监察委员会或其他监管机构之任何查询给予充分配合，并提供真实、准确及完整之资料。',
  '本人承诺投入充分时间及精力履行董事职责，并持续接受适当之董事培训以维持所需之技能及知识。',
];

/** 第二部分「资料真确声明」正文（MVP CheckLine 内联长句） */
const TRUTH_DECLARATION_TEXT =
  '本人声明，本表格及随附文件所载之一切资料在各重大方面均属真实、准确及完整，并无遗漏任何重要事实；'
  + '本人明白如作出虚假陈述，可能须承担《证券及期货条例》及其他适用法例项下之法律责任。';

/** @type {Object} preset 定义 */
const du004gUndertaking = {
  presetKey: 'du004g-undertaking',
  name: 'DU004G 董事声明及承诺',
  description:
    '港交所标准表格 DU004G：IPO 或董事委任／变更时由董事签署，声明个人资料真确并作出遵守《上市规则》等标准承诺，年度底稿须保存。',
  category: 'ipo_filing',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '董 事 声 明 及 承 诺',
      docSubtitle: 'FORM DU004G — Declaration and Undertaking with regard to Directors',
      companyField: 'companyName',
      headerMeta: {
        left: [
          { text: '表格编号：DU004G ／ 股份代号：' },
          { var: 'stockCode', blank: BLANK },
        ],
        right: [{ text: '签署日期：' }, { var: 'signDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern: '{{companyName}}-DU004G-{{directorName}}-{{today}}',
    },
    fields: [
      {
        key: 'companyName',
        label: '公司名称',
        type: 'text',
        required: true,
        placeholder: '如：××控股有限公司',
        source: 'company',
        fieldPath: 'name',
      },
      {
        key: 'stockCode',
        label: '股份代号',
        type: 'text',
        placeholder: '如：0XXXX.HK（IPO 前可留空）',
        source: 'company',
        fieldPath: 'stockCode',
      },
      {
        key: 'directorName',
        label: '董事姓名（中文）',
        type: 'text',
        required: true,
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'directorNameEn',
        label: '董事姓名（英文）',
        type: 'text',
        placeholder: '如：CHAN Tai Man',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'position',
        label: '拟任／现任职位',
        type: 'select',
        required: true,
        options: [...DIRECTOR_TYPES],
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'idType',
        label: '身份证明文件类别',
        type: 'select',
        required: true,
        options: [...ID_TYPES],
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'idNumber',
        label: '身份证明文件号码',
        type: 'text',
        required: true,
        placeholder: '如：A123456(7)',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'appointDate',
        label: '委任生效日期',
        type: 'date',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'undertakings',
        label: '标准承诺条款',
        type: 'clauses',
        required: true,
        default: [...UNDERTAKING_TEXTS],
        newItemText: '（请填写承诺条款内容）',
        addLabel: '添加承诺条款',
        emptyHint: '暂无承诺条款，请点击「添加」新增。',
        hint: '港交所标准条款，默认全数承诺；可逐条编辑／删除／添加，如有例外须于备注说明。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'truthDeclaration',
        label: '资料真确声明',
        type: 'boolean',
        required: true,
        default: true,
        checkboxLabel:
          '本人声明，本表格及随附文件所载之一切资料在各重大方面均属真实、准确及完整，并无遗漏任何重要事实。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'remarks',
        label: '备注／例外说明',
        type: 'textarea',
        placeholder: '如无例外可留空。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'signDate',
        label: '签署日期',
        type: 'date',
        required: true,
        source: 'system',
        fieldPath: 'today',
      },
      {
        key: 'witnessName',
        label: '见证人姓名及职衔',
        type: 'text',
        placeholder: '如：公司秘书 李小明',
        source: 'manual',
        fieldPath: '',
      },
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
        default: '存档说明：本表格正本连同董事个人资料表由公司秘书存入董事档案（档案编号：DIR-DU004G-年度-董事编号），并按《上市规则》要求提交联交所。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [
      {
        id: 'du004g-truth-declaration-required',
        scope: 'form',
        when: { op: 'falsy', field: 'truthDeclaration' },
        message: '必须勾选「资料真确声明」，否则本表格不得提交联交所。',
      },
    ],
    layout: {
      sections: [
        // 第一部分 — 董事个人资料
        { type: 'heading', text: '第一部分 — 董事个人资料', autoNumber: false },
        {
          type: 'infoTable',
          rows: [
            { label: '上市发行人名称', value: [{ var: 'companyName', blank: BLANK_MD }] },
            { label: '董事姓名（中文）', value: [{ var: 'directorName', blank: BLANK_MD }] },
            { label: '董事姓名（英文）', value: [{ var: 'directorNameEn', blank: BLANK_MD }] },
            { label: '拟任／现任职位', value: [{ var: 'position', blank: BLANK_MD }] },
            {
              label: '身份证明文件类别及号码',
              value: [
                { var: 'idType', blank: BLANK_SM },
                { text: ' ／ ' },
                { var: 'idNumber', blank: BLANK_MD },
              ],
            },
            {
              label: '委任生效日期',
              value: [{ var: 'appointDate', format: 'date', blank: BLANK_MD }],
            },
          ],
        },
        // 第二部分 — 声明
        { type: 'heading', text: '第二部分 — 声明', autoNumber: false },
        {
          type: 'checkList',
          mode: 'single',
          field: 'truthDeclaration',
          text: TRUTH_DECLARATION_TEXT,
        },
        // 第三部分 — 承诺
        { type: 'heading', text: '第三部分 — 承诺', autoNumber: false },
        {
          type: 'paragraph',
          segments: [
            { text: '本人以拟任／现任' },
            { var: 'position', blank: BLANK_MD },
            { text: '之身份，向香港联合交易所有限公司（「联交所」）及' },
            { var: 'companyName', blank: BLANK_MD },
            { text: '作出下列承诺：' },
          ],
        },
        {
          type: 'clauseList',
          field: 'undertakings',
          variant: 'checked',
          placeholder: '（尚未设置承诺条款）',
        },
        // 第四部分 — 备注／例外说明
        { type: 'heading', text: '第四部分 — 备注／例外说明', autoNumber: false },
        {
          type: 'clauseList',
          field: 'remarks',
          variant: 'plain',
          quote: true,
          placeholder: '无。',
        },
        { type: 'divider' },
        // 签署区
        {
          type: 'signBlock',
          items: [
            // 纯留白段：必须写 { blank: true }（写 { text: '', blank } 会被 text 分支吞掉）
            { label: '董事签署', value: [{ blank: true }] },
            { label: '董事姓名', value: [{ var: 'directorName', blank: BLANK_MD }] },
            { label: '签署日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
            { label: '见证人签署', value: [{ var: 'witnessName', blank: BLANK_MD }] },
          ],
        },
        // 存档说明（可选：printArchiveNote 未显式关闭则打印，且只此一处，避免重复）
        {
          type: 'note',
          visibleWhen: { field: 'printArchiveNote', op: 'ne', value: false },
          text: { var: 'archiveNote' },
        },
      ],
    },
  },
  sampleData: {
    companyName: '示例控股有限公司',
    stockCode: '01234.HK',
    directorName: '陈大文',
    directorNameEn: 'CHAN Tai Man',
    position: '执行董事',
    idType: '香港身份证',
    idNumber: 'A123456(7)',
    appointDate: '2026-01-05',
    undertakings: [...UNDERTAKING_TEXTS],
    truthDeclaration: true,
    remarks: '',
    signDate: '2026-01-05',
    witnessName: '公司秘书 李小明',
  },
};

module.exports = du004gUndertaking;
