/**
 * preset 5 · 董事会声明和决议记录（Board Statement and Resolution Record）
 *
 * 来源：MVP `hk-compliance-templates/src/templates.jsx` → `templateBoardResolution`
 * （fields 8 项 / render() 全部 JSX 段落已逐条转写为 layout.sections）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   <InfoTable rows>                     → { type:'infoTable', rows:[{label,value:[segments]}] }
 *   <p className="doc-h2">               → { type:'heading', autoNumber:true }
 *   <p className="doc-p">                → { type:'paragraph' }
 *   <MultiLine value indent={false}>     → { type:'clauseList', variant:'plain' }
 *   <NumberedList value>                 → { type:'clauseList', variant:'ordered' }
 *   <SignBlock items note>               → { type:'signBlock' }
 *
 * ⚠️ 本模板的立法意图（见 description）是「体现实质讨论」，
 *    故正文措辞一律照抄 MVP，禁止回退为「阅悉」「一致通过」等空泛表述。
 */

const { SCHEMA_VERSION, BLANK, BLANK_MD } = require('./_shared');

/** @type {Object} preset 定义 */
const boardResolution = {
  presetKey: 'board-resolution',
  name: '董事会声明和决议记录',
  description: '董事会会议之声明与决议记录，含出席董事名单及逐项决议条款。',
  category: 'board_resolution',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    layoutMode: 'custom',
    meta: {
      docTitle: '董 事 会 声 明 及 决 议 记 录',
      docSubtitle: 'Board Statement and Resolution Record — Risk Management and Internal Control',
      companyField: 'companyName',
      headerMeta: {
        left: [{ text: '会议日期：' }, { var: 'meetingDate', format: 'date', blank: BLANK }],
        right: [{ text: '记录人：公司秘书' }],
      },
      fileNamePattern: '{{companyName}}-董事会决议记录-{{meetingDate}}',
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
        key: 'meetingDate',
        label: '会议日期',
        type: 'date',
        required: true,
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'meetingPlace',
        label: '会议地点／方式',
        type: 'text',
        placeholder: '如：香港中环××大厦 28 楼会议室 ／ 视像会议',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'attendees',
        label: '出席董事',
        type: 'list',
        required: true,
        default: [],
        newItemText: '（请填写董事姓名及职务）',
        addLabel: '添加出席人员',
        emptyHint: '暂无出席董事，请点击「添加」新增。',
        hint: '每条一位，如：陈大文（主席／执行董事）。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'reportsReceived',
        label: '收到之报告清单',
        type: 'list',
        required: true,
        default: [],
        newItemText: '（请填写报告名称、提交人及日期）',
        addLabel: '添加报告',
        emptyHint: '暂无报告，请点击「添加」新增。',
        hint: '每条一份，如：《2025年度内部监控评估报告》（内部审核主管提交，2026年2月28日）。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'discussion',
        label: '董事质询与管理层答辩摘要',
        type: 'list',
        required: true,
        default: [],
        newItemText: '（董事姓名：质询内容 ／ 管理层：答辩内容）',
        addLabel: '添加质询与答辩',
        emptyHint: '暂无质询与答辩摘要，请点击「添加」新增。',
        hint: '每条一项，建议格式：董事姓名：质询内容 ／ 管理层：答辩内容。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'resolutions',
        label: '决议内容',
        type: 'clauses',
        required: true,
        default: [],
        newItemText: '（请填写决议事项）',
        addLabel: '添加决议',
        emptyHint: '暂无决议内容，请点击「添加」新增。',
        hint: '每条一项决议，如：采纳评估报告所载三项改善建议，并要求管理层于每季汇报进度。',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'chairmanName',
        label: '主席姓名',
        type: 'text',
        required: true,
        placeholder: '如：陈大文',
        source: 'manual',
        fieldPath: '',
      },
      {
        key: 'signDate',
        label: '签署日期',
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
        default: '存档说明：本决议记录连同随附报告由公司秘书存入董事会会议档案（档案编号：BM-年度-会议编号-RMIC），并作为年报披露之支持证据。',
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    rules: [],
    layout: {
      sections: [
        // ① 会议基本信息表
        {
          type: 'infoTable',
          rows: [
            { label: '公司名称', value: [{ var: 'companyName', blank: BLANK_MD }] },
            { label: '会议日期', value: [{ var: 'meetingDate', format: 'date', blank: BLANK_MD }] },
            { label: '会议地点／方式', value: [{ var: 'meetingPlace', blank: BLANK_MD }] },
          ],
        },
        // ② 一、出席董事
        { type: 'heading', text: '出席董事', autoNumber: true },
        {
          type: 'clauseList',
          field: 'attendees',
          variant: 'plain',
          placeholder: '（未填写出席董事）',
        },
        // ③ 二、董事会收到之报告
        { type: 'heading', text: '董事会收到之报告', autoNumber: true },
        {
          type: 'paragraph',
          segments: [{ text: '董事会确认于会上收取并审阅下列有关风险管理及内部监控之报告及文件：' }],
        },
        {
          type: 'clauseList',
          field: 'reportsReceived',
          variant: 'ordered',
          placeholder: '（未填写报告清单）',
        },
        // ④ 三、董事质询与管理层答辩摘要
        { type: 'heading', text: '董事质询与管理层答辩摘要', autoNumber: true },
        {
          type: 'paragraph',
          segments: [{ text: '董事会就上述报告所载事项与管理层进行了实质讨论，主要质询及答辩摘要如下：' }],
        },
        {
          type: 'clauseList',
          field: 'discussion',
          variant: 'ordered',
          placeholder: '（未填写质询与答辩摘要）',
        },
        // ⑤ 四、议决事项
        { type: 'heading', text: '议决事项', autoNumber: true },
        {
          type: 'paragraph',
          segments: [{ text: '经详细审议及讨论后，董事会明确议决同意下列事项：' }],
        },
        {
          type: 'clauseList',
          field: 'resolutions',
          variant: 'ordered',
          placeholder: '（未填写决议内容）',
        },
        // ⑥ 五、声明
        { type: 'heading', text: '声明', autoNumber: true },
        {
          type: 'paragraph',
          segments: [
            {
              text:
                '董事会声明：本公司之风险管理及内部监控系统由董事会负责，管理层负责设计及执行；'
                + '董事会已按《香港联合交易所有限公司证券上市规则》附录 C1《企业管治守则》第 D.2 节之要求，'
                + '对本公司及其附属公司之风险管理及内部监控系统作出年度检讨，'
                + '检讨范围涵盖财务监控、营运监控、合规监控及风险管理职能，'
                + '并已考虑会计、内部审核及财务汇报职能之资源、员工资历及经验是否充足。',
            },
          ],
        },
        { type: 'divider' },
        // ⑦ 签署区
        {
          type: 'signBlock',
          items: [
            { label: '主席签署', value: [{ blank: true }] },
            { label: '主席姓名', value: [{ var: 'chairmanName', blank: BLANK_MD }] },
            { label: '签署日期', value: [{ var: 'signDate', format: 'date', blank: BLANK_MD }] },
            { label: '公司秘书复核', value: [{ blank: true }] },
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
    meetingDate: '2026-03-15',
    meetingPlace: '香港中环××大厦 28 楼董事会会议室（部分董事以视像方式出席）',
    attendees: [
      '陈大文（主席／执行董事）',
      '林志强（执行董事／行政总裁）',
      '黄慧敏（非执行董事）',
      '李国雄（独立非执行董事／审核委员会主席）',
      '周敏仪（独立非执行董事）',
      '列席：公司秘书 李小明；内部审核主管 张启明；财务总监 王丽华',
    ],
    reportsReceived: [
      '《2025年度内部监控评估报告》— 内部审核主管张启明提交，日期 2026年2月28日；',
      '《2025年度各部门内控自评汇总表》— 公司秘书汇编，涵盖 6 个部门；',
      '《2025年度风险登记册及重大风险变动分析》— 财务总监提交。',
    ],
    discussion: [
      '李国雄（独立非执行董事）：质询 ERP 离职账号延迟停用之最长延迟日数及是否已发生未经授权访问。管理层（资讯科技部主管）答辩：最长延迟 11 天，经日志复核未发现未经授权访问纪录，已于 2026年1月上线自动停用流程。',
      '周敏仪（独立非执行董事）：质询采购审批缺失之 4 宗个案金额及是否涉及关连方。管理层（营运总监）答辩：合计金额约港币 86 万元，均为独立第三方供应商，已补办审批并纳入系统强制节点。',
      '黄慧敏（非执行董事）：质询内部审核资源是否足以覆盖新增海外业务。管理层答辩：2026年度将增聘一名内审人员并委聘外部顾问协助海外分部审阅。',
    ],
    resolutions: [
      '董事会确认已收取并详细审阅上述报告，并已就当中之发现向管理层作出询问及取得满意答复。',
      '董事会同意采纳《2025年度内部监控评估报告》所载三项改善建议，并要求管理层于每季董事会会议汇报整改进度。',
      '董事会同意批准 2026 年度内部审核增聘一名人员及委聘外部顾问协助海外分部审阅之资源安排。',
      '经考虑上述评估结果及管理层答复，董事会认为本公司之风险管理及内部监控系统于截至 2025年12月31日止年度内在各重大方面属有效及充足，并同意于 2025 年年报企业管治报告内作相应披露。',
    ],
    chairmanName: '陈大文',
    signDate: '2026-03-15',
  },
};

module.exports = boardResolution;
