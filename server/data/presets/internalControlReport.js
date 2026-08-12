/**
 * preset 4 · 内控评估报告模板（Internal Control Assessment Report）
 *
 * 来源：MVP `hk-compliance-templates/src/templates.jsx` → `templateAssessmentReport`
 * （fields 12 项 / render() 全部 JSX 段落已逐条转写为 layout.sections）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   <p className="doc-h2">               → { type:'heading', autoNumber:true }
 *   <p className="doc-p">                → { type:'paragraph' }
 *   <span className="doc-label">         → segment { bold:true }
 *   <NumberedList value>                 → { type:'clauseList', variant:'numbered' }
 *   <MultiLine value>                    → { type:'clauseList', variant:'plain' }
 *   <CheckList items>                    → { type:'checkList', field:'methods' }
 *   条件显示整段（noInternalAudit）        → { type:'group', visibleWhen:{...} }
 *                                          （heading.autoNumber 自动接管 MVP 的「六／七」序号切换）
 *   <SignBlock items note>               → { type:'signBlock' }
 *
 * 字段 key 与 T01 骨架保持兼容：`reportPeriod`（MVP 名 period）、
 * `alternativeArrangement`（MVP 名 noIaExplanation）沿用骨架命名，
 * 以免破坏 headerMeta 与 rules[icr-alternative-required] 的既有引用。
 */

const { SCHEMA_VERSION, BLANK, BLANK_MD, BLANK_SM, toCheckItems } = require('./_shared');

/** 默认评估方法文案（与 MVP ASSESSMENT_METHOD_TEXTS 逐字一致） */
const ASSESSMENT_METHOD_TEXTS = [
  '文件及政策审阅（Document Review）',
  '抽样测试（Sample Testing）',
  '穿行测试（Walkthrough Test）',
  '管理层及关键岗位访谈（Interview）',
  '信息系统一般控制核查（ITGC）',
];

/** 执行摘要结论值域（与 MVP conclusion.options 一致） */
const CONCLUSION_OPTIONS = Object.freeze([
  '有效',
  '基本有效（存在可改善事项）',
  '存在重大缺陷',
]);

/** @type {Object} preset 定义 */
const internalControlReport = {
  presetKey: 'internal-control-report',
  name: '内控评估报告模板',
  description: '年度风险管理及内部监控体系有效性评估报告，含未设内审职能时的替代安排说明。',
  category: 'internal_control',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '内 部 监 控 评 估 报 告',
      docSubtitle: 'Internal Control Assessment Report',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '评估期间：' }, { var: 'reportPeriod', blank: BLANK }],
        right: [{ text: '报告日期：' }, { var: 'reportDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern: '{{companyName}}-内控评估报告-{{reportPeriod}}',
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
        key: 'reportPeriod',
        label: '评估期间',
        type: 'text',
        required: true,
        placeholder: '如：2025年1月1日 至 2025年12月31日',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'scope',
        label: '评估范围',
        type: 'list',
        required: true,
        default: [],
        newItemText: '（请填写评估范围要点）',
        addLabel: '添加评估范围',
        emptyHint: '暂无评估范围，请点击「添加」新增。',
        hint: '每条一项，如：集团总部及三家主要营运附属公司之财务汇报流程。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'methods',
        label: '评估方法',
        type: 'checklist',
        required: true,
        default: toCheckItems(ASSESSMENT_METHOD_TEXTS, false),
        newItemText: '（请填写评估方法）',
        addLabel: '添加评估方法',
        emptyHint: '暂无评估方法，请点击「添加」新增。',
        hint: '每条可勾选／编辑／删除，亦可添加自定义评估方法；至少勾选一项。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'conclusion',
        label: '执行摘要结论',
        type: 'select',
        required: true,
        options: [...CONCLUSION_OPTIONS],
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'keyFindings',
        label: '关键发现',
        type: 'list',
        required: true,
        default: [],
        newItemText: '【低】（请填写发现描述 — 影响 — 建议）',
        addLabel: '添加关键发现',
        emptyHint: '暂无关键发现，请点击「添加」新增。',
        hint: '每条一项发现，建议格式：【等级】发现描述 — 影响 — 建议。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'managementConfirmation',
        label: '管理层确认',
        type: 'list',
        default: [],
        newItemText: '（请填写管理层回应／整改承诺及时间表）',
        addLabel: '添加管理层确认段落',
        emptyHint: '暂无管理层确认段落，可点击「添加」新增。',
        hint: '每条一段，逐条列明管理层对发现之回应、整改承诺及时间表。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'noInternalAudit',
        label: '本公司未设立内部审计职能',
        type: 'boolean',
        default: false,
        checkboxLabel: '本公司于评估期间未设立独立内部审核职能，须填写下方替代安排说明。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'alternativeArrangement',
        label: '无内审之替代安排说明',
        type: 'textarea',
        placeholder: '说明替代安排（如委聘外部顾问、审核委员会年度检讨）及其充分性评估。',
        visibleWhen: { op: 'truthy', field: 'noInternalAudit' },
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'preparedBy',
        label: '编制人',
        type: 'text',
        required: true,
        placeholder: '如：张启明',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'preparerTitle',
        label: '编制人职衔／机构',
        type: 'text',
        placeholder: '如：内部审核主管 ／ ××顾问有限公司',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'reportDate',
        label: '报告日期',
        type: 'date',
        required: true,
        source: 'system',
        fieldPath: 'today',
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
        default: '存档说明：本报告连同底稿由公司秘书归入年度风险管理及内部监控档案（档案编号：IC-REPORT-年度-001）。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [
      {
        id: 'icr-alternative-required',
        scope: 'form',
        when: {
          all: [
            { op: 'truthy', field: 'noInternalAudit' },
            { op: 'falsy', field: 'alternativeArrangement' },
          ],
        },
        message: '已勾选「未设立内部审计职能」，必须填写替代安排说明。',
      },
    ],
    layout: {
      sections: [
        // ① 一、执行摘要
        { type: 'heading', text: '执行摘要', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            { text: '本报告乃就 ' },
            { var: 'companyName', blank: BLANK_MD },
            { text: ' 于 ' },
            { var: 'reportPeriod', blank: BLANK_MD },
            {
              text:
                ' 期间之风险管理及内部监控系统进行评估后编制。'
                + '基于下述评估范围及方法，我们认为本公司之风险管理及内部监控系统于评估期间内属',
            },
            { var: 'conclusion', bold: true, blank: BLANK_MD },
            { text: '。本结论已提交审核委员会及董事会审阅。' },
          ],
        },
        // ② 二、评估范围
        { type: 'heading', text: '评估范围', autoNumber: true },
        {
          type: 'clauseList',
          field: 'scope',
          variant: 'ordered',
          placeholder: '（未填写评估范围）',
        },
        // ③ 三、评估依据及方法
        { type: 'heading', text: '评估依据及方法', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '本次评估以《香港联合交易所有限公司证券上市规则》附录 C1《企业管治守则》第 D.2 节'
                + '及 COSO 内部控制整合框架为依据，采用下列方法：',
            },
          ],
        },
        {
          type: 'checkList',
          field: 'methods',
          placeholder: '（尚未设置评估方法）',
        },
        // ④ 四、关键发现
        { type: 'heading', text: '关键发现', autoNumber: true },
        {
          type: 'clauseList',
          field: 'keyFindings',
          variant: 'ordered',
          placeholder: '（未填写关键发现）',
        },
        // ⑤ 五、管理层确认
        { type: 'heading', text: '管理层确认', autoNumber: true },
        {
          type: 'clauseList',
          field: 'managementConfirmation',
          variant: 'plain',
          placeholder: '（管理层回应待补充）',
        },
        // ⑥ 六、未设独立内部审核职能之替代安排说明（条件显示整段）
        //    MVP 用三元表达式在「六／七」间切换后续标题序号，
        //    此处交由 heading.autoNumber 依可见区块自动编号，语义等价。
        {
          type: 'group',
          visibleWhen: { op: 'truthy', field: 'noInternalAudit' },
          children: [
            { type: 'heading', text: '未设独立内部审核职能之替代安排说明', autoNumber: true },
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本公司于评估期间内并未设立独立内部审核职能。'
                    + '按《企业管治守则》守则条文 D.2.5 之要求，本公司已作出下列替代安排，并每年检讨其充分性：',
                },
              ],
            },
            {
              type: 'clauseList',
              field: 'alternativeArrangement',
              variant: 'plain',
              placeholder: '（未填写替代安排说明）',
            },
          ],
        },
        // ⑦ 七（或六）、报告用途及限制
        { type: 'heading', text: '报告用途及限制', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '本报告仅供本公司董事会、审核委员会及管理层作内部监控检讨之用，'
                + '并可按需要提供予外聘核数师及监管机构。'
                + '本报告并非审计意见，亦不构成对本公司财务报表之保证。',
            },
          ],
        },
        { type: 'divider' },
        // ⑧ 签署区
        {
          type: 'signBlock',
          items: [
            { label: '编制人签署', value: [{ blank: true }] },
            {
              label: '姓名／职衔',
              value: [
                { join: ['preparedBy', 'preparerTitle'], separator: ' ／ ', blank: BLANK_MD },
              ],
            },
            { label: '报告日期', value: [{ var: 'reportDate', format: 'date', blank: BLANK_MD }] },
            { label: '审核委员会主席复核', value: [{ blank: true }] },
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
    companyName: '宏基国际控股有限公司',
    reportPeriod: '2025年1月1日 至 2025年12月31日',
    scope: [
      '集团总部及三家主要营运附属公司之财务汇报流程；',
      '采购与付款循环、销售与收款循环；',
      '资讯科技一般控制（用户权限、数据备份、变更管理）；',
      '上市规则合规监控（关连交易、内幕消息、董事证券交易）。',
    ],
    methods: toCheckItems(ASSESSMENT_METHOD_TEXTS, true),
    conclusion: '基本有效（存在可改善事项）',
    keyFindings: [
      '【中】ERP 系统离职员工账号未于离职当日停用，抽查 30 宗有 3 宗延迟逾 7 天 — 存在未经授权访问风险 — 建议由人力资源部与资讯科技部建立离职联动清单。',
      '【低】部分采购申请单缺少第二层审批签署，抽查 50 宗有 4 宗 — 建议于系统内设强制审批节点。',
      '【低】关连交易内部登记册更新滞后一季 — 建议由公司秘书按季核对并留痕。',
    ],
    managementConfirmation: [
      '管理层接纳全部三项发现，并已制定整改时间表；',
      '离职账号联动流程于 2026 年第一季完成上线，责任人：资讯科技部主管；',
      '采购系统强制审批节点于 2026 年第二季完成配置，责任人：营运总监；',
      '关连交易登记册改为按季核对，自 2026 年第一季起执行，责任人：公司秘书。',
    ],
    noInternalAudit: true,
    alternativeArrangement:
      '本公司未设立独立内部审核职能，改为委聘××顾问有限公司按年执行内部监控审阅；\n'
      + '审核委员会每年至少一次检讨该替代安排之充分性，并于会议记录留痕；\n'
      + '经检讨，董事会认为上述替代安排就本集团现时业务规模及复杂程度而言属充分及有效。',
    preparedBy: '张启明',
    preparerTitle: '内部审核主管',
    reportDate: '2026-02-28',
  },
};

module.exports = internalControlReport;
