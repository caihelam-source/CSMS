/**
 * preset 6 · 项目章程（Project Charter）
 *
 * 来源：MVP `hk-compliance-templates/src/templates.jsx` → `templateProjectCharter`
 * （fields 13 项 / render() 全部 JSX 段落已逐条转写为 layout.sections）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   <InfoTable rows>（含 JSX 复合单元格）  → { type:'infoTable', rows:[{label,value:[segments]}] }
 *                                          （「起 至 止」「按 X 向 Y 汇报」用多 segment 拼接表达）
 *   <p className="doc-h2">               → { type:'heading', autoNumber:true }
 *   <p className="doc-p">                → { type:'paragraph' }
 *   <NumberedList value>                 → { type:'clauseList', variant:'ordered' }
 *   <MultiLine value>                    → { type:'clauseList', variant:'plain' }
 *   <SignBlock items note>               → { type:'signBlock' }
 *
 * 字段命名对齐 MVP：`endDate`（骨架原名 targetDate）、`scope`（骨架原名 scopeNote，
 * 且由 textarea 升为 list 以匹配 MVP 的 NumberedList 渲染）、新增 `approver`
 * （批准人／董事长，MVP 签批栏必需）。骨架中 MVP 不存在的 `projectOwner` 已移除。
 */

const { SCHEMA_VERSION, BLANK, BLANK_MD, BLANK_SM } = require('./_shared');

/** 汇报周期值域（与 MVP REPORTING_CYCLES 一致） */
const REPORTING_CYCLES = Object.freeze(['月度', '季度', '半年度', '年度']);

/** @type {Object} preset 定义 */
const projectCharter = {
  presetKey: 'project-charter',
  name: '项目章程（项目立项）',
  description: '项目立项章程，明确项目目标、范围、里程碑与治理责任人。',
  category: 'project_governance',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '项 目 章 程',
      docSubtitle: 'PROJECT CHARTER',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '项目名称：' }, { var: 'projectName', blank: BLANK }],
        right: [{ text: '签批日期：' }, { var: 'signDate', format: 'date', blank: BLANK }],
      },
      fileNamePattern: '{{companyName}}-{{projectName}}-项目章程-{{signDate}}',
    },
    fields: [
      {
        key: 'projectName',
        label: '项目名称',
        type: 'text',
        required: true,
        placeholder: '如：2026年度风险管理及内部监控合规提升项目',
        source: 'manual',
        fieldPath: '',
      },
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
        key: 'sponsor',
        label: '发起人／汇报人（公司秘书）',
        type: 'text',
        required: true,
        placeholder: '如：公司秘书 李小明',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'approver',
        label: '批准人（董事长）',
        type: 'text',
        required: true,
        placeholder: '如：董事长 陈大文',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'startDate',
        label: '项目开始日期',
        type: 'date',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'endDate',
        label: '项目完成日期',
        type: 'date',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'objectives',
        label: '项目目标要点',
        type: 'list',
        required: true,
        default: [],
        newItemText: '（请填写项目目标，建议可量化）',
        addLabel: '添加目标',
        emptyHint: '暂无项目目标，请点击「添加」新增。',
        hint: '每条一项目标，建议可量化。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'scope',
        label: '项目范围要点',
        type: 'list',
        required: true,
        default: [],
        newItemText: '纳入：（请填写范围）',
        addLabel: '添加范围',
        emptyHint: '暂无项目范围，请点击「添加」新增。',
        hint: '每条一项，注明纳入范围；如有不纳入事项亦请列明。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'reportingCycle',
        label: '汇报周期',
        type: 'select',
        required: true,
        options: [...REPORTING_CYCLES],
        default: '季度',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'reportingTo',
        label: '汇报对象',
        type: 'text',
        default: '董事会及审核委员会',
        placeholder: '如：董事会及审核委员会',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'milestones',
        label: '关键里程碑',
        type: 'list',
        required: true,
        default: [],
        newItemText: 'YYYY-MM 里程碑名称 — 交付物 — 责任人',
        addLabel: '添加里程碑',
        emptyHint: '暂无里程碑，请点击「添加」新增。',
        hint: '每条一项，建议格式：YYYY-MM 里程碑名称 — 交付物 — 责任人。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'resources',
        label: '资源及预算',
        type: 'list',
        default: [],
        newItemText: '（请填写人力、外部顾问或预算金额）',
        addLabel: '添加资源项',
        emptyHint: '暂无资源及预算安排，可点击「添加」新增。',
        hint: '每条一项，如：内部 公司秘书办公室 2 人；外部 顾问预算港币 45 万元。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'signDate',
        label: '签批日期',
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
        default: '存档说明：本章程正本由公司秘书存入项目档案（档案编号：PRJ-RMIC-年度-001），并于每次汇报时附上进度更新页。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [],
    layout: {
      sections: [
        // ① 项目基本信息表（MVP InfoTable，含两个 JSX 复合单元格）
        {
          type: 'infoTable',
          rows: [
            { label: '项目名称', value: [{ var: 'projectName', blank: BLANK_MD }] },
            { label: '所属公司', value: [{ var: 'companyName', blank: BLANK_MD }] },
            { label: '发起人／汇报人', value: [{ var: 'sponsor', blank: BLANK_MD }] },
            { label: '批准人', value: [{ var: 'approver', blank: BLANK_MD }] },
            {
              label: '项目周期',
              value: [
                { var: 'startDate', format: 'date', blank: BLANK_SM },
                { text: ' 至 ' },
                { var: 'endDate', format: 'date', blank: BLANK_SM },
              ],
            },
            {
              label: '汇报机制',
              value: [
                { text: '按 ' },
                { var: 'reportingCycle', blank: '＿＿' },
                { text: ' 向 ' },
                { var: 'reportingTo', blank: BLANK_SM },
                { text: ' 汇报进度' },
              ],
            },
          ],
        },
        // ② 一、项目背景及目标
        { type: 'heading', text: '项目背景及目标', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '为持续符合《香港联合交易所有限公司证券上市规则》附录 C1《企业管治守则》第 D.2 节'
                + '有关风险管理及内部监控之要求，并确保董事会年度检讨具备完整证据支持，现立项推动本项目。'
                + '项目目标如下：',
            },
          ],
        },
        {
          type: 'clauseList',
          field: 'objectives',
          variant: 'ordered',
          placeholder: '（未填写项目目标）',
        },
        // ③ 二、项目范围
        { type: 'heading', text: '项目范围', autoNumber: true },
        {
          type: 'clauseList',
          field: 'scope',
          variant: 'ordered',
          placeholder: '（未填写项目范围）',
        },
        // ④ 三、汇报机制
        { type: 'heading', text: '汇报机制', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            { text: '项目由 ' },
            { var: 'sponsor', blank: BLANK_SM },
            { text: ' 统筹执行，按 ' },
            { var: 'reportingCycle', blank: '＿＿' },
            { text: ' 向 ' },
            { var: 'reportingTo', blank: BLANK_SM },
            {
              text:
                ' 提交进度报告；如出现重大风险事项或里程碑延误，'
                + '须于知悉后五个工作日内以书面形式呈报批准人。',
            },
          ],
        },
        // ⑤ 四、关键里程碑
        { type: 'heading', text: '关键里程碑', autoNumber: true },
        {
          type: 'clauseList',
          field: 'milestones',
          variant: 'ordered',
          placeholder: '（未填写关键里程碑）',
        },
        // ⑥ 五、资源及预算
        { type: 'heading', text: '资源及预算', autoNumber: true },
        {
          type: 'clauseList',
          field: 'resources',
          variant: 'plain',
          placeholder: '（未填写资源及预算安排）',
        },
        // ⑦ 六、签批
        { type: 'heading', text: '签批', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            { text: '兹批准本项目章程，授权发起人按上述目标、范围及汇报机制推动执行，并调配所列资源。' },
          ],
        },
        { type: 'divider' },
        // ⑧ 签批区（批准人签署与日期为手写留白）
        {
          type: 'signBlock',
          items: [
            { label: '发起人签署', value: [{ var: 'sponsor', blank: BLANK_MD }] },
            { label: '日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
            { label: '批准人（董事长）签署', value: [{ blank: true }] },
            { label: '日期', value: [{ blank: true }] },
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
    projectName: '2026年度风险管理及内部监控合规提升项目',
    companyName: '宏基国际控股有限公司',
    sponsor: '公司秘书 李小明',
    approver: '董事长 陈大文',
    startDate: '2026-04-01',
    endDate: '2026-12-31',
    objectives: [
      '建立覆盖集团及主要附属公司之年度内控自评机制，部门覆盖率达 100%；',
      '完成风险登记册重检并将重大风险控制至可接受水平；',
      '确保 2026 年年报企业管治报告 H 段披露具备完整证据链，可追溯至底稿；',
      '完成全体董事年度风控合规培训，出席率不低于 90%。',
    ],
    scope: [
      '纳入：集团总部及三家主要营运附属公司之财务、营运、合规、资讯科技及人力资源内控；',
      '纳入：董事会及审核委员会有关风控之议程设置、文件模板与留痕机制；',
      '纳入：年度内控评估报告及董事确认函之统一模板与归档；',
      '不纳入：财务报表审计工作（由外聘核数师独立执行）。',
    ],
    reportingCycle: '季度',
    reportingTo: '董事会及审核委员会',
    milestones: [
      '2026-04 项目启动会 — 项目章程签批、工作小组成立 — 责任人：公司秘书；',
      '2026-06 内控自评表下发及回收 — 6 个部门自评表 — 责任人：各部门负责人；',
      '2026-09 内部审核抽样测试完成 — 中期发现清单 — 责任人：内部审核主管；',
      '2026-11 年度内控评估报告初稿 — 评估报告 — 责任人：内部审核主管；',
      '2026-12 董事会审议及决议留痕 — 决议记录、董事确认函 — 责任人：公司秘书。',
    ],
    resources: [
      '内部：公司秘书办公室 2 人、内部审核 2 人、各部门联络人 6 人；',
      '外部：委聘外部合规顾问协助海外分部审阅，预算港币 45 万元。',
    ],
    signDate: '2026-03-25',
  },
};

module.exports = projectCharter;
