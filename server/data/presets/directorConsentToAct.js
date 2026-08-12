/**
 * preset 8 · 同意出任董事函（Consent to Act as Director）
 *
 * 来源规格：`docs/spec-preset-7-8-director-change.md` §8（模板 8 全文）+ §0 通用约定 + §9 交付检查清单。
 * 法域：香港《公司条例》(Cap. 622) + 香港联合交易所《证券上市规则》（主板）。
 *
 * 转写映射（严格对齐 client/src/schemaDoc/schemaUtils.js 的 buildSection 契约）：
 *   DocShell(company/title/subtitle/meta) → meta.companyField / docTitle / docSubtitle / headerMeta
 *   规格 C1/C2/C5/C7/C12…                → { type:'paragraph' }
 *   规格 C3（六行两列）                   → { type:'infoTable', rows:[{label, value:[segments]}] }
 *   规格 C4/C6/C11/C15/C17（章节标题）    → { type:'heading', autoNumber:true }
 *   规格 C8（九项资格确认）               → { type:'checkList', field:'qualificationConfirmations' }
 *   规格 C9/C22（灰底提示）               → { type:'note' }
 *   规格 C10（INED 专属整节）             → { type:'group', visibleWhen:{ eq directorType 独立非执行董事 } }
 *   规格 C10c（六条独立性条款）           → { type:'clauseList', variant:'checked' }
 *   规格 C16（六条承诺）                  → { type:'clauseList', variant:'ordered' }
 *   规格 C20                              → { type:'divider' }
 *   规格 C21a–C21c（三组签署栏）          → { type:'signBlock' }（各自套一层 group 以承载标题行，见下）
 *
 * ⚠️ 三条引擎硬约束（规格 §9.1，务必保持）：
 *   1. 纯手签格子一律 `value: [{ blank: true }]`。`resolveSegments()` 分支序为 join→var→text→blank，
 *      `{ text: '', blank: BLANK }` 会先命中 text 分支并 return，blank 被吞 → 渲染成「空白无下划线」，
 *      不报错、验收时肉眼极难发现。本文件共 9 个手签格（C21a×2 + C21b×4 + C21c×3），已逐个核对。
 *   2. `layoutMode` 必须显式 `'custom'`。引擎默认 `'auto'` 会依 fields 顺序自动排版并**完全无视**
 *      本文件的 layout.sections，且不报任何错。
 *   3. `heading.autoNumber` 在 `visibleWhen` 求值**之后**才自增 headingCounter，被隐藏的 group
 *      及其内部 heading 不消耗序号。故 directorType ≠ 独立非执行董事 时，第三章整节消失且后续章节
 *      自动顺延为「三、四、五」，不会跳号（回归测试守卫：client/src/schemaDoc/docPlan.test.js:248）。
 *
 * ⚠️ 与规格的三处受迫偏差（详见文件末尾 DEVIATIONS 注释，均为引擎能力所限，非内容改动）：
 *   D1. 六条独立性条款 / 六条承诺条款改用 `list` 字段承载（字段数 11 → 13）。
 *   D2. C5 / C18 各含两段正文，用透明 group 包两个 paragraph（顶层区块数不变）。
 *   D3. C21a–C21c 的「获委任人／见证人／本公司收讫」标题行用 bold paragraph 补齐（signBlock 无 title）。
 *
 * 业务决策（Vincent 已拍板，规格 §8.5 / §8.6 风险 4）：
 *   `idNumber` **完整显示、不作任何遮蔽**。本函为递交香港公司注册处（Form ND2A 支持文件）及联交所之
 *   正式存档件，遮蔽版可能因资料不完整被退件，拖延法定 15 日申报期。脱敏由文档流转环节处理，
 *   模板层不维护双版本。故本文件**不含**任何 mask/遮蔽逻辑。
 */

const { SCHEMA_VERSION, DIRECTOR_TYPES, toCheckItems } = require('./_shared');

/**
 * 规格 §8.2.1 · `qualificationConfirmations` 九项资格确认文案（逐字照抄，不得简化）。
 * @type {string[]}
 */
const QUALIFICATION_TEXTS = [
  '本人已年满 18 岁，并具备完全行为能力（《公司条例》(Cap. 622) 有关董事最低年龄之规定）',
  '本人为自然人，并非以法团身分出任本职务',
  '本人现时并非未获解除破产之破产人，亦无任何未履行完毕之个人自愿安排、债务重组安排或未偿还之法院判定债项',
  '本人从未被任何法院或监管机构颁令取消担任董事之资格，现时亦无任何取消资格令或类似命令对本人生效',
  '本人从未因涉及欺诈、不诚实、贪污或与公司管理有关之行为被裁定罪名成立',
  '本人并非本公司或其任何附属公司之核数师，亦非该核数师事务所之合伙人或雇员',
  '本人具备上市规则第 3.09 条所要求之品格、经验及诚信，并能证明本人具备与职位相称之能力水平',
  '本人明白并接受上市规则第 3.08 条所载董事须履行之受信责任，以及应尽之谨慎、技能及勤勉责任',
  '本人现时并无任何未向本公司董事会披露、而可能构成利益冲突之职务、权益或安排',
];

/**
 * 规格 §8.3.1 · C10c 独立性条款六条（《上市规则》第 3.13 条独立性指引之归纳表述，逐字照抄）。
 *
 * ⚠️ 规格附「对应关系待核」：上列六项系归纳自第 3.13 条 (1)–(8) 项，各条与具体子项之对应关系，
 *    须由公司秘书按启用时之最新版本上市规则逐项核对后定稿。故本组条款设计为**可编辑**字段默认值，
 *    而非写死于 layout（亦为 D1 偏差之业务正当性所在）。
 * @type {string[]}
 */
const INDEPENDENCE_CLAUSES = [
  '本人及本人之紧密联系人于本公司或其任何附属公司之已发行股本中，概无持有 1% 或以上之权益。',
  '本人于紧接委任日期前两年内，并未担任本公司或其任何附属公司之董事、高级管理人员或雇员，亦未提供任何受薪服务。',
  '本人并非本公司任何核心关连人士之董事、合伙人、主要行政人员或雇员，亦非其代表。',
  '除董事袍金及一般董事保险安排外，本人并未从本公司或其任何关连人士收取任何重大财务利益、贷款、担保或补贴。',
  '本人与本公司之任何董事、最高行政人员、控股股东或主要股东，并无重大财务上或家族上之关连。',
  '本人现时并无从事任何与本公司业务构成直接竞争之业务，亦无任何其他可能影响本人独立判断之情况。',
];

/**
 * 规格 §8.3.2 · C16 承诺条款六条（逐字照抄）。
 * 用 `ordered` 而非 `checked`：承诺条款是整体接受（签署即全部承诺），无须逐条勾选。
 * @type {string[]}
 */
const UNDERTAKING_CLAUSES = [
  '本人承诺以本公司整体利益为依归，履行《上市规则》第 3.08 条所载之受信责任，并以合理之谨慎、技能及勤勉程度行事。',
  '本人承诺遵守本公司之组织章程细则、《公司条例》(Cap. 622)、《证券及期货条例》(Cap. 571)、《上市规则》及一切适用之法律法规。',
  '本人承诺遵守《上市规则》附录所载《上市发行人董事进行证券交易的标准守则》，并按规定申报本人于本公司证券之权益及淡仓。',
  '本人承诺在合理可行范围内出席董事会及所属委员会会议，并按《上市规则》之要求参加持续专业发展培训。',
  '本人承诺，一旦发生任何足以影响本人出任董事资格、独立性或本函所载任何确认之真确性之事项，将立即以书面知会本公司公司秘书。',
  '本人承诺配合本公司办理一切与本人获委任有关之法定申报、公告及披露事宜，包括签署联交所所需之董事声明及承诺，并及时提供所需资料。',
];

/** 规格 §8.1 · C22 / meta.archiveNote 共用之存档与后续申报提示（两处措辞不同，勿互换） */
const CLOSING_NOTE =
  '本同意书须于董事委任生效前签妥并交回本公司。公司秘书须于委任生效后 15 日内向香港公司注册处提交 '
  + 'Form ND2A 并更新董事登记册；上市公司另须按上市规则第 13.51(2) 条刊发委任公告，'
  + '并确保获委任人已签署联交所之董事声明及承诺（Declaration and Undertaking，Form B / H / I）。';

/** 规格 C10 · INED 专属章节之显示条件（group 与其内部 heading 一并受控） */
const IS_INED = { op: 'eq', field: 'directorType', value: '独立非执行董事' };

/** @type {Object} preset 定义 */
const directorConsentToAct = {
  presetKey: 'director-consent-to-act',
  name: '同意出任董事函',
  description:
    '获委任人士就出任公司董事作出之书面同意及资格确认（Consent to Act as Director），'
    + '涵盖《公司条例》(Cap. 622) 委任董事之资格要求、上市规则第 3.08 / 3.09 条适格性、'
    + '第 3.13 条独立非执行董事独立性确认，以及个人资料披露同意。',
  category: 'director_change',
  engine: 'schema',
  schemaVersion: SCHEMA_VERSION,
  isPreset: true,
  docSchema: {
    schemaVersion: SCHEMA_VERSION,
    // 🔴 必须显式 'custom'：默认 'auto' 会无视下方 24 个区块，且不报任何错（规格 §9.1 第 5 条）
    layoutMode: 'custom',
    meta: {
      docTitle: '同 意 出 任 董 事 函',
      docSubtitle: 'CONSENT TO ACT AS DIRECTOR — Companies Ordinance (Cap. 622) / Form ND2A',
      companyField: 'companyName',
      headerMeta: {
        // 规格 §8.1：省略 blank，用引擎默认值（BLANK = 8 个全角下划线）
        left: [{ text: '股份代号：' }, { var: 'stockCode' }],
        right: [{ text: '委任生效日期：' }, { var: 'effectiveDate', format: 'date' }],
      },
      fileNamePattern: '{{companyName}}-同意出任董事函-{{effectiveDate}}',
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
      // ② 股份代号（自动带入页眉）
      {
        key: 'stockCode',
        label: '股份代号',
        type: 'text',
        placeholder: '例：01288',
        source: 'company',
        fieldPath: 'stockCode',
      },
      // ③ 获委任人姓名（中文）
      {
        key: 'appointeeName',
        label: '获委任人姓名（中文）',
        type: 'text',
        required: true,
        placeholder: '例：林嘉慧',
        hint: '须与身份证明文件所载姓名完全一致。',
        source: 'manual',
        fieldPath: '',
      },
      // ④ 获委任人姓名（英文）
      {
        key: 'appointeeNameEn',
        label: '获委任人姓名（英文）',
        type: 'text',
        required: true,
        placeholder: '例：LAM Ka Wai, Karen',
        hint: 'Form ND2A 及董事登记册均须载列英文姓名。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑤ 身份证／护照号码（🔴 完整显示、不遮蔽 —— Vincent 已拍板，见文件头注释）
      {
        key: 'idNumber',
        label: '香港身份证／护照号码',
        type: 'text',
        required: true,
        placeholder: '例：K123456(7)',
        hint: '非香港居民请填写护照号码及签发国家。本栏属《个人资料（私隐）条例》(Cap. 486) 项下敏感个人资料，导出件须按机密文件管理。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑥ 获委任董事类别（驱动第三章 INED 独立性确认之显示）
      {
        key: 'directorType',
        label: '获委任董事类别',
        type: 'select',
        required: true,
        options: [...DIRECTOR_TYPES],
        hint: '选择「独立非执行董事」时，将自动展开上市规则第 3.13 条独立性确认章节。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑦ 委任生效日期（页眉、正文、导出文件名三处共用）
      {
        key: 'effectiveDate',
        label: '委任生效日期',
        type: 'date',
        required: true,
        hint: '同意应在委任前作出；如生效日期早于实际签署日，即构成追溯同意，法律效力存疑。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑧ 送达地址（刻意不收集住址，见规格 §8.5）
      {
        key: 'serviceAddress',
        label: '送达地址（Correspondence Address）',
        type: 'textarea',
        required: true,
        placeholder: '例：香港中环德辅道中 100 号 XX 大厦 28 楼 2805 室',
        hint: '须为可送达之实际地址。请勿填写住址 —— 董事住址受新查册安排保护，不对公众开放。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑨ 九项资格确认（规格 §8.2.1）
      {
        key: 'qualificationConfirmations',
        label: '资格确认',
        type: 'checklist',
        required: true,
        default: toCheckItems(QUALIFICATION_TEXTS, false),
        newItemText: '（请填写资格确认事项内容）',
        addLabel: '添加资格确认事项',
        emptyHint: '暂无资格确认事项，请点击「添加」新增。',
        hint: '须由签署人本人逐项确认，不得由公司秘书代为勾选。全数勾选方视为合资格；未全选者须另附书面说明。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑩ 独立性确认（仅 INED 显示；默认 false 使 C10e 分支确定可达）
      {
        key: 'independenceConfirmed',
        label: '已作出上市规则第 3.13 条独立性确认',
        type: 'boolean',
        default: false,
        checkboxLabel: '本人确认符合《上市规则》第 3.13 条所载之全部独立性指引，可作出无保留确认。',
        hint: '如存在须披露之关系而董事会仍认定其属独立，请勿勾选 —— 正文将改用「已另行书面披露」之表述。',
        visibleWhen: IS_INED,
        source: 'manual',
        fieldPath: '',
      },
      // ⑪ 其他上市公司董事职务（上市规则第 13.51(2) 条委任公告素材）
      {
        key: 'otherDirectorships',
        label: '现时及过去三年其他上市公司董事职务',
        type: 'textarea',
        placeholder: '如无请留空，系统将自动生成「并无」声明',
        hint: '供上市规则第 13.51(2) 条委任公告披露之用。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑫ 独立性条款正文（偏差 D1：clauseList 只能绑字段，无法内联 items）
      {
        key: 'independenceClauses',
        label: '独立性确认条款（第 3.13 条）',
        type: 'list',
        default: [...INDEPENDENCE_CLAUSES],
        newItemText: '（请填写独立性确认条款）',
        addLabel: '添加独立性条款',
        emptyHint: '暂无独立性条款，请点击「添加」新增。',
        hint: '默认六条系归纳自《上市规则》第 3.13 条 (1)–(8) 项。首次启用前须由公司秘书对照最新版上市规则逐项核对；一般情况下无须改动。',
        visibleWhen: IS_INED,
        source: 'manual',
        fieldPath: '',
      },
      // ⑬ 承诺条款正文（偏差 D1，同上）
      {
        key: 'undertakings',
        label: '承诺及持续责任条款',
        type: 'list',
        default: [...UNDERTAKING_CLAUSES],
        newItemText: '（请填写承诺条款）',
        addLabel: '添加承诺条款',
        emptyHint: '暂无承诺条款，请点击「添加」新增。',
        hint: '默认六条为标准承诺文本，一般情况下无须改动。',
        source: 'manual',
        fieldPath: '',
      },
      // ⑭ 打印存档说明
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
        default: CLOSING_NOTE,
        source: 'manual',
        fieldPath: '',
        hint: '可修改存档说明文字；取消「打印存档说明」勾选则整行不打印。',
      },
    ],
    // 规格 §8 未定义表单级校验规则：
    //   · `independenceConfirmed` 依 §8.5 刻意保持可选（false 分支为合法业务情形，对应 C10e），故不设必填规则；
    //   · §8.6 风险 8「生效日期早于签署日」需与当日比较，DSL 算子白名单无日期函数，属 UI 层校验，不写入正文。
    rules: [],
    layout: {
      sections: [
        // ══════════════════ C1 · 抬头 ══════════════════
        {
          type: 'paragraph',
          flat: true,
          segments: [
            { text: '致：', bold: true },
            { var: 'companyName' },
            { text: '（「本公司」）董事会' },
          ],
        },
        // ══════════════════ C2 · 敬启者 ══════════════════
        {
          type: 'paragraph',
          flat: true,
          bold: true,
          segments: [{ text: '敬启者：' }],
        },
        // ══════════════════ C3 · 获委任人资料表（六行两列，全部绑真实字段） ══════════════════
        {
          type: 'infoTable',
          rows: [
            { label: '姓名（中文）', value: [{ var: 'appointeeName' }] },
            { label: '姓名（英文）', value: [{ var: 'appointeeNameEn' }] },
            // 🔴 完整显示，不遮蔽（Vincent 已拍板，规格 §8.5）
            { label: '身份证／护照号码', value: [{ var: 'idNumber' }] },
            { label: '获委任职务', value: [{ var: 'directorType' }] },
            { label: '委任生效日期', value: [{ var: 'effectiveDate', format: 'date' }] },
            { label: '送达地址', value: [{ var: 'serviceAddress' }] },
          ],
        },
        // ══════════════════ C4 · 一、同意出任 ══════════════════
        { type: 'heading', text: '同意出任', autoNumber: true },
        // C5 · 两段正文（偏差 D2：透明 group 承载两个 paragraph，顶层仍算一个区块）
        {
          type: 'group',
          children: [
            {
              type: 'paragraph',
              segments: [
                { text: '本人' },
                { var: 'appointeeName' },
                { text: '（' },
                { var: 'appointeeNameEn' },
                { text: '），身份证／护照号码 ' },
                { var: 'idNumber' },
                { text: '，兹此确认本人同意获委任为' },
                { var: 'companyName' },
                { text: '之' },
                { var: 'directorType' },
                { text: '，并自 ' },
                { var: 'effectiveDate', format: 'date' },
                { text: ' 起生效。' },
              ],
            },
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本同意书乃根据香港《公司条例》(Cap. 622) 有关委任董事须事先取得当事人同意之规定，'
                    + '以及《香港联合交易所有限公司证券上市规则》之相关要求而作出，'
                    + '并可由本公司用作向香港公司注册处提交 Form ND2A 之支持文件。',
                },
              ],
            },
          ],
        },
        // ══════════════════ C6 · 二、资格确认 ══════════════════
        { type: 'heading', text: '资格确认', autoNumber: true },
        // C7
        {
          type: 'paragraph',
          segments: [
            { text: '本人谨此逐项确认下列各项于本函签署日及委任生效日均属真实、完整及准确：' },
          ],
        },
        // C8 · 九项资格确认
        {
          type: 'checkList',
          field: 'qualificationConfirmations',
          placeholder: '（尚未设置资格确认事项）',
        },
        // C9
        {
          type: 'note',
          text:
            '上列各项如有任何一项未获勾选，本人已就该项另附书面说明，'
            + '并已向本公司董事会及提名委员会全面披露有关情况。',
        },
        // ══════════════════ C10 · 三、独立性确认（仅 INED，整节条件显示） ══════════════════
        // 🔴 隐藏时其内部 heading 不消耗序号，后续章节自动顺延为「三、四、五」（规格 §8.4.1）
        {
          type: 'group',
          visibleWhen: IS_INED,
          children: [
            // C10a
            { type: 'heading', text: '独立性确认（仅适用于独立非执行董事）', autoNumber: true },
            // C10b
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本人明白本公司拟委任本人为独立非执行董事。'
                    + '参照《上市规则》第 3.13 条所载评估独立性之指引，本人确认下列各项：',
                },
              ],
            },
            // C10c · 六条独立性条款
            {
              type: 'clauseList',
              field: 'independenceClauses',
              variant: 'checked',
              placeholder: '（尚未设置独立性确认条款）',
            },
            // C10d · 可作出无保留确认
            {
              type: 'paragraph',
              visibleWhen: {
                all: [
                  IS_INED,
                  { op: 'eq', field: 'independenceConfirmed', value: true },
                ],
              },
              segments: [
                {
                  text:
                    '据此，本人确认本人符合《上市规则》第 3.13 条所载之独立性指引，属独立于本公司之人士。'
                    + '本人并承诺，一旦本人之独立性状况出现任何变动，'
                    + '本人将立即以书面知会本公司董事会及公司秘书。',
                },
              ],
            },
            // C10e · 未能作出无保留确认
            {
              type: 'paragraph',
              visibleWhen: {
                all: [
                  IS_INED,
                  { op: 'eq', field: 'independenceConfirmed', value: false },
                ],
              },
              segments: [
                {
                  text:
                    '本人未能就上述全部独立性指引作出无保留确认。'
                    + '本人已另行以书面向本公司董事会及提名委员会披露有关情况，'
                    + '并明白本公司须于委任公告中说明董事会认定本人仍属独立之理由。',
                },
              ],
            },
          ],
        },
        // ══════════════════ C11 · 四、其他上市公司董事职务 ══════════════════
        { type: 'heading', text: '其他上市公司董事职务', autoNumber: true },
        // C12 · 有职务：引导句
        {
          type: 'paragraph',
          visibleWhen: { op: 'truthy', field: 'otherDirectorships' },
          segments: [
            { text: '本人现时及于紧接本函日期前三年内，于其他上市公司担任之董事职务如下：' },
          ],
        },
        // C13 · 有职务：正文
        {
          type: 'paragraph',
          visibleWhen: { op: 'truthy', field: 'otherDirectorships' },
          segments: [{ var: 'otherDirectorships' }],
        },
        // C14 · 无职务：自动生成「并无」声明
        {
          type: 'paragraph',
          visibleWhen: { op: 'falsy', field: 'otherDirectorships' },
          segments: [
            { text: '本人现时及于紧接本函日期前三年内，并无于任何其他上市公司担任董事职务。' },
          ],
        },
        // ══════════════════ C15 · 五、承诺及持续责任 ══════════════════
        { type: 'heading', text: '承诺及持续责任', autoNumber: true },
        // C16 · 六条承诺（ordered：整体接受，不逐条勾选）
        {
          type: 'clauseList',
          field: 'undertakings',
          variant: 'ordered',
          placeholder: '（尚未设置承诺条款）',
        },
        // ══════════════════ C17 · 六、个人资料之收集、使用及披露 ══════════════════
        { type: 'heading', text: '个人资料之收集、使用及披露', autoNumber: true },
        // C18 · 两段正文（偏差 D2）
        {
          type: 'group',
          children: [
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本人明白本公司须按《公司条例》(Cap. 622) 备存董事登记册，'
                    + '并须向香港公司注册处处长申报本人之个人资料'
                    + '（包括姓名、送达地址及身份识别号码）；有关资料之若干部分可供公众查阅。',
                },
              ],
            },
            {
              type: 'paragraph',
              segments: [
                {
                  text:
                    '本人同意本公司为履行法定及监管义务'
                    + '（包括向香港公司注册处、香港联合交易所有限公司、'
                    + '香港证券及期货事务监察委员会及本公司核数师作出申报或披露）之目的，'
                    + '收集、持有、处理及披露本人之个人资料。'
                    + '本人明白本人享有《个人资料（私隐）条例》(Cap. 486) 项下查阅及更正个人资料之权利，'
                    + '并可向本公司公司秘书提出有关要求。',
                },
              ],
            },
          ],
        },
        // C19 · 送达地址变更承诺（Form ND2B）
        {
          type: 'paragraph',
          segments: [
            { text: '本人指定之送达地址为：' },
            { var: 'serviceAddress' },
            {
              text:
                '。本人承诺，如该地址有任何变更，将于变更后七日内以书面知会本公司公司秘书，'
                + '以便本公司及时提交 Form ND2B。',
            },
          ],
        },
        // ══════════════════ C20 · 分隔线 ══════════════════
        { type: 'divider' },
        // ══════════════════ C21a · 获委任人签署栏 ══════════════════
        // 偏差 D3：makeSignBlock 只消费 items / note，无 title 属性，故标题行用 bold paragraph 补齐，
        //          并以透明 group 收拢为一个顶层区块，与规格 C21a 一一对应。
        {
          type: 'group',
          children: [
            { type: 'paragraph', flat: true, bold: true, segments: [{ text: '获委任人' }] },
            {
              type: 'signBlock',
              items: [
                // 🔴 纯手签格：必须 { blank: true }，写 { text: '', blank: BLANK } 会被 text 分支吞掉
                { label: '签署', value: [{ blank: true }] },
                { label: '姓名（中文）', value: [{ var: 'appointeeName' }] },
                { label: '姓名（英文）', value: [{ var: 'appointeeNameEn' }] },
                // 签署日期刻意留白：须由签署人亲笔填写实际签署日，系统带入今日会产生证据瑕疵（规格 §9.2）
                { label: '日期', value: [{ blank: true }] },
              ],
            },
          ],
        },
        // ══════════════════ C21b · 见证人签署栏（全部四格纯手签） ══════════════════
        {
          type: 'group',
          children: [
            { type: 'paragraph', flat: true, bold: true, segments: [{ text: '见证人' }] },
            {
              type: 'signBlock',
              items: [
                { label: '见证人签署', value: [{ blank: true }] },
                { label: '见证人姓名', value: [{ blank: true }] },
                { label: '见证人身分／职衔', value: [{ blank: true }] },
                { label: '日期', value: [{ blank: true }] },
              ],
            },
          ],
        },
        // ══════════════════ C21c · 本公司收讫栏（全部三格纯手签） ══════════════════
        {
          type: 'group',
          children: [
            { type: 'paragraph', flat: true, bold: true, segments: [{ text: '本公司收讫' }] },
            {
              type: 'signBlock',
              items: [
                { label: '公司秘书签署', value: [{ blank: true }] },
                { label: '姓名', value: [{ blank: true }] },
                { label: '收件日期', value: [{ blank: true }] },
              ],
            },
          ],
        },
        // ══════════════════ C22 · 后续申报提示 ══════════════════
        {
          type: 'note',
          visibleWhen: { field: 'printArchiveNote', op: 'ne', value: false },
          text: { var: 'archiveNote' },
        },
      ],
    },
  },
  /** 规格 §8.4 对拍基准示例数据（INED 分支，independenceConfirmed = true） */
  sampleData: {
    companyName: '华瑞控股有限公司',
    stockCode: '01288',
    appointeeName: '林嘉慧',
    appointeeNameEn: 'LAM Ka Wai, Karen',
    idNumber: 'K123456(7)',
    directorType: '独立非执行董事',
    effectiveDate: '2026-04-01',
    serviceAddress: '香港中环德辅道中 100 号华瑞商业大厦 28 楼 2805 室',
    qualificationConfirmations: toCheckItems(QUALIFICATION_TEXTS, true),
    independenceConfirmed: true,
    otherDirectorships:
      '现任裕丰国际控股有限公司（股份代号：00987）独立非执行董事，自二零二一年六月起；'
      + '曾于二零二三年一月至二零二五年五月出任明辉科技集团有限公司（股份代号：08123）独立非执行董事。',
    independenceClauses: [...INDEPENDENCE_CLAUSES],
    undertakings: [...UNDERTAKING_CLAUSES],
  },
};

module.exports = directorConsentToAct;
