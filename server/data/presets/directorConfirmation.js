/**
 * preset 1 · 董事确认函（Letter of Confirmation）
 *
 * 来源：MVP `hk-compliance-templates/src/templates.jsx` → `templateDirectorConfirmation`
 * （fields 11 项 / render() 全部 JSX 段落已逐条转写为 layout.sections）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   <p className="doc-p">                → { type:'paragraph' }
 *   <p className="doc-p-flat doc-label"> → { type:'paragraph', flat:true, bold:true }
 *   <CheckList items>                    → { type:'checkList', field:'confirmations' }
 *   <CheckLine checked>                  → { type:'checkList', mode:'single', field, text }
 *   条件显示整段                          → { type:'group', visibleWhen:{...} }
 *   <div class="doc-quote"><MultiLine/>  → { type:'clauseList', variant:'plain', quote:true }
 *                                          （normalizeStringList 会按换行拆行，等价 MultiLine）
 *   <SignBlock items note>               → { type:'signBlock' }
 */

const {
  SCHEMA_VERSION,
  BLANK,
  BLANK_MD,
  BLANK_SM,
  DIRECTOR_TYPES,
  toCheckItems,
} = require('./_shared');

/** 董事确认函 · 默认确认事项文案（与 MVP CONFIRMATION_TEXTS 逐字一致） */
const CONFIRMATION_TEXTS = [
  '本人已细阅本公司上述财政年度之年度报告全文，尤其是「风险管理及内部监控」一节（企业管治报告 H 段）之全部内容。',
  '本人已就风险管理及内部监控事宜向管理层、公司秘书及／或内部审核职能提出询问，并已就所提问题获得管理层之答复。',
  '本人对年度报告「风险管理及内部监控」一节所载之陈述及披露内容并无反对意见，亦无保留意见须予记录。',
  '本人认为本公司之风险管理及内部监控系统于该财政年度内在各重大方面属充足及有效，并已涵盖财务、营运、合规监控及风险管理职能。',
];

/** 独立非执行董事附加确认文案（MVP CheckLine 内联长句） */
const INED_REVIEW_TEXT =
  '本人已以独立非执行董事身份，独立审视本公司风险管理及内部监控系统之设计及执行成效，'
  + '审视过程未受管理层不当影响；并已就重大风险事项与外聘核数师及／或内部审核人员作独立沟通。';

/** @type {Object} preset 定义 */
const directorConfirmation = {
  presetKey: 'director-confirmation',
  name: '董事确认函',
  description:
    '年报定稿后发予各董事签署，确认已阅读年报「风险管理及内部监控」H 段、已提出询问且无反对意见；'
    + '独立非执行董事须额外确认已作独立审视。',
  category: 'annual_report',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '董 事 确 认 函',
      docSubtitle: 'LETTER OF CONFIRMATION — Risk Management and Internal Control',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '股份代号：' }, { var: 'stockCode', blank: BLANK }],
        right: [{ text: '日期：' }, { var: 'letterDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern: '{{companyName}}-董事确认函-{{fiscalYear}}-{{directorName}}',
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
        placeholder: '如：0XXXX.HK',
        source: 'company',
        fieldPath: 'stockCode',
      },
      {
        key: 'fiscalYear',
        label: '财政年度',
        type: 'text',
        required: true,
        placeholder: '如：2025',
        source: 'system',
        fieldPath: 'fiscalYear',
      },
      {
        key: 'fiscalYearEnd',
        label: '财政年度结算日',
        type: 'date',
        source: 'system',
        fieldPath: 'fiscalYearEnd',
      },
      {
        key: 'directorName',
        label: '董事姓名',
        type: 'text',
        required: true,
        placeholder: '如：陈大文',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'directorType',
        label: '董事类别',
        type: 'select',
        required: true,
        options: [...DIRECTOR_TYPES],
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'letterDate',
        label: '发函日期',
        type: 'date',
        required: true,
        source: 'system',
        fieldPath: 'today',
      },
      {
        key: 'confirmations',
        label: '确认事项列表',
        type: 'checklist',
        required: true,
        default: toCheckItems(CONFIRMATION_TEXTS, false),
        newItemText: '（请填写确认事项内容）',
        addLabel: '添加确认事项',
        emptyHint: '暂无确认事项，请点击「添加」新增。',
        hint: '每条可勾选／编辑／删除，亦可添加自定义确认事项；至少勾选一项，建议全数确认。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'independentReview',
        label: '独立非执行董事附加确认',
        type: 'boolean',
        default: false,
        checkboxLabel:
          '本人已以独立非执行董事身份，独立审视本公司风险管理及内部监控系统之设计及执行成效，审视过程未受管理层不当影响。',
        hint: '仅独立非执行董事需要确认。',
        visibleWhen: { op: 'eq', field: 'directorType', value: '独立非执行董事' },
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'remarks',
        label: '备注／保留意见',
        type: 'textarea',
        placeholder: '如无保留意见可留空；如有，请逐条列明（每行一条）。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'signDate',
        label: '签字日期',
        type: 'date',
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
        default: '存档说明：本函正本由公司秘书存入年度企业管治底稿（档案编号：CG-Confirmation-年度-董事编号），保存期不少于七年。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [
      {
        id: 'dc-ined-review-required',
        scope: 'form',
        when: {
          all: [
            { op: 'eq', field: 'directorType', value: '独立非执行董事' },
            { op: 'falsy', field: 'independentReview' },
          ],
        },
        message: '董事类别为「独立非执行董事」时，必须完成独立非执行董事附加确认。',
      },
    ],
    layout: {
      sections: [
        // ① 致：××公司 董事会 及 公司秘书
        {
          type: 'paragraph',
          flat: true,
          segments: [
            { text: '致：', bold: true },
            { var: 'companyName', blank: BLANK_MD },
            { text: ' 董事会 及 公司秘书' },
          ],
        },
        // ② 敬启者：
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          segments: [{ text: '敬启者：' }],
        },
        // ③-a 事由行（已填结算日 → 带括号补充，与 MVP 三元表达式一致）
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          visibleWhen: { op: 'truthy', field: 'fiscalYearEnd' },
          segments: [
            { text: '事由：截至 ' },
            { var: 'fiscalYear', blank: BLANK_SM },
            { text: ' 年财政年度（结算日：' },
            { var: 'fiscalYearEnd', format: 'date', blank: BLANK_SM },
            { text: '）年度报告 —— 风险管理及内部监控之董事确认' },
          ],
        },
        // ③-b 事由行（未填结算日 → 不出现括号，MVP 同款降级）
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          visibleWhen: { op: 'falsy', field: 'fiscalYearEnd' },
          segments: [
            { text: '事由：截至 ' },
            { var: 'fiscalYear', blank: BLANK_SM },
            { text: ' 年财政年度年度报告 —— 风险管理及内部监控之董事确认' },
          ],
        },
        // ④ 引言段
        {
          type: 'paragraph',
          segments: [
            { text: '本人 ' },
            { var: 'directorName', blank: BLANK_MD },
            { text: '，现任本公司' },
            { var: 'directorType', blank: BLANK_MD },
            {
              text:
                '。就本公司上述财政年度之年度报告及其中有关风险管理及内部监控之披露，'
                + '本人谨此确认下列事项：',
            },
          ],
        },
        // ⑤ 确认事项 checklist
        {
          type: 'checkList',
          field: 'confirmations',
          placeholder: '（尚未设置确认事项）',
        },
        // ⑥ 独立非执行董事附加确认（条件显示整段）
        {
          type: 'group',
          visibleWhen: { op: 'eq', field: 'directorType', value: '独立非执行董事' },
          children: [
            {
              type: 'paragraph',
              flat: true,
              bold: true,
              segments: [{ text: '独立非执行董事附加确认：' }],
            },
            {
              type: 'checkList',
              mode: 'single',
              field: 'independentReview',
              text: INED_REVIEW_TEXT,
            },
          ],
        },
        // ⑦ 备注标签
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          segments: [{ text: '备注／保留意见：' }],
        },
        // ⑧ 备注引用块（textarea 按换行拆行 → 等价 MVP <div doc-quote><MultiLine/></div>）
        {
          type: 'clauseList',
          field: 'remarks',
          variant: 'plain',
          quote: true,
          placeholder: '无。',
        },
        // ⑨ 存档效力声明
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '本人明白本确认函将由公司秘书存档，作为董事会履行《香港联合交易所有限公司证券上市规则》'
                + '附录 C1《企业管治守则》项下风险管理及内部监控责任之书面证据，并可供外聘核数师及监管机构查阅。',
            },
          ],
        },
        { type: 'divider' },
        // ⑩ 签署区
        {
          type: 'signBlock',
          items: [
            { label: '董事姓名', value: [{ var: 'directorName', blank: BLANK_MD }] },
            { label: '董事类别', value: [{ var: 'directorType', blank: BLANK_MD }] },
            // 纯留白段：必须写 { blank: true }。
            // 若写成 { text: '', blank: BLANK }，resolveSegments 的 text 分支会先命中
            // 并 return，导致 blank 被吞掉、渲染为空白无下划线。
            { label: '董事签署', value: [{ blank: true }] },
            { label: '签署日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
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
    fiscalYear: '2025',
    fiscalYearEnd: '2025-12-31',
    directorName: '陈大文',
    directorType: '独立非执行董事',
    letterDate: '2026-03-20',
    confirmations: toCheckItems(CONFIRMATION_TEXTS, true),
    independentReview: true,
    remarks: '',
    signDate: '2026-03-22',
  },
};

module.exports = directorConfirmation;
