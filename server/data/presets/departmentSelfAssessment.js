/**
 * preset 3 · 部门管理层年度内控自评表
 * （MVP `templateDepartmentSelfAssessment` 的 schema 化转写，src/templates.jsx:809-1021）
 *
 * 业务语义：各部门负责人就其职能范围内之内部监控作年度自评，逐项以 Y／N／N/A 表述并填写
 * 证据索引；凡选择 N 者必须填写缺陷说明及整改安排。自评模块可按部门实际情况增删改。
 *
 * ⚠️ 命名红线：schema 主体字段名恒为 `docSchema`（`schema` 是 Mongoose 保留字）。
 * ⚠️ 安全红线：禁止 eval / new Function；跨字段校验一律走 JSON 条件 DSL（算子白名单）。
 * ⚠️ 留白红线：纯留白段一律写 `{ blank: true }`。
 *    绝不可写 `{ text: '', blank: X }` —— `resolveSegments` 的分支顺序是
 *    join → var → text → blank，text 分支判定为 `typeof seg.text === 'string'`（空串也命中
 *    并 return），blank 会被吞掉，渲染成**空白无下划线**。该写法已被
 *    `assertValidSegments`（server/constants/templateSchema.js）永久拦截。
 *
 * 本模板 layoutMode 为 'custom'：自评表走 `objectTable` 区块显式排版，
 * **不依赖** `autoSections()` 的自动成文（那条路才读 `field.itemDefFields || field.columns`）。
 */

const { SCHEMA_VERSION, BLANK, BLANK_MD, BLANK_SM } = require('./_shared');

/**
 * 默认自评模块（与 MVP CONTROL_MODULE_TEXTS 逐字一致，src/templates.jsx:783-790）。
 * 用户可在表单中逐条编辑／删除／添加。
 * @type {ReadonlyArray<string>}
 */
const CONTROL_MODULE_TEXTS = Object.freeze([
  '财务汇报（账务处理、月结复核、财务报表编制及披露）',
  '营运管理（业务流程、采购与销售循环、存货及资产管理）',
  '合规管理（上市规则、反贪、制裁、数据私隐、行业牌照）',
  '信息科技（系统权限、数据备份、网络安全、变更管理）',
  '人力资源（招聘与离职、薪酬审批、利益冲突申报）',
  '授权审批（授权表、资金支付、关联交易及重大合约审批）',
]);

/**
 * 「是否有效」值域（与 MVP EFFECTIVE_OPTIONS 一致，src/templates.jsx:776-780）。
 * 用 {value,label} 形态，Builder 下拉展示 label、存储 value。
 * @type {ReadonlyArray<{value:string,label:string}>}
 */
const EFFECTIVE_OPTIONS = Object.freeze([
  { value: 'Y', label: 'Y — 有效' },
  { value: 'N', label: 'N — 存在缺陷' },
  { value: 'N/A', label: 'N/A — 不适用' },
]);

/**
 * 整体自评结论值域（与 MVP overallConclusion.options 一致）。
 * @type {ReadonlyArray<string>}
 */
const CONCLUSION_OPTIONS = Object.freeze([
  '有效',
  '基本有效（存在可改善事项）',
  '存在重大缺陷',
]);

/**
 * 构造自评模块条目（与 MVP `createAssessmentItem()` 语义完全一致，src/templates.jsx:798-807）。
 *
 * 双层结构说明：
 *   - itemDefFields（列定义层）：module / evidenceRequired —— 描述「这个模块是什么」，
 *     由内控组预先配置，填表人一般不改；
 *   - itemDataFields（数据填报层）：effective / evidence / note —— 描述「本年度自评结果」，
 *     由部门负责人逐项填写。
 * 两层字段在同一个扁平对象里共存（引擎 objectTable 按 col.key 直接取值，不区分层）。
 *
 * @param {string} moduleName 模块名称
 * @param {Object} [extra] 覆写字段（如 { effective: 'Y', evidence: 'FIN-2025-Q4-001' }）
 * @returns {{module:string, evidenceRequired:boolean, effective:string, evidence:string, note:string}} 条目对象
 */
function createAssessmentItem(moduleName = '', extra = {}) {
  return {
    module: String(moduleName),
    evidenceRequired: true,
    effective: '',
    evidence: '',
    note: '',
    ...extra,
  };
}

/** @type {Object} preset 定义 */
const departmentSelfAssessment = {
  presetKey: 'department-self-assessment',
  name: '部门管理层年度内控自评表',
  description:
    '各部门负责人就其职能范围内之内部监控作年度自评，逐项以 Y／N 表述并填写证据索引；'
    + '凡选择 N 者必须填写缺陷说明及整改安排。自评模块可按部门实际情况增删改。',
  category: 'internal_control',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '部门管理层年度内部监控自评表',
      docSubtitle: 'Departmental Internal Control Self-Assessment',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '财政年度：' }, { var: 'fiscalYear', blank: BLANK }, { text: ' 年' }],
        right: [{ text: '填报日期：' }, { var: 'signDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern: '{{companyName}}-{{departmentName}}-内控自评表-{{fiscalYear}}',
    },

    // ── 字段定义（8 个）────────────────────────────────────────────────────
    fields: [
      {
        key: 'companyName',
        label: '公司名称',
        type: 'text',
        required: true,
        source: 'company',
        fieldPath: 'name',
      },
      {
        key: 'departmentName',
        label: '部门名称',
        type: 'text',
        required: true,
        placeholder: '如：财务部',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'ownerName',
        label: '部门负责人姓名',
        type: 'text',
        required: true,
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'ownerTitle',
        label: '负责人职衔',
        type: 'text',
        placeholder: '如：财务总监',
        source: 'manual',
        fieldPath: '',
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
        key: 'assessmentItems',
        label: '自评模块列表',
        type: 'objectList',
        required: true,
        itemTitleKey: 'module',
        addLabel: '添加自评模块',
        emptyHint: '暂无自评模块，请点击「添加」新增。',
        hint: '「编辑」可修改模块名称及是否须提供证据；「删除」移除该模块；「添加」在末尾新增模块。',
        // 列定义层：描述模块本身，由内控组预配置
        itemDefFields: [
          {
            key: 'module',
            label: '模块名称',
            type: 'text',
            placeholder: '如：财务汇报（账务处理、月结复核）',
          },
          { key: 'evidenceRequired', label: '本模块须提供证据索引', type: 'boolean' },
        ],
        // 数据填报层：描述本年度自评结果，由部门负责人填写
        itemDataFields: [
          { key: 'effective', label: '是否有效', type: 'select', options: [...EFFECTIVE_OPTIONS] },
          { key: 'evidence', label: '证据索引', type: 'text', placeholder: '如 FIN-2025-Q4-001' },
          { key: 'note', label: '说明（选 N 必填）', type: 'text', placeholder: '缺陷描述及整改安排' },
        ],
        default: CONTROL_MODULE_TEXTS.map((moduleName) => createAssessmentItem(moduleName)),
        newItem: createAssessmentItem(''),
        newItemTitle: '（请填写模块名称）',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'overallConclusion',
        label: '整体自评结论',
        type: 'select',
        required: true,
        options: [...CONCLUSION_OPTIONS],
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'improvementPlan',
        label: '改善计划及时间表',
        type: 'list',
        default: [],
        newItemText: '（请填写改善事项、完成时间及责任人）',
        addLabel: '添加改善事项',
        emptyHint: '暂无改善事项，可点击「添加」新增。',
        hint: '每条一项，如：2026Q1 完成采购授权表更新，责任人：×××',
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
        default: '存档说明：本表格由公司秘书汇总归入年度内控评估底稿（档案编号：IC-SA-年度-部门代码），并作为董事会评估结论之支持证据。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],

    // ── 交叉校验（MVP `assessmentItems.validate()` 的 4 条逐项规则，src/templates.jsx:843-864）──
    // 全部以 scope: 'item:assessmentItems' 表达，逐行求值；
    // 条件路径 `$item.<key>` 由 resolveConditionPath 解析（schemaUtils.js:206-216）。
    // 消息中的 {{$item.module}} / {{$index1}} 由 fillTemplate 填充（schemaUtils.js:398）。
    rules: [
      // ① 模块名称必填 —— 对应 MVP `if (!moduleName)`
      {
        scope: 'item:assessmentItems',
        when: { field: '$item.module', op: 'falsy' },
        message: '自评模块第 {{$index1}} 项尚未填写模块名称。',
      },
      // ② 是否有效必选 —— 对应 MVP `if (!effective)`
      {
        scope: 'item:assessmentItems',
        when: { field: '$item.effective', op: 'falsy' },
        message: '自评模块「{{$item.module}}」尚未选择是否有效。',
      },
      // ③ 选 N 必须填说明 —— 对应 MVP `if (effective === 'N' && !note)`
      {
        scope: 'item:assessmentItems',
        when: {
          all: [
            { field: '$item.effective', op: 'eq', value: 'N' },
            { field: '$item.note', op: 'falsy' },
          ],
        },
        message: '自评模块「{{$item.module}}」选择 N，必须填写说明及整改安排。',
      },
      // ④ 须提供证据的模块，在已作结论且结论非 N/A 时必须填证据索引
      //    —— 对应 MVP `if (evidenceRequired && effective && effective !== 'N/A' && !evidence)`
      {
        scope: 'item:assessmentItems',
        when: {
          all: [
            { field: '$item.evidenceRequired', op: 'truthy' },
            { field: '$item.effective', op: 'truthy' },
            { field: '$item.effective', op: 'ne', value: 'N/A' },
            { field: '$item.evidence', op: 'falsy' },
          ],
        },
        message: '自评模块「{{$item.module}}」须填写证据索引。',
      },
    ],

    // ── 版面（custom）─────────────────────────────────────────────────────
    layout: {
      sections: [
        // 抬头信息表
        {
          type: 'infoTable',
          rows: [
            { label: '部门名称', value: [{ var: 'departmentName', blank: BLANK_MD }] },
            {
              label: '负责人姓名／职衔',
              // join 段：两个字段以「 ／ 」拼接，任一为空自动跳过；全空则整段留白
              value: [{ join: ['ownerName', 'ownerTitle'], separator: ' ／ ', blank: BLANK_MD }],
            },
            {
              label: '自评范围',
              value: [{ text: '本部门于上述财政年度内之全部职能流程及相关内部监控措施' }],
            },
          ],
        },

        // 一、内控模块自评结果
        { type: 'heading', text: '内控模块自评结果', autoNumber: true },
        {
          type: 'objectTable',
          field: 'assessmentItems',
          emptyText: '（尚未设置自评模块）',
          columns: [
            { key: '$index', label: '序号', type: 'index', width: 6, align: 'center' },
            { key: 'module', label: '内控模块', type: 'value', width: 38, blank: BLANK_MD },
            {
              key: 'effective',
              label: '是否有效',
              type: 'value',
              width: 10,
              align: 'center',
              blank: '＿＿',
            },
            {
              key: 'evidence',
              label: '证据索引',
              type: 'value',
              width: 18,
              // 空值三态（对应 MVP 第 974-980 行）：
              //   有值 → 原样；无值且本模块须提供证据 → 留白供手写；无值且无须提供 → 「—」
              blankWhen: {
                cond: { field: '$item.evidenceRequired', op: 'truthy' },
                whenTrue: BLANK_SM,
                whenFalse: '—',
              },
            },
            {
              key: 'note',
              label: '说明／缺陷描述及整改安排',
              type: 'value',
              width: 28,
              // 空值三态（对应 MVP 第 982-984 行）：
              //   有值 → 原样；无值且结论为 N → 「须补充说明」（红字留白）；否则 → 「—」
              blankWhen: {
                cond: { field: '$item.effective', op: 'eq', value: 'N' },
                whenTrue: '须补充说明',
                whenFalse: '—',
              },
            },
          ],
        },

        // 二、整体自评结论
        { type: 'heading', text: '整体自评结论', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            { text: '本人就本部门于 ' },
            { var: 'fiscalYear', blank: BLANK_SM },
            { text: ' 年财政年度之内部监控作出整体评估，结论为：' },
            { var: 'overallConclusion', blank: BLANK_MD, bold: true },
            { text: '。' },
          ],
        },

        // 三、改善计划及时间表
        { type: 'heading', text: '改善计划及时间表', autoNumber: true },
        {
          type: 'clauseList',
          field: 'improvementPlan',
          variant: 'ordered',
          placeholder: '本年度并无须跟进之改善事项。',
        },

        // 四、负责人声明
        { type: 'heading', text: '负责人声明', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '本人确认上述自评结果乃基于本部门实际运作情况作出，所列证据索引均可供内部审核、'
                + '公司秘书及外聘核数师查阅；本人明白本表格将纳入本公司年度风险管理及内部监控评估底稿。',
            },
          ],
        },

        { type: 'divider' },

        // 签署区
        {
          type: 'signBlock',
          items: [
            // 纯留白段：手写签名位，必须写 { blank: true }
            { label: '负责人签署', value: [{ blank: true }] },
            {
              label: '姓名／职衔',
              value: [{ join: ['ownerName', 'ownerTitle'], separator: ' ／ ', blank: BLANK_MD }],
            },
            { label: '部门', value: [{ var: 'departmentName', blank: BLANK_MD }] },
            { label: '日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
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

  // ── 样例数据（与 MVP `sample` 逐字一致，src/templates.jsx:885-908）──────────
  sampleData: {
    companyName: '示例控股有限公司',
    departmentName: '财务部',
    ownerName: '王丽华',
    ownerTitle: '财务总监',
    fiscalYear: '2025',
    assessmentItems: [
      createAssessmentItem(CONTROL_MODULE_TEXTS[0], { effective: 'Y', evidence: 'FIN-2025-Q4-001' }),
      createAssessmentItem(CONTROL_MODULE_TEXTS[1], { effective: 'Y', evidence: 'OPS-2025-11-007' }),
      createAssessmentItem(CONTROL_MODULE_TEXTS[2], { effective: 'Y', evidence: 'CMP-2025-AR-003' }),
      createAssessmentItem(CONTROL_MODULE_TEXTS[3], {
        effective: 'N',
        evidence: 'IT-2025-ACC-012',
        note: 'ERP 离职账号未及时停用，已于 2026Q1 上线自动停用流程。',
      }),
      createAssessmentItem(CONTROL_MODULE_TEXTS[4], { effective: 'Y', evidence: 'HR-2025-COI-020' }),
      createAssessmentItem(CONTROL_MODULE_TEXTS[5], { effective: 'Y', evidence: 'AUT-2025-DOA-002' }),
    ],
    overallConclusion: '基本有效（存在可改善事项）',
    improvementPlan: [
      '2026Q1 完成 ERP 离职账号自动停用流程上线，责任人：资讯科技部主管。',
      '2026Q2 完成部门授权审批表年度复核，责任人：财务总监。',
    ],
    signDate: '2026-02-10',
  },
};

module.exports = departmentSelfAssessment;
