// 业绩排期引擎（前端 mock 预览专用；规则库真源在后端）：用于生成完整逼真的排期
import { generate as engineGenerate } from './timetableEngine.js'
// 规则库前端副本（AUTO-GENERATED），仅供 mock 模式下的「业绩排期规则库」界面预览
import RULES_MOCK from './timetableData.js'
import generatedPresetData from '../../../shared/templatePresets.generated.json';

// ====== 人员数据 ======
const MOCK_PERSONNEL = [
  {
    _id: 'p1', name: '施金帆', nric: 'P1000001', nationality: '中国',
    address: { country: '中国香港' },
    email: 'shijinfan@example.com', phone: '+852 9000 0001',
  },
  {
    _id: 'p2', name: '施南路', nric: 'P1000002', nationality: '中国',
    address: { country: '中国香港' },
    email: 'shinanlu@example.com', phone: '+852 9000 0002',
  },
  {
    _id: 'p3', name: '施中安 (施侃成)', nric: 'P1000003', nationality: '中国',
    address: { country: '中国' },
    email: 'shizhongan@example.com', phone: '+852 9000 0003',
  },
  {
    _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004', nationality: '中国',
    address: { country: '中国香港' },
    email: 'lincaihe@example.com', phone: '+852 9000 0004',
    notes: '所有5家公司的公司秘书',
  },
  // === CNC 董事 ===
  {
    _id: 'p5', name: '林友耀 (LAM YAU YIU)', nric: 'D308', nationality: '中国',
    address: { country: '中国香港' },
    email: 'LAURENCELAM@HOTMAIL.COM', phone: '+852 9000 0005',
  },
  {
    _id: 'p6', name: '金建榮 (JIN JIANRONG)', nric: 'G3509', nationality: '中国',
    passport: { number: 'G3509', country: 'China' },
    address: { country: '中国' },
    email: 'jinjr@example.com',
  },
  {
    _id: 'p7', name: '袁淵 (YUAN YUAN)', nric: 'E4552', nationality: '中国',
    passport: { number: 'E4552', country: 'China' },
    address: { country: '中国' },
    email: 'YUAN.YUAN.PHD@FOXMAIL.COM',
  },
  {
    _id: 'p8', name: '陳靜 (CHEN JING)', nric: 'P1000008', nationality: '中国',
    address: { country: '中国香港' },
    email: 'chenjing@example.com',
  },
  {
    _id: 'p9', name: '须成发 (XU CHENGFA)', nric: 'P1000009', nationality: '中国',
    address: { country: '中国' },
    email: 'xuchengfa@example.com',
    notes: '独立非执行董事 INED',
  },
  {
    _id: 'p10', name: '施中安 (SHI ZHONGAN)', nric: 'R578', nationality: '中国',
    address: { country: '中国香港' },
    email: 'shizhongan@example.com', phone: '+852 9000 0003',
    notes: '曾用名: 施侃成 (SHI KANCHENG)，中国新城市集团董事会主席',
  },
];

// ====== 公司数据 ======
const MOCK_COMPANIES = [
  // === 运营公司 ===
  {
    _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    incorporationDate: '2017-04-21',
    registeredAddress: { country: '中国香港' },
    shareCapital: { issued: 1, paidUp: 1, currency: 'HKD' },
    compliance: { arDueDate: '2026-04-21', lastArDate: '2026-04-21' },
    links: [
      { _id: 'l1a', linkModel: 'Personnel', link: { _id: 'p1', name: '施金帆', nric: 'P1000001' }, roles: ['director'], appointedDate: '2017-04-21' },
      { _id: 'l1b', linkModel: 'Personnel', link: { _id: 'p2', name: '施南路', nric: 'P1000002' }, roles: ['director'], appointedDate: '2017-04-21' },
      { _id: 'l1c', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary'], appointedDate: '2017-04-21' },
      { _id: 'l1d', linkModel: 'Company', link: { _id: 'c6', name: 'Easy Success Investments Ltd (BVI)', registrationNumber: 'N/A' }, roles: ['shareholder'], shares: 1, shareType: 'ordinary', appointedDate: '2017-04-21' },
    ],
  },
  {
    _id: 'c2', name: 'Zhong An Travel Ltd (眾安旅遊)', registrationNumber: '69459923',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    incorporationDate: '2018-09-28',
    registeredAddress: { country: '中国香港' },
    shareCapital: { issued: 1, paidUp: 1, currency: 'HKD' },
    compliance: { arDueDate: '2026-09-28', lastArDate: '2026-04-03' },
    links: [
      { _id: 'l2a', linkModel: 'Personnel', link: { _id: 'p2', name: '施南路', nric: 'P1000002' }, roles: ['director'], appointedDate: '2018-09-28' },
      { _id: 'l2b', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary'], appointedDate: '2018-09-28' },
      { _id: 'l2c', linkModel: 'Company', link: { _id: 'c7', name: 'Beyond Horizon Investments Ltd (BVI)', registrationNumber: 'N/A' }, roles: ['shareholder'], shares: 1, shareType: 'ordinary', appointedDate: '2018-09-28' },
    ],
  },
  {
    _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    incorporationDate: '2010-05-14',
    registeredAddress: { country: '中国香港' },
    shareCapital: { issued: 1, paidUp: 1, currency: 'HKD' },
    compliance: { arDueDate: '2026-05-14', lastArDate: '2026-04-03' },
    links: [
      { _id: 'l3a', linkModel: 'Personnel', link: { _id: 'p3', name: '施中安 (施侃成)', nric: 'P1000003' }, roles: ['director'], appointedDate: '2010-05-14' },
      { _id: 'l3b', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary'], appointedDate: '2010-05-14' },
      { _id: 'l3c', linkModel: 'Company', link: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, roles: ['shareholder'], shares: 1, shareType: 'ordinary', appointedDate: '2010-05-14' },
    ],
  },
  {
    _id: 'c4', name: 'Hong Kong Time Honour Property Ltd (香港時駿地産)', registrationNumber: '63822186',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    incorporationDate: '2021-12-14',
    registeredAddress: { country: '中国香港' },
    shareCapital: { issued: 1, paidUp: 1, currency: 'HKD' },
    compliance: { arDueDate: '2026-12-14', lastArDate: '2025-12-04' },
    links: [
      { _id: 'l4a', linkModel: 'Personnel', link: { _id: 'p2', name: '施南路', nric: 'P1000002' }, roles: ['director'], appointedDate: '2021-12-14' },
      { _id: 'l4b', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary'], appointedDate: '2021-12-14' },
      { _id: 'l4c', linkModel: 'Company', link: { _id: 'c9', name: 'Time Honour Global Ltd (BVI)', registrationNumber: 'N/A' }, roles: ['shareholder'], shares: 1, shareType: 'ordinary', appointedDate: '2021-12-14' },
    ],
  },
  {
    _id: 'c5', name: 'Pannix Industrial (Hong Kong) Ltd (佳穎實業)', registrationNumber: '63822047',
    type: 'private_limited', status: 'active', jurisdiction: 'HK',
    incorporationDate: '2021-12-14',
    registeredAddress: { country: '中国香港' },
    shareCapital: { issued: 1, paidUp: 1, currency: 'HKD' },
    compliance: { arDueDate: '2026-12-14', lastArDate: '2025-12-02' },
    links: [
      { _id: 'l5a', linkModel: 'Personnel', link: { _id: 'p2', name: '施南路', nric: 'P1000002' }, roles: ['director'], appointedDate: '2021-12-14' },
      { _id: 'l5b', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary'], appointedDate: '2021-12-14' },
      { _id: 'l5c', linkModel: 'Company', link: { _id: 'c10', name: 'First Achiever Holdings Ltd (BVI)', registrationNumber: 'N/A' }, roles: ['shareholder'], shares: 1, shareType: 'ordinary', appointedDate: '2021-12-14' },
    ],
  },
  // === 持股公司（开曼/BVI） ===
  { _id: 'c6', name: 'Easy Success Investments Ltd (BVI)', registrationNumber: 'N/A', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { _id: 'c7', name: 'Beyond Horizon Investments Ltd (BVI)', registrationNumber: 'N/A', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  {
    _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234',
    type: 'public_limited', status: 'active', jurisdiction: 'Cayman',
    incorporationDate: '2013-11-01',
    stockCode: '1321.HK', isListed: true,
    registeredAddress: { country: 'Cayman Islands', fullAddress: 'Cricket Square, Hutchins Drive, P.O. Box 2681, Grand Cayman, KY1-1111' },
    hkAddress: '香港湾仔港湾道26号华润大厦40楼4010室',
    email: 'LYDIASO@CHINANEWCITY.COM.CN', phone: '+852',
    shareCapital: { issued: 100000000, paidUp: 100000000, currency: 'HKD' },
    compliance: { arDueDate: '2026-11-01', lastArDate: '2025-11-01' },
    links: [
      { _id: 'lc1', linkModel: 'Personnel', link: { _id: 'p10', name: '施中安 (SHI ZHONGAN)', nric: 'R578' }, roles: ['director'], appointedDate: '2024-06-28' },
      { _id: 'lc2', linkModel: 'Personnel', link: { _id: 'p2', name: '施南路 (SHI NANLU)', nric: 'P1000002' }, roles: ['director'], appointedDate: '2024-06-28' },
      { _id: 'lc3', linkModel: 'Personnel', link: { _id: 'p6', name: '金建榮 (JIN JIANRONG)', nric: 'G3509' }, roles: ['director'], appointedDate: '2021-07-02' },
      { _id: 'lc4', linkModel: 'Personnel', link: { _id: 'p5', name: '林友耀 (LAM YAU YIU)', nric: 'D308' }, roles: ['director'], appointedDate: '2021-06-18' },
      { _id: 'lc5', linkModel: 'Personnel', link: { _id: 'p7', name: '袁淵 (YUAN YUAN)', nric: 'E4552' }, roles: ['director'], appointedDate: '2024-06-28' },
      { _id: 'lc6', linkModel: 'Personnel', link: { _id: 'p8', name: '陳靜 (CHEN JING)', nric: 'P1000008' }, roles: ['director'], appointedDate: '2024-06-28' },
      { _id: 'lc7', linkModel: 'Personnel', link: { _id: 'p4', name: '林才賀 (LIN CAI HE)', nric: 'P1000004' }, roles: ['secretary', 'authorized_representative'], appointedDate: '2020-06-24' },
      { _id: 'lc8', linkModel: 'Company', link: { _id: 'c12', name: 'Conyers Trust Company (Cayman) Ltd', registrationNumber: 'N/A' }, roles: ['corporate_secretary'], appointedDate: '2020-06-24' },
    ],
  },
  { _id: 'c9', name: 'Time Honour Global Ltd (BVI)', registrationNumber: 'N/A', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { _id: 'c10', name: 'First Achiever Holdings Ltd (BVI)', registrationNumber: 'N/A', type: 'private_limited', status: 'active', jurisdiction: 'BVI', links: [] },
  { _id: 'c12', name: 'Conyers Trust Company (Cayman) Ltd', registrationNumber: 'N/A', type: 'service_provider', status: 'active', jurisdiction: 'Cayman', links: [] },
];

// 全量公司 ID —— 用于给演示账号授予"全部公司"范围（避免默认 demo 账号全站空白）
const ALL_COMPANY_IDS = MOCK_COMPANIES.map(c => c._id);

// ====== 文档数据（含文档编号 + 分类，支撑编档/批量下载） ======
// 编号规则：<分类前缀>-<公司简称(注册号后4位)>-<年份>-<类型缩写>-<序号>
//   GOV=政府往来  EST=设立文件  FIN=财务税务  BNK=银行文件  MTG=会议文件  OTH=其他
//   公司简称取注册号后4位（无公司用 P+姓名首字母）
// 例：GOV-0948-2026-NAR1-001 → Easy Rich(...0948) 2026年 周年申报表 第1号
const MOCK_DOCUMENTS = [
  { _id: 'd1', docNumber: 'GOV-NAR1-0001', name: 'NAR1 周年申报表 2026', type: 'return', category: 'government', company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' }, personnel: null, fileUrl: '/docs/EasyRich_NAR1_2026.pdf', fileName: 'NAR1 - Easy Rich Corporation Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-04-21' },
  { _id: 'd2', docNumber: 'GOV-NAR1-0002', name: 'NAR1 周年申报表 2026', type: 'return', category: 'government', company: { _id: 'c2', name: 'Zhong An Travel Ltd (眾安旅遊)', registrationNumber: '69459923' }, personnel: null, fileUrl: '/docs/ZhongAn_NAR1_2026.pdf', fileName: 'NAR1- Zhong An Travel Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-06-10' },
  { _id: 'd3', docNumber: 'GOV-NAR1-0003', name: 'NAR1 周年申报表 2026', type: 'return', category: 'government', company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857' }, personnel: null, fileUrl: '/docs/Huijun_NAR1_2026.pdf', fileName: 'NAR1 - HuiJun (International) Holdings Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-06-10' },
  { _id: 'd4', docNumber: 'GOV-NAR1-0004', name: 'NAR1 周年申报表 2025', type: 'return', category: 'government', company: { _id: 'c4', name: 'Hong Kong Time Honour Property Ltd (香港時駿地産)', registrationNumber: '63822186' }, personnel: null, fileUrl: '/docs/TimeHonour_NAR1_2025.pdf', fileName: 'NAR1 - Hong Kong Time Honour Property Ltd 2025.pdf', fileSize: 512000, createdAt: '2025-12-04' },
  { _id: 'd5', docNumber: 'GOV-NAR1-0005', name: 'NAR1 周年申报表 2025', type: 'return', category: 'government', company: { _id: 'c5', name: 'Pannix Industrial (Hong Kong) Ltd (佳穎實業)', registrationNumber: '63822047' }, personnel: null, fileUrl: '/docs/Pannix_NAR1_2025.pdf', fileName: 'NAR1 - Pannix Industrial (Hong Kong) Limited 2025.pdf', fileSize: 512000, createdAt: '2025-12-02' },
  // 个人证件文档
  { _id: 'd6', docNumber: 'OTH-ID-0006', name: '施金帆 — 香港身份证', type: 'id_document', category: 'other', company: null, personnel: { _id: 'p1', name: '施金帆' }, scope: 'person', fileUrl: '', fileName: 'shijinfan_id.pdf', fileSize: 256000, createdAt: '2025-01-01', expiresAt: '2027-05-10' },
  { _id: 'd7', docNumber: 'OTH-PP-0007', name: '施南路 — 护照复印件', type: 'passport', category: 'other', company: null, personnel: { _id: 'p2', name: '施南路' }, scope: 'person', fileUrl: '', fileName: 'shinanlu_passport.pdf', fileSize: 256000, createdAt: '2025-01-01', expiresAt: '2026-07-20' },
  { _id: 'd8', docNumber: 'OTH-ID-0008', name: '施中安 — 香港身份证', type: 'id_document', category: 'other', company: null, personnel: { _id: 'p3', name: '施中安 (施侃成)' }, scope: 'person', fileUrl: '', fileName: 'shizhongan_id.pdf', fileSize: 256000, createdAt: '2025-01-01', expiresAt: '2026-07-10' },
  { _id: 'd9', docNumber: 'OTH-NRIC-0009', name: '林才賀 — NRIC副本', type: 'id_document', category: 'other', company: null, personnel: { _id: 'p4', name: '林才賀 (LIN CAI HE)' }, scope: 'person', fileUrl: '', fileName: 'lincaihe_nric.pdf', fileSize: 256000, createdAt: '2025-01-01', expiresAt: '2026-08-01' },
  // CNC 文档
  { _id: 'd10', docNumber: 'GOV-NN3-0010', name: 'NAR1 NN3 周年申报表 2025', type: 'return', category: 'government', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_NAR1_NN3_2025.pdf', fileSize: 1024000, createdAt: '2025-11-01', notes: '注册非香港公司周年申报表' },
  { _id: 'd11', docNumber: 'EST-COI-0011', name: 'Certificate of Incumbency 2026-01-08', type: 'certificate', category: 'establishment', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_COI_20260108.pdf', fileSize: 512000, createdAt: '2026-01-08', notes: '在职证明', expiresAt: '2027-01-08' },
  { _id: 'd12', docNumber: 'EST-CGS-0012', name: 'Certificate of Good Standing 2026-01-07', type: 'certificate', category: 'establishment', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_CGS_20260107.pdf', fileSize: 512000, createdAt: '2026-01-07', notes: '存续证明 / 良好存续证书', expiresAt: '2026-12-07' },
  // v5.2 模块1 演示：会议暂存文件（staged=true）→ 仅停留在会议视图，归档后进入公司库
  { _id: 'd13', docNumber: 'MET-MIN-0013', name: '中国新城市集团2025年度董事会会议纪要（草稿）', type: 'minutes', category: 'meeting', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, meeting: { _id: 'm3' }, personnel: null, fileUrl: '', fileName: 'CNC_2025_board_minutes_draft.pdf', fileSize: 320000, createdAt: '2026-03-26', staged: true, source: { kind: 'meeting_minutes', refId: 'm3', label: '来自 [2026-03-26 董事会纪要]' } },
  { _id: 'd14', docNumber: 'MET-SIG-0014', name: '中国新城市集团2025年度董事会纪要签字版扫描件', type: 'minutes', category: 'meeting', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, meeting: { _id: 'm3' }, personnel: null, fileUrl: '', fileName: 'CNC_2025_board_minutes_signed_scan.pdf', fileSize: 480000, createdAt: '2026-03-28', staged: true, signStatus: 'fully_signed', source: { kind: 'signing_scan', refId: 'm3', label: '来自 [2026-03-26 董事会纪要]' } },
];

// ====== 会议数据 ======
const MOCK_MEETINGS = [
  {
    _id: 'm1', title: 'Easy Rich 2026年周年股东大会', type: 'agm', status: 'scheduled', phase: 'notice-sent',
    scheduledAt: '2026-07-15T10:00:00+08:00', scheduledEndAt: '2026-07-15T12:00:00+08:00', duration: 120,
    location: '香港', isVirtual: true,
    meetingId: '535-254-534', meetingLink: 'https://meeting.tencent.com/535-254-534', meetingPassword: '0715',
    company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' },
    attendees: [
      { _id: 'a1', refModel: 'Personnel', ref: { _id: 'p1', name: '施金帆' }, name: '施金帆', role: '董事', status: 'accepted' },
      { _id: 'a2', refModel: 'Personnel', ref: { _id: 'p2', name: '施南路' }, name: '施南路', role: '董事', status: 'accepted' },
      { _id: 'a3', refModel: 'Personnel', ref: { _id: 'p4', name: '林才賀' }, name: '林才賀', role: '公司秘书', status: 'accepted' },
    ],
    agenda: [
      { item: '审阅及通过2025年度财务报告', presenter: '施金帆' },
      { item: '重选退任董事', presenter: '林才賀' },
      { item: '续聘核数师', presenter: '施南路' },
    ],
    notice: {
      greeting: '尊敬的各位董事',
      signOff: '请准时参加，如有问题请随时与我沟通，谢谢。',
    },
  },
  {
    _id: 'm2', title: '匯駿控股 2026年度董事会', type: 'board', status: 'scheduled', phase: 'notice-sent',
    scheduledAt: '2026-08-01T14:00:00+08:00', scheduledEndAt: '2026-08-01T15:30:00+08:00', duration: 90,
    isVirtual: true,
    meetingId: '888-777-666', meetingLink: 'https://meeting.tencent.com/888-777-666',
    company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857' },
    attendees: [
      { _id: 'b1', refModel: 'Personnel', ref: { _id: 'p3', name: '施中安' }, name: '施中安 (施侃成)', role: '董事会主席', status: 'accepted' },
      { _id: 'b2', refModel: 'Personnel', ref: { _id: 'p4', name: '林才賀' }, name: '林才賀', role: '公司秘书', status: 'accepted' },
    ],
    agenda: [
      { item: '审议2026年上半年业务报告', presenter: '施中安' },
      { item: '讨论投资策略调整', presenter: '林才賀' },
    ],
  },
  // === CNC 2026-03-26 年度董事会（已完成 + 纪要） ===
  {
    _id: 'm3', title: '中国新城市集团2025年度董事会会议', type: 'board', status: 'completed', phase: 'minutes-signed',
    scheduledAt: '2026-03-26T10:20:00+08:00', scheduledEndAt: '2026-03-26T12:00:00+08:00', duration: 100,
    location: '杭州市萧山区山阴路688号众安集团11楼11-1会议室', isVirtual: false,
    company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' },
    attendees: [
      { _id: 'mc1', refModel: 'Personnel', ref: { _id: 'p10', name: '施中安' }, name: '施中安 (SHI ZHONGAN)', role: '董事会主席 · 非执行董事', status: 'attended' },
      { _id: 'mc2', refModel: 'Personnel', ref: { _id: 'p2', name: '施南路' }, name: '施南路 (SHI NANLU)', role: '执行董事 · 总裁', status: 'attended' },
      { _id: 'mc3', refModel: 'Personnel', ref: { _id: 'p6', name: '金建榮' }, name: '金建榮 (JIN JIANRONG)', role: '执行董事', status: 'attended' },
      { _id: 'mc4', refModel: 'Personnel', ref: { _id: 'p8', name: '陳靜' }, name: '陳靜 (CHEN JING)', role: '执行董事', status: 'attended' },
      { _id: 'mc5', refModel: 'Personnel', ref: { _id: 'p9', name: '须成发' }, name: '须成发 (XU CHENGFA)', role: '独立非执行董事', status: 'attended' },
      { _id: 'mc6', refModel: 'Personnel', ref: { _id: 'p5', name: '林友耀' }, name: '林友耀 (LAM YAU YIU)', role: '独立非执行董事', status: 'attended' },
      { _id: 'mc7', refModel: 'Personnel', ref: { _id: 'p7', name: '袁淵' }, name: '袁淵 (YUAN YUAN)', role: '独立非执行董事', status: 'attended' },
      { _id: 'mc8', name: '林才賀 (LIN CAI HE)', role: '公司秘书 · 列席', status: 'attended' }, // ad-hoc
    ],
    agenda: [
      { item: '上次董事会会议需跟进事项', presenter: '全体董事' },
      { item: '审核委员会会议需跟进事项', presenter: '林友耀' },
      { item: '企业管治委员会会议需跟进事项', presenter: '施南路' },
      { item: '提名委员会会议需跟进事项', presenter: '须成发' },
      { item: '薪酬委员会会议需跟进事项', presenter: '须成发' },
      { item: '末期股息决议', presenter: '董事会' },
      { item: '暂停办理股份过户手续', presenter: '公司秘书' },
      { item: '检讨风险管理及内部监控系统', presenter: '审核委员会' },
      { item: '审批年报、年度业绩公告及ESG报告', presenter: '董事会' },
      { item: '续聘核数师', presenter: '审核委员会' },
      { item: '股东周年大会及股东通函', presenter: '公司秘书' },
      { item: '退任董事之重选及董事薪酬', presenter: '提名委员会' },
      { item: '年度经营汇报及2026年度经营政策', presenter: '管理层' },
      { item: '下次董事会议安排', presenter: '董事会主席' },
    ],
    resolutions: [
      { title: '不派发末期股息', status: 'approved' },
      { title: '续聘安永会计师事务所为核数师', status: 'approved' },
      { title: '批准年度业绩公告、年报及ESG报告', status: 'approved' },
      { title: '授予董事会一般授权（配发20%+回购10%）', status: 'approved' },
      { title: '2026年6月4日举行股东周年大会', status: 'approved' },
      { title: '金建榮、须成发、陳靜退任重选', status: 'approved' },
    ],
    notice: {
      greeting: '尊敬的各位董事',
      signOff: '请准时参加，如有问题请随时与公司秘书林才贺先生联系，谢谢。',
      sentAt: '2026-03-10T00:00:00+08:00',
    },
    minutes: {
      status: 'signed',
      draftedAt: '2026-03-27T10:00:00+08:00',
      signedAt: '2026-03-28T14:00:00+08:00',
    },
    signatures: [
      { _id: 'sig1', name: '施中安 (SHI ZHONGAN)', title: '会议主席 · 董事会主席', status: 'signed', signedAt: '2026-03-28T14:00:00+08:00' },
    ],
    documents: [],
  },
  // === CNC 2026-06-03 临时董事会（已通知） ===
  {
    _id: 'm4', title: '中国新城市集团临时董事会 — 审议新股配发', type: 'board', status: 'scheduled', phase: 'notice-sent',
    scheduledAt: '2026-06-03T16:30:00+08:00', scheduledEndAt: '2026-06-03T16:50:00+08:00', duration: 20,
    isVirtual: true, location: '腾讯视频会议',
    meetingId: '145-940-978', meetingLink: 'https://meeting.tencent.com/dm/wbu3MdyuXbDX', meetingPassword: '0603',
    company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' },
    attendees: [
      { _id: 'md1', refModel: 'Personnel', ref: { _id: 'p10', name: '施中安' }, name: '施中安 (SHI ZHONGAN)', role: '董事会主席 · 非执行董事', status: 'accepted' },
      { _id: 'md2', refModel: 'Personnel', ref: { _id: 'p2', name: '施南路' }, name: '施南路 (SHI NANLU)', role: '执行董事 · 总裁', status: 'accepted' },
      { _id: 'md3', refModel: 'Personnel', ref: { _id: 'p6', name: '金建榮' }, name: '金建榮 (JIN JIANRONG)', role: '执行董事', status: 'accepted' },
      { _id: 'md4', refModel: 'Personnel', ref: { _id: 'p8', name: '陳靜' }, name: '陳靜 (CHEN JING)', role: '执行董事', status: 'accepted' },
      { _id: 'md5', refModel: 'Personnel', ref: { _id: 'p9', name: '须成发' }, name: '须成发 (XU CHENGFA)', role: '独立非执行董事', status: 'pending' },
      { _id: 'md6', refModel: 'Personnel', ref: { _id: 'p5', name: '林友耀' }, name: '林友耀 (LAM YAU YIU)', role: '独立非执行董事', status: 'pending' },
      { _id: 'md7', refModel: 'Personnel', ref: { _id: 'p7', name: '袁淵' }, name: '袁淵 (YUAN YUAN)', role: '独立非执行董事', status: 'pending' },
    ],
    agenda: [
      { item: '审议及批准依据一般授权（General Mandate）配发新股', presenter: '董事会' },
      { item: '审议及批准股份认购协议及上市申请', presenter: '董事会' },
      { item: '审议及批准与众安集团（672.HK）联合刊发公告', presenter: '公司秘书' },
    ],
    notice: {
      greeting: '尊敬的各位董事',
      signOff: '若有任何问题可随时联系本人，非常感谢。',
      customNote: '根据《上市规则》及公司章程，兹定于北京时间2026年6月3日（星期三）召开中国城市集团有限公司（1321.HK）临时董事会会议，审议一般授权下之新股配发事项。',
      sentAt: '2026-05-25T09:00:00+08:00',
    },
  },
];

// ====== 统计 ======
const STATS = {
  totalCompanies: MOCK_COMPANIES.length,
  totalPersonnel: MOCK_PERSONNEL.length,
  totalDocuments: MOCK_DOCUMENTS.length,
  totalMeetings: MOCK_MEETINGS.length,
  activeCompanies: MOCK_COMPANIES.filter(c => c.status === 'active').length,
  compliance: {
    upcoming: { agm: 1, ar: 1 },
    overdue: { agm: 0, ar: 0 },
  },
};

// ====== 辅助函数 ======
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

function findCompany(id) { return MOCK_COMPANIES.find(c => c._id === id); }
function findPerson(id) { return MOCK_PERSONNEL.find(p => p._id === id); }

// 从 Company.links 反查某人担任的角色（方案甲：Company.links 为权威存储）
function deriveRoles(personId) {
  const roles = new Set();
  MOCK_COMPANIES.forEach(c => (c.links || []).forEach(l => {
    if (l.linkModel === 'Personnel' && l.link?._id === personId) (l.roles || []).forEach(r => roles.add(r));
  }));
  return [...roles];
}

// ====== 导出 ======
export const DEMO_USER = {
  id: 'u1', name: 'Alice Chen', email: 'alice@example.com', role: 'secretary', token: 'demo-token-xxx',
};
export { MOCK_COMPANIES as DEMO_COMPANIES, MOCK_PERSONNEL as DEMO_PERSONNEL, MOCK_DOCUMENTS as DEMO_DOCUMENTS, MOCK_MEETINGS as DEMO_MEETINGS, STATS as DEMO_STATS };

// ====== Users Service (Admin — mock) ======
// 数据范围（accessibleCompanies）在 mock 模式下持久化到 localStorage，
// 这样管理后台「数据权限」里分配的范围刷新后仍然生效。
const SCOPE_KEY = 'csms.mock.userScopes';

function loadScopeOverrides() {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveScopeOverride(id, ids) {
  try {
    const all = loadScopeOverrides();
    all[id] = Array.isArray(ids) ? ids : [];
    localStorage.setItem(SCOPE_KEY, JSON.stringify(all));
  } catch { /* localStorage 不可用时静默降级为内存态 */ }
}

// 演示账号密码表（与 AuthContext 的 DEMO_ACCOUNTS 一致）
const PASSWORDS = {
  'admin@example.com': 'admin123',
  'demo@example.com': 'demo123',
  'manager@example.com': 'manager123',
  'viewer@example.com': 'viewer123',
  'auditor@example.com': 'auditor123',
};

// 三态语义：admin/auditor 行级豁免（accessibleCompanies 取值不影响可见性）；
// manager 受限 c1/c2；viewer 受限 c3（演示"另一套范围"）；demo(secretary) 授予全部公司。
const BASE_USERS = [
  { _id: 'u1', name: 'Admin User',      email: 'admin@example.com',   role: 'admin',     isActive: true, joined: '2024-01-01', accessibleCompanies: [] },
  { _id: 'u2', name: 'Sarah Manager',   email: 'manager@example.com', role: 'manager',   isActive: true, joined: '2024-03-15', accessibleCompanies: ['c1', 'c2'] },
  { _id: 'u3', name: 'View Only',       email: 'viewer@example.com',  role: 'viewer',    isActive: true, joined: '2024-06-20', accessibleCompanies: ['c3'] },
  { _id: 'u4', name: 'Audit Only',      email: 'auditor@example.com', role: 'auditor',   isActive: true, joined: '2024-07-01', accessibleCompanies: [] },
  { _id: 'u5', name: 'Demo Secretary',  email: 'demo@example.com',    role: 'secretary', isActive: true, joined: '2024-02-01', accessibleCompanies: ALL_COMPANY_IDS },
];

let MOCK_USERS = BASE_USERS.map(u => {
  const ov = loadScopeOverrides()[u._id];
  return { ...u, accessibleCompanies: ov ?? u.accessibleCompanies };
});

/** 按邮箱取 mock 用户（含 accessibleCompanies），供 AuthContext 复用 */
export function getMockUserByEmail(email) {
  return MOCK_USERS.find(u => u.email === email) || null;
}

/** 演示账号切换清单（Navbar 下拉用） */
export const MOCK_DEMO_ACCOUNTS = [
  { email: 'admin@example.com',   password: PASSWORDS['admin@example.com'],   label: 'Admin User · 全部数据' },
  { email: 'demo@example.com',    password: PASSWORDS['demo@example.com'],    label: 'Demo Secretary · 全部公司' },
  { email: 'manager@example.com', password: PASSWORDS['manager@example.com'], label: 'Sarah Manager · c1/c2' },
  { email: 'viewer@example.com',  password: PASSWORDS['viewer@example.com'],  label: 'View Only · c3' },
];

// ====== Auth Service ======
export const auth = {
  login: async (email, password) => {
    await delay(100);
    const u = getMockUserByEmail(email);
    if (!u || PASSWORDS[email] !== password) {
      const err = new Error('Invalid credentials');
      err.response = { data: { message: 'Invalid credentials' } };
      throw err;
    }
    return { data: { data: { ...u, id: u._id, token: 'demo-token-xxx' } } };
  },
  register: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  getMe: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  updateProfile: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  updatePassword: async () => { await delay(); return { data: { data: { token: 'new-token' } } }; },
};

export const users = {
  getAll: async () => { await delay(80); return { data: { data: MOCK_USERS.map(u => ({ ...u })) } }; },
  create: async (data) => {
    await delay(120);
    const u = { _id: 'u' + Date.now(), name: data.name, email: data.email, role: data.role || 'viewer', isActive: data.isActive !== false, joined: new Date().toISOString().slice(0, 10) };
    MOCK_USERS = [...MOCK_USERS, u];
    return { data: { data: { ...u } } };
  },
  update: async (id, data) => {
    await delay(120);
    MOCK_USERS = MOCK_USERS.map(u => u._id === id ? { ...u, ...data, _id: u._id } : u);
    // 数据范围变更持久化，刷新后不丢
    if (Array.isArray(data.accessibleCompanies)) saveScopeOverride(id, data.accessibleCompanies);
    const updated = MOCK_USERS.find(u => u._id === id);
    return { data: { data: { ...updated } } };
  },
  remove: async (id) => {
    await delay(120);
    MOCK_USERS = MOCK_USERS.filter(u => u._id !== id);
    return { data: { data: { success: true } } };
  },
};

// ====== Audit Log Service (Wave 0 rev2) ======
let MOCK_AUDIT = [
  { _id: 'a1', actorName: 'Admin User', action: 'archive', entityType: 'Meeting', entityId: 'm1', detail: '归档会议「2026-07-10 董事会例會」· Easy Rich Corporation Ltd', createdAt: '2026-07-18T09:30:00.000Z' },
  { _id: 'a2', actorName: 'Admin User', action: 'lock', entityType: 'Document', entityId: 'd1', detail: '锁定文档「公司章程 2026」· Easy Rich Corporation Ltd', createdAt: '2026-07-18T09:31:00.000Z' },
  { _id: 'a3', actorName: 'Admin User', action: 'assign_scope', entityType: 'User', entityId: 'u2', detail: '为用户「Sarah Manager」分配 2 家可访问公司', createdAt: '2026-07-19T14:05:00.000Z' },
];
export const audit = {
  getAll: async (filters = {}) => {
    await delay(80);
    let list = [...MOCK_AUDIT];
    if (filters.action) list = list.filter(a => a.action === filters.action);
    if (filters.entityType) list = list.filter(a => a.entityType === filters.entityType);
    return { data: { data: list, total: list.length } };
  },
  // 演示用：归档/锁定动作发生时追加一条（供前端审计 Tab 即时刷新）
  push: async (entry) => { await delay(20); MOCK_AUDIT = [{ _id: 'a' + Date.now(), createdAt: new Date().toISOString(), ...entry }, ...MOCK_AUDIT]; return { data: { data: MOCK_AUDIT[0] } }; },
};

// ====== Companies Service ======
export const companies = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_COMPANIES];
    if (filters.search) list = list.filter(c => c.name.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.status) list = list.filter(c => c.status === filters.status);
    if (filters.type) list = list.filter(c => c.type === filters.type);
    if (filters.jurisdiction) list = list.filter(c => c.jurisdiction === filters.jurisdiction);
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
  },
  // Helper: resolve link references to latest personnel/company data
  _resolveLinks: (company) => {
    const c = JSON.parse(JSON.stringify(company)); // deep clone
    (c.links || []).forEach(link => {
      if (link.linkModel === 'Personnel' && link.link?._id) {
        const p = MOCK_PERSONNEL.find(pp => pp._id === link.link._id);
        if (p) link.link = { ...p };
      } else if (link.linkModel === 'Company' && link.link?._id) {
        const cc = MOCK_COMPANIES.find(cc => cc._id === link.link._id);
        if (cc) link.link = { ...cc };
      }
    });
    return c;
  },
  getOne: async (id) => {
    await delay();
    const c = findCompany(id);
    if (!c) return { data: { data: MOCK_COMPANIES[0] } };
    return { data: { data: companies._resolveLinks(c) } };
  },
  create: async (data) => {
    await delay();
    const neu = { _id: 'c' + Date.now(), ...data, links: [], createdBy: DEMO_USER };
    MOCK_COMPANIES.push(neu);
    return { data: { data: neu } };
  },
  update: async (id, data) => {
    await delay();
    const idx = MOCK_COMPANIES.findIndex(c => c._id === id);
    if (idx >= 0) { MOCK_COMPANIES[idx] = { ...MOCK_COMPANIES[idx], ...data }; return { data: { data: MOCK_COMPANIES[idx] } }; }
    throw new Error('Not found');
  },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  // Dashboard 统计 —— 直接取自各集合数组，确保与列表页计数口径完全一致
  getDashboardStats: async () => {
    await delay(50);
    const [cRes, pRes, dRes, mRes] = await Promise.all([
      companies.getAll(), personnel.getAll(), documents.getAll(), meetings.getAll(),
    ]);
    const companies = cRes.data.data || [];
    return {
      data: {
        data: {
          totalCompanies: companies.length,
          activeCompanies: companies.filter(c => c.status === 'active').length,
          totalPersonnel: pRes.data.data?.length || 0,
          totalDocuments: dRes.data.data?.length || 0,
          totalMeetings: mRes.data.data?.length || 0,
        },
      },
    };
  },

  // ====== 统一关联 CRUD（读时聚合：Company.links 为唯一事实源） ======
  // 新增关联：可连 Personnel(个人) 或 Company(公司型股东)；若填写了新人员姓名会自动建 Personnel 记录
  // 注意：不物化 Personnel.appointments —— 人视角公司列表由 getReverseLinks 读时从 Company.links 聚合
  addLink: async (companyId, payload) => {
    await delay();
    const c = findCompany(companyId);
    if (!c) throw new Error('Company not found');
    if (!c.links) c.links = [];
    const link = {
      _id: 'l' + Date.now() + Math.floor(Math.random() * 1000),
      linkModel: payload.linkModel || 'Personnel',
      link: payload.link || {},
      roles: payload.roles || ['director'],
      shares: payload.shares,
      shareType: payload.shareType,
      appointmentDate: payload.appointmentDate,
      ceasedDate: payload.ceasedDate,
      notes: payload.notes,
    };
    // 关联个人但库中无对应记录 → 自动创建 Personnel（保持单一人员来源）
    if (link.linkModel === 'Personnel' && (!link.link._id || !findPerson(link.link._id))) {
      const np = {
        _id: 'p' + Date.now(),
        name: link.link.name || '未命名',
        nric: link.link.nric || '',
        nationality: link.link.nationality || '',
      };
      MOCK_PERSONNEL.push(np);
      link.link = { _id: np._id, name: np.name, nric: np.nric };
    }
    c.links.push(link);
    // 读时聚合：不物化 Personnel.appointments。人视角公司列表由 getReverseLinks 从 Company.links 聚合。
    return { data: { data: companies._resolveLinks(c) } };
  },
  updateLink: async (companyId, linkId, payload) => {
    await delay();
    const c = findCompany(companyId);
    if (!c) throw new Error('Company not found');
    const link = (c.links || []).find(l => l._id === linkId);
    if (!link) throw new Error('Link not found');
    Object.assign(link, {
      roles: payload.roles !== undefined ? payload.roles : link.roles,
      shares: payload.shares !== undefined ? payload.shares : link.shares,
      shareType: payload.shareType !== undefined ? payload.shareType : link.shareType,
      appointmentDate: payload.appointmentDate !== undefined ? payload.appointmentDate : link.appointmentDate,
      ceasedDate: payload.ceasedDate !== undefined ? payload.ceasedDate : link.ceasedDate,
      notes: payload.notes !== undefined ? payload.notes : link.notes,
    });
    return { data: { data: companies._resolveLinks(c) } };
  },
  removeLink: async (companyId, linkId) => {
    await delay();
    const c = findCompany(companyId);
    if (!c) throw new Error('Company not found');
    c.links = (c.links || []).filter(l => l._id !== linkId);
    return { data: { data: { _id: linkId } } };
  },
  getShareholderEntries: async (companyId) => {
    await delay();
    const c = findCompany(companyId);
    return { data: { data: (c?.links || []).filter(l => l.roles.includes('shareholder')) } };
  },
  getDirectorEntries: async (companyId) => {
    await delay();
    const c = findCompany(companyId);
    return { data: { data: (c?.links || []).filter(l => l.roles.includes('director') || l.roles.includes('alternate_director')) } };
  },
  // 反查：某人关联的所有公司（含角色/股份/日期）
  getReverseLinks: async (personnelId) => {
    await delay();
    const links = [];
    MOCK_COMPANIES.forEach(c => (c.links || []).forEach(l => {
      if (l.linkModel === 'Personnel' && l.link?._id === personnelId) {
        links.push({ ...l, company: { _id: c._id, name: c.name, registrationNumber: c.registrationNumber } });
      }
    }));
    return { data: { data: links } };
  },
};

// ====== Personnel Service ======
export const personnel = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_PERSONNEL];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.nric && p.nric.toLowerCase().includes(q)));
    }
    // 计算每个人员的角色（董事/股东/秘书），用于标签与筛选
    list = list.map(p => ({ ...p, roles: deriveRoles(p._id) }));
    if (filters.role) {
      list = list.filter(p => (p.roles || []).includes(filters.role));
    }
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
  },
  // Person 360° 读时聚合（mock）：从 Company.links 反查公司，再聚合其 Task/Meeting/Document/Reminder
  getByPersonnel: async (id) => {
    await delay();
    const p = findPerson(id);
    if (!p) throw new Error('Personnel not found');
    const links = [];
    MOCK_COMPANIES.forEach(c => (c.links || []).forEach(l => {
      if (l.linkModel === 'Personnel' && l.link?._id === id) {
        links.push({
          company: { _id: c._id, name: c.name, nameChinese: c.nameChinese, registrationNumber: c.registrationNumber, type: c.type, status: c.status },
          roles: l.roles || [], shares: l.shares, shareType: l.shareType,
          appointmentDate: l.appointmentDate, cessationDate: l.cessationDate, notes: l.notes,
        });
      }
    }));
    const companyIds = links.map(l => l.company._id);
    const roleSet = new Set();
    links.forEach(l => (l.roles || []).forEach(r => roleSet.add(r)));
    const tasks = (MOCK_TASKS || []).filter(t => companyIds.includes(t.company?._id) || t.personnel?._id === id);
    const meetings = (MOCK_MEETINGS || []).filter(m => companyIds.includes(m.company?._id) || (m.attendees || []).some(a => a.ref?._id === id));
    const documents = (MOCK_DOCUMENTS || []).filter(d => d.personnel?._id === id);
    const reminders = (MOCK_COMPLIANCE_REMINDERS || []).filter(r => companyIds.includes(r.company?._id));
    return { data: { data: { personnel: { ...p, roles: [...roleSet] }, companies: links, tasks, meetings, documents, reminders } } };
  },
  getOne: async (id) => {
    await delay();
    const p = findPerson(id);
    if (!p) throw new Error('Personnel not found');
    // Build company links for this person
    const companies = MOCK_COMPANIES
      .filter(c => c.links.some(l => l.linkModel === 'Personnel' && l.link?._id === id))
      .map(c => {
        const matchingLinks = c.links.filter(l => l.linkModel === 'Personnel' && l.link?._id === id);
        return matchingLinks.map(link => ({
          company: { _id: c._id, name: c.name, registrationNumber: c.registrationNumber, type: c.type, status: c.status },
          roles: link.roles || [],
          appointmentDate: link.appointmentDate,
          shares: link.shares,
          shareType: link.shareType,
        }));
      }).flat();
    return { data: { data: { ...p, companies } } };
  },
  create: async (data) => {
    await delay();
    const neu = { _id: 'p' + Date.now(), ...data };
    MOCK_PERSONNEL.push(neu);
    return { data: { data: neu } };
  },
  update: async (id, data) => {
    await delay();
    const idx = MOCK_PERSONNEL.findIndex(p => p._id === id);
    if (idx >= 0) { MOCK_PERSONNEL[idx] = { ...MOCK_PERSONNEL[idx], ...data }; return { data: { data: MOCK_PERSONNEL[idx] } }; }
    throw new Error('Not found');
  },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  // Merge two personnel: source merged into target, then source deleted
  merge: async (targetId, sourceId) => {
    await delay();
    const targetIdx = MOCK_PERSONNEL.findIndex(p => p._id === targetId);
    const sourceIdx = MOCK_PERSONNEL.findIndex(p => p._id === sourceId);
    if (targetIdx < 0 || sourceIdx < 0) throw new Error('Personnel not found');
    const target = MOCK_PERSONNEL[targetIdx];
    const source = MOCK_PERSONNEL[sourceIdx];
    ['name','nric','email','phone','nationality','notes'].forEach(k => {
      if (!target[k] && source[k]) target[k] = source[k];
    });
    if (source.address && source.address.country) {
      if (!target.address) target.address = {};
      if (!target.address.country) target.address.country = source.address.country;
    }
    MOCK_COMPANIES.forEach(c => {
      (c.links || []).forEach(link => {
        if (link.linkModel === 'Personnel' && link.link?._id === sourceId) link.link._id = targetId;
      });
    });
    MOCK_MEETINGS.forEach(m => {
      (m.attendees || []).forEach(att => {
        if (att.refModel === 'Personnel' && att.ref?._id === sourceId) { att.ref._id = targetId; if (att.name) att.name = target.name; }
      });
    });
    MOCK_DOCUMENTS.forEach(d => {
      if (d.personnel?._id === sourceId) d.personnel._id = targetId;
    });
    const adjustedSourceIdx = MOCK_PERSONNEL.findIndex(p => p._id === sourceId);
    if (adjustedSourceIdx >= 0) MOCK_PERSONNEL.splice(adjustedSourceIdx, 1);
    return { data: { data: target } };
  },
};

// ====== Documents Service ======
export const documents = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_DOCUMENTS];
    if (filters.search) list = list.filter(d => d.name.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.type) list = list.filter(d => d.type === filters.type);
    if (filters.companyId) list = list.filter(d => d.company?._id === filters.companyId);
    if (filters.personnelId) list = list.filter(d => d.personnel?._id === filters.personnelId);
    if (filters.meetingId) list = list.filter(d => (d.meeting?._id || d.meeting) === filters.meetingId);
    // v5.2 模块1：公司文件库 / 全局列表默认排除"会议暂存"文件（staged=true）。
    // 仅当显式 meetingId（会议视图自身）或 includeStaged 时才包含。
    if (!filters.meetingId && !filters.includeStaged) list = list.filter(d => !d.staged);
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
  },
  getOne: async (id) => {
    await delay();
    const d = MOCK_DOCUMENTS.find(doc => doc._id === id);
    return { data: { data: d || MOCK_DOCUMENTS[0] } };
  },
  getByCompany: async (companyId) => {
    await delay();
    // v5.2 模块1：公司文件库排除会议暂存文件（staged=true 的仅停留在会议视图）
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.company?._id === companyId && !d.staged) } };
  },
  getByPersonnel: async (personnelId) => {
    await delay();
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.personnel?._id === personnelId) } };
  },
  // v6.x 修复：真实接收 FormData，新建带正确元数据 + fileUrl 的文档
  // （此前写死返回 MOCK_DOCUMENTS[0] → 串档 + 线上"无文件"）
  upload: async (formData) => {
    await delay();
    const get = (k) => (formData && typeof formData.get === 'function' ? formData.get(k) : (formData ? formData[k] : undefined));
    const parseObj = (raw) => {
      if (!raw) return undefined;
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw); } catch { return { _id: raw }; }
    };
    const name = get('name') || (get('file') && get('file').name) || 'Untitled';
    const type = get('type') || 'other';
    const category = get('category') || 'other';
    const companyRaw = get('company');
    const personnelRaw = get('personnel');
    const meetingRaw = get('meeting');
    const staged = get('staged');
    const signStatus = get('signStatus') || 'draft';
    const sourceRaw = get('source');
    const note = get('note') || get('description');
    const file = get('file');

    const company = parseObj(companyRaw);
    const personnel = parseObj(personnelRaw);
    const meeting = parseObj(meetingRaw);
    const source = parseObj(sourceRaw);

    // 浏览器内用 blob URL 预览（真实后端走 R2/local 返回可访问 URL）
    const fileUrl = (typeof URL !== 'undefined' && file) ? URL.createObjectURL(file) : '';

    const neu = {
      _id: 'd' + Date.now(),
      name,
      type,
      category,
      company: company ? { _id: company._id, name: company.name, registrationNumber: company.registrationNumber } : undefined,
      personnel: personnel ? { _id: personnel._id, name: personnel.name } : undefined,
      meeting: meeting ? (typeof meeting === 'string' ? meeting : { _id: meeting._id }) : undefined,
      fileName: file && file.name,
      fileSize: file && file.size,
      fileUrl,
      mimeType: file && file.type,
      signStatus,
      staged: staged === 'true' || staged === true,
      // v6.x 归属维度：有 company 即公司文件（即便关联 personnel，如董事任免）；仅 personnel 则个人文件
      scope: company ? 'company' : (personnel ? 'person' : 'company'),
      source,
      note,
      documentYear: new Date().getFullYear(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    if (!neu.docNumber) {
      const prefix = (category || 'other').slice(0, 3).toUpperCase();
      neu.docNumber = `${prefix}-${String(MOCK_DOCUMENTS.length + 1).padStart(4, '0')}`;
    }
    MOCK_DOCUMENTS.push(neu);
    return { data: { data: neu } };
  },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  getExpiring: async () => {
    await delay();
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.expiresAt || d.renewalDueDate) } };
  },
  // 新增文档（任务/会议完成时归档、上传附件均走这里）
  create: async (data) => {
    await delay();
    const neu = {
      _id: 'd' + Date.now(),
      type: 'other',
      category: data.category || 'other',
      createdAt: new Date().toISOString().split('T')[0],
      ...data,
    };
    // 归一化：meeting 字符串引用 → { _id } 对象，与种子数据 / 真实后端填充一致
    if (typeof neu.meeting === 'string') neu.meeting = { _id: neu.meeting };
    // 自动生成文档编号（如未提供）
    if (!neu.docNumber) {
      const prefix = (neu.category || 'other').slice(0, 3).toUpperCase();
      neu.docNumber = `${prefix}-${String(MOCK_DOCUMENTS.length + 1).padStart(4, '0')}`;
    }
    MOCK_DOCUMENTS.push(neu);
    return { data: { data: neu } };
  },
  update: async (id, data) => {
    await delay();
    const idx = MOCK_DOCUMENTS.findIndex(d => d._id === id);
    if (idx >= 0) { MOCK_DOCUMENTS[idx] = { ...MOCK_DOCUMENTS[idx], ...data }; return { data: { data: MOCK_DOCUMENTS[idx] } }; }
    throw new Error('Document not found');
  },
  // v6.x 签署闭环：替换文档物理文件（mock 用 blob URL 模拟，保留元数据）
  replaceFile: async (id, formData) => {
    await delay();
    const idx = MOCK_DOCUMENTS.findIndex(d => d._id === id);
    if (idx < 0) throw new Error('Document not found');
    const get = (k) => (formData && typeof formData.get === 'function' ? formData.get(k) : undefined);
    const file = get('file');
    const signStatus = get('signStatus');
    const fileUrl = (file && typeof URL !== 'undefined') ? URL.createObjectURL(file) : MOCK_DOCUMENTS[idx].fileUrl;
    MOCK_DOCUMENTS[idx] = {
      ...MOCK_DOCUMENTS[idx],
      fileUrl,
      fileName: file && file.name,
      fileSize: file && file.size,
      mimeType: file && file.type,
      signStatus: signStatus || MOCK_DOCUMENTS[idx].signStatus,
      signedBy: get('signedBy') || MOCK_DOCUMENTS[idx].signedBy,
      signedAt: get('signedAt') || MOCK_DOCUMENTS[idx].signedAt,
      version: (MOCK_DOCUMENTS[idx].version || 1) + 1,
    };
    return { data: { data: MOCK_DOCUMENTS[idx] } };
  },
};

// ====== Directors unified into Personnel + Company.links (single source of truth) ======
// 原 MOCK_DIRECTORS 冗余数据已并入 MOCK_PERSONNEL + company.links。董事/股东/秘书仅为
// Personnel 的"角色"，其任职关系统一存于 Company.links（linkModel: Personnel/Company）。
// 关联关系增删改见 companies.addLink / updateLink / removeLink。人视角由 getReverseLinks/deriveRoles 读时聚合，不物化。

// ====== Meetings Service ======
export const meetings = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_MEETINGS];
    if (filters.status) list = list.filter(m => m.status === filters.status);
    if (filters.phase) list = list.filter(m => m.phase === filters.phase);
    if (filters.companyId) list = list.filter(m => m.company?._id === filters.companyId);
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
  },
  getOne: async (id) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === id);
    return { data: { data: m || MOCK_MEETINGS[0] } };
  },
  getByCompany: async (companyId) => {
    await delay();
    return { data: { data: MOCK_MEETINGS.filter(m => m.company?._id === companyId) } };
  },
  getByPersonnel: async (personnelId) => {
    await delay();
    return { data: { data: MOCK_MEETINGS.filter(m => m.attendees?.some(a => a.ref?._id === personnelId || a.refModel === 'Personnel' && a.ref?._id === personnelId) || false) } };
  },
  create: async (data) => {
    await delay();
    const neu = { _id: 'm' + Date.now(), ...data, status: 'draft', phase: 'setup', attendees: [], agenda: [] };
    MOCK_MEETINGS.push(neu);
    return { data: { data: neu } };
  },
  update: async (id, data) => {
    await delay();
    const idx = MOCK_MEETINGS.findIndex(m => m._id === id);
    if (idx >= 0) { MOCK_MEETINGS[idx] = { ...MOCK_MEETINGS[idx], ...data }; return { data: { data: MOCK_MEETINGS[idx] } }; }
    throw new Error('Meeting not found');
  },
  delete: async (id) => { await delay(); const idx = MOCK_MEETINGS.findIndex(m => m._id === id); if (idx >= 0) MOCK_MEETINGS.splice(idx, 1); return { data: { data: { _id: id } } }; },
  addAttendee: async (meetingId, data) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === meetingId);
    if (!m) throw new Error('Meeting not found');
    const att = { _id: 'a' + Date.now(), ...data, status: 'pending' };
    m.attendees = m.attendees || [];
    m.attendees.push(att);
    return { data: { data: m } };
  },
  removeAttendee: async (meetingId, attendeeId) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === meetingId);
    if (m) m.attendees = (m.attendees || []).filter(a => a._id !== attendeeId);
    return { data: { data: m || MOCK_MEETINGS[0] } };
  },
  // Generate meeting notice HTML
  getNotice: async (id) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === id);
    if (!m) return { data: { data: { text: 'Meeting not found.', html: '' } } };
    const d = new Date(m.scheduledAt);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekDays[d.getDay()]}）`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const endD = m.scheduledEndAt ? new Date(m.scheduledEndAt) : null;
    const endTimeStr = endD ? `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}` : '';
    const timeRange = endTimeStr ? `${timeStr} - ${endTimeStr}（北京时间）` : timeStr;
    const greeting = m.notice?.greeting || '尊敬的各位董事';
    const signOff = m.notice?.signOff || '请准时参加，如有问题请随时与我沟通，谢谢。';
    const customNote = m.notice?.customNote || '';
    const companyName = m.company?.name || m.notice?.companyName || '';
    const companyCode = m.company?.stockCode ? `（${m.company.stockCode}）` : '';
    const attendeeNames = (m.attendees || []).map(a => a.name).join('、');
    const agendaItems = (m.agenda || []).map((a, i) => `${i + 1}. ${a.item}${a.presenter ? `（主讲：${a.presenter}）` : ''}`).join('\n');
    const locationInfo = m.isVirtual ? `腾讯视频会议如下：\n${m.meetingLink}\n\n#腾讯会议：${m.meetingId || ''}` : `会议地点：${m.location}`;
    const meetingType = m.type === 'board' ? '董事会会议' : m.type === 'agm' ? '周年股东大会' : m.type === 'egm' ? '股东特别大会' : '会议';

    const text = `${greeting}：\n\n${customNote ? customNote + '\n\n' : ''}会议详情：\n会议时间：${dateStr} ${timeRange}\n\n会议主要议程：\n${agendaItems}\n\n会议方式：${locationInfo}${m.meetingPassword ? `\n会议密码：${m.meetingPassword}` : ''}\n\n${attendeeNames ? `参会人员：${attendeeNames}\n\n` : ''}${signOff}`;

    const html = buildNoticeHtml({ greeting, customNote, dateStr, timeRange, meetingType, agendaItems, locationInfo, meetingId: m.meetingId, meetingPassword: m.meetingPassword, meetingLink: m.meetingLink, isVirtual: m.isVirtual, location: m.location, attendeeNames, signOff, companyName, companyCode });

    return { data: { data: { text, html, companyName, meeting: { title: m.title, type: m.type, scheduledAt: m.scheduledAt, attendees: m.attendees } } } };
  },
  // Generate meeting minutes
  getMinutes: async (id) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === id);
    if (!m) return { data: { data: null } };
    const d = new Date(m.scheduledAt);
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateFull = `${dateStr}（${weekDays[d.getDay()]}）`;

    // Build minutes
    const attended = (m.attendees || []).filter(a => a.status === 'attended').map(a => `${a.name}（${a.role}）`).join('\n');
    const agendaText = (m.agenda || []).map((a, i) => `${i + 1}. ${a.item}${a.presenter ? ` — ${a.presenter}` : ''}`).join('\n');
    const resolutionsText = (m.resolutions || []).map(r => `- ${r.title}：${r.status === 'approved' ? '✓ 已通过' : r.status === 'rejected' ? '✗ 未通过' : '待决议'}`).join('\n');
    const chair = (m.attendees || []).find(a => a.role?.includes('主席'));
    const chairName = chair?.name || '';
    const chairTitle = chair?.role || '会议主席';

    const text = `${m.company?.name || ''}\n董事会会议纪要\n\n会议日期：${dateFull}\n会议时间：${new Date(m.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}\n会议地点：${m.location}\n\n出席：\n${attended}\n\n议程：\n${agendaText}\n\n决议：\n${resolutionsText}\n\n会议主席签字：\n______________________\n${chairName}\n${chairTitle}\n\n日期：______________________`;

    const html = buildMinutesHtml({ companyName: m.company?.name, meetingTitle: m.title, dateFull, time: new Date(m.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), location: m.location, attendedHtml: (m.attendees || []).filter(a => a.status === 'attended').map(a => `<p>${a.name}<br/><span class="role">${a.role}</span></p>`).join(''), agenda: m.agenda || [], resolutions: m.resolutions || [], chairName, chairTitle, signatures: m.signatures || [] });

    return { data: { data: { text, html, status: m.minutes?.status || 'draft', signedAt: m.minutes?.signedAt, signatures: m.signatures || [] } } };
  },
  // Sign minutes
  signMinutes: async (meetingId, signatureData) => {
    await delay();
    const m = MOCK_MEETINGS.find(mm => mm._id === meetingId);
    if (!m) throw new Error('Meeting not found');
    if (!m.signatures) m.signatures = [];
    m.signatures.push({ _id: 'sig' + Date.now(), ...signatureData, status: 'signed', signedAt: new Date().toISOString() });
    m.minutes = { ...(m.minutes || {}), status: m.signatures.length > 0 ? 'signed' : 'draft', signedAt: new Date().toISOString() };
    m.phase = 'minutes-signed';
    return { data: { data: m } };
  },
  updateStatus: async (id, { status, phase }) => {
    await delay();
    const idx = MOCK_MEETINGS.findIndex(m => m._id === id);
    if (idx < 0) throw new Error('Meeting not found');
    if (status) MOCK_MEETINGS[idx].status = status;
    if (phase) MOCK_MEETINGS[idx].phase = phase;
    return { data: { data: MOCK_MEETINGS[idx] } };
  },
};

// ====== Notice HTML Builder ======
function buildNoticeHtml({ greeting, customNote, dateStr, timeRange, meetingType, agendaItems, _locationInfo, meetingId, meetingPassword, meetingLink, isVirtual, location, attendeeNames, signOff, companyName, companyCode }) {
  const agendaHtml = (agendaItems || '').split('\n').filter(Boolean).map(line => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`).join('');
  const locationHtml = isVirtual
    ? `<p><strong>会议方式：</strong>腾讯视频会议</p><p><a href="${meetingLink || '#'}">${meetingLink || ''}</a></p><p>#腾讯会议：${meetingId || ''}${meetingPassword ? ` | 密码：${meetingPassword}` : ''}</p>`
    : `<p><strong>会议地点：</strong>${location || ''}</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8; }
    h1 { font-size: 22px; text-align: center; margin-bottom: 8px; }
    .company { text-align: center; font-size: 14px; color: #666; margin-bottom: 30px; }
    .greeting { font-size: 15px; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 16px; margin-bottom: 8px; color: #1a56db; border-left: 3px solid #1a56db; padding-left: 10px; }
    .agenda li { margin-bottom: 6px; }
    .attendees { background: #f8fafc; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }
    .sign-off { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #555; }
    .notice-type { text-align: center; background: #eff6ff; padding: 8px; border-radius: 4px; margin-bottom: 24px; font-weight: bold; color: #1e40af; }
    @media print { body { padding: 20px; } }
  </style></head><body>
    ${companyName ? `<h1>${companyName}${companyCode}</h1>` : ''}
    <div class="notice-type">${meetingType || '会议'}通知</div>
    <div class="greeting">${greeting}：</div>
    ${customNote ? `<p>${customNote}</p>` : ''}
    <div class="section"><h3>会议详情</h3><p><strong>会议时间：</strong>${dateStr} ${timeRange}</p></div>
    <div class="section"><h3>会议主要议程</h3><ol class="agenda">${agendaHtml}</ol></div>
    <div class="section">${locationHtml}</div>
    ${attendeeNames ? `<div class="attendees"><strong>参会人员：</strong>${attendeeNames}</div>` : ''}
    <div class="sign-off">${signOff}</div>
  </body></html>`;
}

// ====== Minutes HTML Builder ======
function buildMinutesHtml({ companyName, meetingTitle, dateFull, time, location, attendedHtml, agenda, resolutions, chairName, chairTitle, signatures }) {
  const agendaHtml = (agenda || []).map((a, i) => `<tr><td>${i + 1}</td><td>${a.item}</td><td>${a.presenter || '-'}</td></tr>`).join('');
  const resolutionsHtml = (resolutions || []).map(r => `<tr><td>${r.title}</td><td class="status ${r.status}">${r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '未通过' : '待决议'}</td></tr>`).join('');
  const sigsHtml = (signatures || []).map(s => `<div class="sig-box"><div class="sig-line"></div><p>${s.name}</p><p class="role">${s.title || ''}</p>${s.status === 'signed' ? '<span class="signed-badge">已签署</span>' : '<span class="pending-badge">待签署</span>'}</div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8; }
    h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 16px; color: #1e40af; margin-bottom: 30px; font-weight: bold; }
    .meta { margin-bottom: 20px; }
    .meta p { margin: 4px 0; }
    h3 { font-size: 16px; color: #1a56db; border-left: 3px solid #1a56db; padding-left: 10px; margin-top: 24px; }
    .attended p { margin: 4px 0; }
    .role { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; }
    .status.approved { color: #16a34a; font-weight: bold; }
    .sigs { display: flex; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; }
    .sig-box { text-align: center; min-width: 150px; }
    .sig-line { border-bottom: 2px solid #333; margin: 30px 0 8px; min-width: 120px; }
    .signed-badge { color: #16a34a; font-size: 12px; }
    .pending-badge { color: #f59e0b; font-size: 12px; }
    @media print { body { padding: 20px; } }
  </style></head><body>
    <h1>${companyName || ''}</h1>
    <div class="subtitle">董事会会议纪要</div>
    <div class="meta"><p><strong>会议：</strong>${meetingTitle || ''}</p><p><strong>日期：</strong>${dateFull || ''}</p><p><strong>时间：</strong>${time || ''}</p><p><strong>地点：</strong>${location || ''}</p></div>
    ${attendedHtml ? `<h3>出席</h3><div class="attended">${attendedHtml}</div>` : ''}
    <h3>议程</h3><table><thead><tr><th>#</th><th>议题</th><th>主讲</th></tr></thead><tbody>${agendaHtml}</tbody></table>
    ${resolutionsHtml ? `<h3>决议</h3><table><thead><tr><th>决议事项</th><th>状态</th></tr></thead><tbody>${resolutionsHtml}</tbody></table>` : ''}
    ${sigsHtml ? `<h3>签署</h3><div class="sigs">${sigsHtml}</div>` : `<div class="sigs"><div class="sig-box"><div class="sig-line"></div><p>${chairName || '会议主席'}</p><p class="role">${chairTitle || ''}</p></div></div>`}
  </body></html>`;
}

// ====== Mock Data ======
const MOCK_TASKS = [
  { _id: 'tt1', title: 'File Annual Return - Easy Rich Corporation', type: 'filing', priority: 'urgent', status: 'pending', dueDate: '2026-04-21', description: 'Submit NAR1 to ICAC.', createdBy: 'u1', createdAt: '2026-03-01', company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' }, personnel: { _id: 'p1', name: '施金帆' }, notes: [] },
  { _id: 'tt2', title: 'Prepare Board Meeting Minutes - CNC', type: 'document', priority: 'high', status: 'completed', dueDate: '2026-03-28', description: 'Draft and sign minutes.', createdBy: 'u1', createdAt: '2026-03-26', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: { _id: 'p10', name: '施中安 (SHI ZHONGAN)' }, notes: [{ content: '主席已签署', createdAt: '2026-03-28T14:00:00+08:00' }] },
  { _id: 'tt3', title: 'Update Director Register - HuiJun', type: 'compliance', priority: 'medium', status: 'in_progress', dueDate: '2026-05-14', description: '', createdBy: 'u1', createdAt: '2026-04-01', company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857' }, personnel: { _id: 'p4', name: '林才賀 (LIN CAI HE)' }, notes: [] },
  { _id: 'tt4', title: 'Renew Business License Certificate', type: 'filing', priority: 'high', status: 'overdue', dueDate: '2026-06-01', description: ' renewal before expiry.', createdBy: 'u1', createdAt: '2026-04-15', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: { _id: 'p4', name: '林才賀 (LIN CAI HE)' }, notes: [] },
  { _id: 'tt5', title: 'AGM 年度大会 - 匯駿控股', type: 'meeting_prep', priority: 'high', status: 'pending', dueDate: '2026-05-14', description: '准备并召开匯駿控股周年大会', createdBy: 'u1', createdAt: '2026-04-01', company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857' }, personnel: { _id: 'p3', name: '施中安 (施侃成)' }, notes: [] },
  // v5.2 模块4 演示：Dashboard 直接发起的签署任务（无会议）
  { _id: 'tt6', title: '签署 NAR1 申报表 - Easy Rich', type: 'signing', taskSource: 'dashboard', isCTC: false, priority: 'high', status: 'pending', dueDate: '2026-08-15', description: '由 Dashboard 发起的签署任务；关联文件：NAR1 周年申报表 2026。', createdBy: 'u1', createdAt: '2026-07-18', company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' }, responsiblePerson: '施金帆', notes: [] },
  // v5.2 模块4 演示：会议衍生的签署任务（关联会议 m1 Easy Rich AGM）
  { _id: 'tt7', title: '签署：Easy Rich 2026周年股东大会纪要', type: 'signing', taskSource: 'meeting', isCTC: false, priority: 'urgent', status: 'pending', dueDate: '2026-07-22', description: '从会议「Easy Rich 2026年周年股东大会」衍生的签署任务。', createdBy: 'u1', createdAt: '2026-07-15', company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' }, meeting: { _id: 'm1', title: 'Easy Rich 2026年周年股东大会' }, responsiblePerson: '施金帆', notes: [] },
];

const MOCK_COMPLIANCE_RULES = [
  { _id: 'r1', name: '周年申报表 NAR1', category: 'annual_return', description: '公司须在成立后第15个月及之后每15个月提交', jurisdiction: 'HK', frequency: '15 months', dueDaysBefore: 30, isPreset: true },
  { _id: 'r2', name: '周年大会 AGM', category: 'general_meeting', description: '每财政年度内举行', jurisdiction: 'HK', frequency: '12 months', dueDaysBefore: 60, isPreset: true },
  { _id: 'r3', name: '董事变更申报 NDAC1', category: 'director_change', description: '董事变动后60天内申报', jurisdiction: 'HK', frequency: 'event_driven', dueDaysBefore: 30, isPreset: true },
  { _id: 'r4', name: '商业登记证续期', category: 'license_renewal', description: '每12个月续期商业登记', jurisdiction: 'HK', frequency: '12 months', dueDaysBefore: 30, isPreset: true },
  { _id: 'r5', name: '审计师任命申报', category: 'auditor', description: '周年大会上任命审计师', jurisdiction: 'HK', frequency: '12 months', dueDaysBefore: 30, isPreset: true },
  { _id: 'r6', name: '帐目备案（注册非香港公司）', category: 'annual_return', description: '每12个月内备案经审计帐目', jurisdiction: 'Cayman', frequency: '12 months', dueDaysBefore: 90, isPreset: true },
];

const MOCK_COMPLIANCE_REMINDERS = [
  { _id: 'rem1', title: 'NAR1 年度申报表 - Easy Rich Corporation', rule: { _id: 'r1', name: '周年申报表 NAR1' }, company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)' }, dueDate: '2026-04-21', status: 'upcoming', priority: 'high', completed: false, createdAt: '2026-01-21', task: { _id: 'tt1' }, notes: [] },
  { _id: 'rem2', title: 'AGM 年度大会 - 匯駿控股', rule: { _id: 'r2', name: '周年大会 AGM' }, company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)' }, dueDate: '2026-05-14', status: 'upcoming', priority: 'medium', completed: false, createdAt: '2026-02-14', task: { _id: 'tt5' }, notes: [] },
  { _id: 'rem3', title: '商业登记证续期 - CNC', rule: { _id: 'r4', name: '商业登记证续期' }, company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)' }, dueDate: '2026-01-08', status: 'expired', priority: 'critical', completed: false, createdAt: '2025-01-08', task: { _id: 'tt4' }, notes: [] },
  { _id: 'rem4', title: 'NAR1 年度申报表 - Zhong An Travel', rule: { _id: 'r1', name: '周年申报表 NAR1' }, company: { _id: 'c2', name: 'Zhong An Travel Ltd (眾安旅遊)' }, dueDate: '2026-09-28', status: 'upcoming', priority: 'medium', completed: true, createdAt: '2026-06-28', task: { _id: 'tt1' }, notes: [] },
];

// ⭐ v2：模板 mock 数据源已切换为 schema 形状（engine:'schema' + docSchema），
//    且改为从「单一事实源」shared/templatePresets.generated.json 构造，
//    与后端 server/data/presets/*.js 的 9 个完整预设同源
//    （旧版手写 4 个简化骨架，section/字段远少于真实预设，导致预览与后端不一致）。
//
// 关键约束：
//   - 通过 Vite 原生 JSON import 引入生成产物；
//   - 必须深拷贝（JSON.parse(JSON.stringify)）再赋给 MOCK_TEMPLATES，
//     否则 templateService 的 create/update/duplicate 会就地污染模块级单例（import 进来的对象），
//     同一会话内改过的模板刷新前不复原，甚至跨测试互相串；
//   - _id 形如 `preset-${presetKey}`，稳定派生，保证幂等；
//   - `variables` 由 deriveVariables(docSchema) 产出，含 source:'director'/'meeting'，
//     是 TemplateFill 渲染「董事多选/会议下拉」选择器的依据。
const MOCK_TEMPLATES = JSON.parse(JSON.stringify(generatedPresetData.presets));
const MOCK_SIGN_TASKS = [
  { _id: 'st1', title: '签署 CNC 2025年度会议纪要', template: { _id: 'tmpl3', name: '董事会纪要' }, relatedMeeting: { _id: 'm3', title: '中国新城市集团2025年度董事会会议' }, relatedCompany: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)' }, signers: [
    { _id: 'sg1', name: '施中安', role: '会议主席', status: 'signed', signedAt: '2026-03-28T14:00:00+08:00' },
    { _id: 'sg2', name: '林才賀', role: '公司秘书', status: 'pending', signedAt: null },
  ], priority: 'high', status: 'in_progress', createdAt: '2026-03-27' },
  { _id: 'st2', title: '签署 NAR1 申报表', template: { _id: 'tmpl4', name: '股东名册' }, relatedMeeting: null, relatedCompany: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)' }, signers: [
    { _id: 'sg3', name: '施金帆', role: '董事', status: 'signed', signedAt: '2026-04-20T10:00:00+08:00' },
    { _id: 'sg4', name: '林才賀', role: '公司秘书', status: 'signed', signedAt: '2026-04-20T15:00:00+08:00' },
  ], priority: 'critical', status: 'completed', createdAt: '2026-04-15' },
  { _id: 'st3', title: '签署董事委任函', template: { _id: 'tmpl1', name: '董事委任函' }, relatedMeeting: null, relatedCompany: { _id: 'c4', name: 'Hong Kong Time Honour Property Ltd (香港時駿地産)' }, signers: [
    { _id: 'sg5', name: '林才賀', role: '授权代表', status: 'pending', signedAt: null },
  ], priority: 'medium', status: 'pending', createdAt: '2026-07-01' },
];

// ====== Tasks Service ======
export const tasks = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_TASKS];
    if (filters.status && filters.status !== 'all') list = list.filter(t => t.status === filters.status);
    if (filters.priority && filters.priority !== 'all') list = list.filter(t => t.priority === filters.priority);
    if (filters.search) list = list.filter(t => t.title.toLowerCase().includes(filters.search.toLowerCase()));
    // v5.1 会议闭环：按会议过滤关联 Task
    if (filters.meetingId) list = list.filter(t => (t.meeting && (t.meeting._id === filters.meetingId || t.meeting === filters.meetingId)));
    return { data: { data: list, total: list.length } };
  },
  getOne: async (id) => {
    await delay();
    const t = MOCK_TASKS.find(tt => tt._id === id);
    if (!t) throw new Error('Task not found');
    return { data: { data: t } };
  },
  create: async (data) => {
    await delay();
    const neu = { _id: 'tt' + Date.now(), ...data, createdBy: 'u1', notes: [], createdAt: new Date().toISOString().split('T')[0] };
    MOCK_TASKS.push(neu);
    return { data: { data: neu } };
  },
  update: async (id, data) => {
    await delay();
    const idx = MOCK_TASKS.findIndex(t => t._id === id);
    if (idx >= 0) { MOCK_TASKS[idx] = { ...MOCK_TASKS[idx], ...data }; return { data: { data: MOCK_TASKS[idx] } }; }
    throw new Error('Task not found');
  },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  addNote: async (id, data) => {
    await delay();
    const t = MOCK_TASKS.find(tt => tt._id === id);
    if (t) { t.notes = t.notes || []; t.notes.push({ content: data.content, createdAt: new Date().toISOString() }); return { data: { data: t } }; }
    throw new Error('Task not found');
  },
  getExpiring: async () => { await delay(); return { data: { data: MOCK_TASKS.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date(Date.now() + 7 * 86400000)) } }; },
  getByCompany: async (companyId) => { await delay(); return { data: { data: MOCK_TASKS.filter(t => t.company?._id === companyId) } }; },
  getByPersonnel: async (personnelId) => { await delay(); return { data: { data: MOCK_TASKS.filter(t => t.personnel?._id === personnelId) } }; },
};

// ====== Compliance Rules ======
export const complianceRules = {
  getAll: async () => { await delay(); return { data: { data: MOCK_COMPLIANCE_RULES } } },
  getOne: async (id) => { await delay(); const r = MOCK_COMPLIANCE_RULES.find(rr => rr._id === id); if (!r) throw new Error('Not found'); return { data: { data: r } }; },
  create: async (data) => { await delay(); const neu = { _id: 'cr' + Date.now(), ...data }; MOCK_COMPLIANCE_RULES.push(neu); return { data: { data: neu } }; },
  update: async (id, data) => { await delay(); const idx = MOCK_COMPLIANCE_RULES.findIndex(r => r._id === id); if (idx >= 0) { MOCK_COMPLIANCE_RULES[idx] = { ...MOCK_COMPLIANCE_RULES[idx], ...data }; return { data: { data: MOCK_COMPLIANCE_RULES[idx] } }; } throw new Error('Not found'); },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  initPresets: async () => { await delay(); return { data: { data: MOCK_COMPLIANCE_RULES } }; },
  generateReminders: async (ruleId, { companyIds } = {}) => {
    await delay();
    const count = companyIds?.length || 3;
    return { data: { data: { remindersGenerated: count, skipped: 0 } } };
  },
  applyRule: async (id, companyIds) => {
    await delay();
    return { data: { data: { ruleId: id, companyIds } } };
  },
  diagnose: async () => {
    await delay();
    const byField = {};
    const list = MOCK_COMPANIES.map((c) => {
      const missing = [];
      if (!c.incorporationDate) missing.push('incorporationDate');
      const fye = c.financialYearEnd;
      if (!fye || fye.month == null || fye.day == null) missing.push('financialYearEnd');
      if (!c.brExpiryDate) missing.push('brExpiryDate');
      missing.forEach((f) => { byField[f] = (byField[f] || 0) + 1; });
      return {
        _id: c._id, name: c.name, nameChinese: c.nameChinese,
        jurisdiction: c.jurisdiction, isListed: c.isListed, missingFields: missing,
      };
    });
    const companiesWithGaps = list.filter((c) => c.missingFields.length > 0).length;
    const totalMissing = Object.values(byField).reduce((a, b) => a + b, 0);
    return { data: { data: { companies: list, companiesWithGaps, totalCompanies: list.length, summary: { byField, totalMissing } } } };
  },
};

// ====== Compliance Reminders ======
export const complianceReminders = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_COMPLIANCE_REMINDERS];
    if (filters.status && filters.status !== 'all') list = list.filter(r => r.status === filters.status);
    if (filters.completed !== undefined) list = list.filter(r => r.completed === (filters.completed === 'true'));
    if (filters.companyId) list = list.filter(r => r.company?._id === filters.companyId);
    return { data: { data: list, total: list.length } };
  },
  getOne: async (id) => { await delay(); const r = MOCK_COMPLIANCE_REMINDERS.find(rr => rr._id === id); if (!r) throw new Error('Not found'); return { data: { data: r } }; },
  create: async (data) => { await delay(); const neu = { _id: 'rem' + Date.now(), completed: false, status: 'upcoming', ...data }; MOCK_COMPLIANCE_REMINDERS.push(neu); return { data: { data: neu } }; },
  update: async (id, data) => { await delay(); const idx = MOCK_COMPLIANCE_REMINDERS.findIndex(r => r._id === id); if (idx >= 0) { MOCK_COMPLIANCE_REMINDERS[idx] = { ...MOCK_COMPLIANCE_REMINDERS[idx], ...data }; return { data: { data: MOCK_COMPLIANCE_REMINDERS[idx] } }; } throw new Error('Not found'); },
  delete: async (id) => { await delay(); const idx = MOCK_COMPLIANCE_REMINDERS.findIndex(r => r._id === id); if (idx >= 0) MOCK_COMPLIANCE_REMINDERS.splice(idx, 1); return { data: { data: { _id: id } } }; },
  markCompleted: async (id) => { await delay(); const r = MOCK_COMPLIANCE_REMINDERS.find(rr => rr._id === id); if (r) { r.completed = true; r.status = 'completed'; } return { data: { data: r } }; },
  markOverdue: async (id) => { await delay(); const r = MOCK_COMPLIANCE_REMINDERS.find(rr => rr._id === id); if (r) r.status = 'expired'; return { data: { data: r } }; },
  getScheduled: async () => { await delay(); return { data: { data: MOCK_COMPLIANCE_REMINDERS.filter(r => r.status === 'upcoming') } }; },
  getExpired: async () => { await delay(); return { data: { data: MOCK_COMPLIANCE_REMINDERS.filter(r => r.status === 'expired') } }; },
  getStatistics: async () => {
    await delay();
    const total = MOCK_COMPLIANCE_REMINDERS.length;
    const completed = MOCK_COMPLIANCE_REMINDERS.filter(r => r.completed).length;
    const overdue = MOCK_COMPLIANCE_REMINDERS.filter(r => r.status === 'expired').length;
    const upcoming = total - completed - overdue;
    return { data: { data: { total, completed, overdue, upcoming } } };
  },
  triggerCheck: async () => {
    await delay();
    return { data: { data: { triggered: true, newReminders: 0 } } };
  },
  // v6.x 合规闭环第二跳：提醒 → 任务（mock 派生的任务写入 MOCK_TASKS，并回写 reminder.task 让前端跳转生效）
  createTask: async (id, payload = {}) => {
    await delay();
    const r = MOCK_COMPLIANCE_REMINDERS.find((rr) => rr._id === id);
    if (!r) throw new Error('Reminder not found');
    const prio = r.priority === '紧急' ? 'urgent' : r.priority === '高' ? 'high' : r.priority === '中' ? 'medium' : 'low';
    const neu = {
      _id: 'tt' + Date.now(),
      title: r.title,
      description: r.description || '',
      type: 'compliance',
      company: r.company,
      priority: prio,
      status: 'pending',
      dueDate: r.dueDate,
      assignedTo: payload.assignedTo || [],
      notes: payload.notes ? [{ content: payload.notes }] : [],
      createdBy: 'u1',
      autoGenerated: true,
      complianceReminder: id,
      complianceRuleId: r.ruleId,
      createdAt: new Date().toISOString().split('T')[0],
    };
    MOCK_TASKS.push(neu);
    r.task = neu._id; // 让前端既有 r.task 跳转生效
    return { data: { data: neu, created: true } };
  },
  createTasksBatch: async (payload = {}) => {
    await delay();
    const ids = payload.ids || [];
    const results = [];
    let created = 0, skipped = 0, errors = 0;
    for (const id of ids) {
      try {
        const r = MOCK_COMPLIANCE_REMINDERS.find((rr) => rr._id === id);
        if (!r) { errors++; results.push({ reminderId: id, status: 'error', message: 'not found' }); continue; }
        if (r.task) { skipped++; results.push({ reminderId: id, taskId: r.task, created: false, status: 'ok' }); continue; }
        const prio = r.priority === '紧急' ? 'urgent' : r.priority === '高' ? 'high' : r.priority === '中' ? 'medium' : 'low';
        const neu = {
          _id: 'tt' + Date.now() + Math.floor(Math.random() * 1000),
          title: r.title,
          description: r.description || '',
          type: 'compliance',
          company: r.company,
          priority: prio,
          status: 'pending',
          dueDate: r.dueDate,
          assignedTo: payload.assignedTo || [],
          notes: payload.notes ? [{ content: payload.notes }] : [],
          createdBy: 'u1',
          autoGenerated: true,
          complianceReminder: id,
          complianceRuleId: r.ruleId,
          createdAt: new Date().toISOString().split('T')[0],
        };
        MOCK_TASKS.push(neu);
        r.task = neu._id;
        created++; results.push({ reminderId: id, taskId: neu._id, created: true, status: 'ok' });
      } catch (e) {
        errors++; results.push({ reminderId: id, status: 'error', message: e.message });
      }
    }
    return { data: { data: { results, created, skipped, errors } } };
  },
};

// ====== Templates ======
export const templates = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_TEMPLATES];
    if (filters.category) list = list.filter(t => t.category === filters.category);
    if (filters.search) list = list.filter(t => t.name.toLowerCase().includes(filters.search.toLowerCase()));
    return { data: { data: list } };
  },
  getOne: async (id) => { await delay(); const t = MOCK_TEMPLATES.find(tt => tt._id === id); if (!t) throw new Error('Not found'); return { data: { data: t } }; },
  create: async (data) => { await delay(); const neu = { _id: 'tpl' + Date.now(), isPreset: false, ...data }; MOCK_TEMPLATES.push(neu); return { data: { data: neu } }; },
  update: async (id, data) => { await delay(); const idx = MOCK_TEMPLATES.findIndex(t => t._id === id); if (idx >= 0) { MOCK_TEMPLATES[idx] = { ...MOCK_TEMPLATES[idx], ...data }; return { data: { data: MOCK_TEMPLATES[idx] } }; } throw new Error('Not found'); },
  delete: async (id) => {
    await delay();
    const t = MOCK_TEMPLATES.find(tt => tt._id === id);
    // 与后端一致：内置模板拒绝删除
    if (t && t.isPreset) throw new Error('预设模板不可删除');
    return { data: { data: { _id: id } } };
  },
  duplicate: async (id, data = {}) => {
    await delay();
    const t = MOCK_TEMPLATES.find(tt => tt._id === id);
    if (!t) throw new Error('Template not found');
    const copy = {
      ...JSON.parse(JSON.stringify(t)),
      _id: 'tpl' + Date.now(),
      name: (data && data.name) || `${t.name}（副本）`,
      isPreset: false,
      version: 1,
    };
    delete copy.presetKey;
    MOCK_TEMPLATES.push(copy);
    return { data: { data: copy } };
  },
  // ⭐ B3：render（返回 HTML）已删除，改为只解析预填「值」，不产出任何 HTML。
  // 支持 director / meeting source：透传 directorIds / meetingId 时返回对应示例值。
  resolve: async (id, data = {}) => {
    await delay();
    const t = MOCK_TEMPLATES.find(tt => tt._id === id);
    if (!t) throw new Error('Template not found');
    const today = new Date().toISOString().slice(0, 10);
    const directorIds = Array.isArray(data.directorIds) ? data.directorIds : [];
    const meetingId = data.meetingId || '';
    const selectedDirectors = directorIds.length
      ? MOCK_PERSONNEL.filter(p => directorIds.includes(p._id))
      : MOCK_PERSONNEL.slice(0, 2);
    const selectedMeeting = (MOCK_MEETINGS || []).find(m => m._id === meetingId) || (MOCK_MEETINGS || [])[0];
    const values = {};
    const autoFilled = [];
    (t.variables || []).forEach((v) => {
      if (!v || !v.key) return;
      if (v.source === 'company' && v.fieldPath === 'name') {
        values[v.key] = '示例控股有限公司';
        autoFilled.push(v.key);
      } else if (v.source === 'system') {
        values[v.key] = today;
        autoFilled.push(v.key);
      } else if (v.source === 'director') {
        if (v.fieldPath === 'director.count') {
          values[v.key] = String(selectedDirectors.length);
        } else {
          // 默认返回全体董事姓名清单（boardList / director.name / 其余）
          values[v.key] = selectedDirectors.map(d => d.name).join('、');
        }
        if (values[v.key]) autoFilled.push(v.key);
      } else if (v.source === 'meeting') {
        if (v.fieldPath === 'meeting.title') {
          values[v.key] = selectedMeeting ? selectedMeeting.title : '';
        } else if (v.fieldPath === 'meeting.date' || v.fieldPath === 'meeting.scheduledAt') {
          values[v.key] = selectedMeeting && selectedMeeting.scheduledAt ? String(selectedMeeting.scheduledAt).slice(0, 10) : '';
        } else if (v.fieldPath === 'meeting.agenda') {
          values[v.key] = selectedMeeting && Array.isArray(selectedMeeting.agenda)
            ? selectedMeeting.agenda.map(a => a.item).join('、')
            : '';
        } else {
          values[v.key] = selectedMeeting ? selectedMeeting.title : '';
        }
        if (values[v.key]) autoFilled.push(v.key);
      }
    });
    return { data: { data: { values, autoFilled } } };
  },
  initPresets: async () => {
    await delay();
    // 与后端 /initialize 的响应形状对齐：{ deleted, upserted }
    return { data: { data: { deleted: 0, upserted: MOCK_TEMPLATES.length } } };
  },
};

// ====== Sign Tasks ======
export const signTasks = {
  getAll: async (filters = {}) => {
    await delay();
    let list = [...MOCK_SIGN_TASKS];
    if (filters.status && filters.status !== 'all') list = list.filter(t => t.status === filters.status);
    if (filters.companyId) list = list.filter(t => t.relatedCompany?._id === filters.companyId);
    return { data: { data: list, total: list.length } };
  },
  getOne: async (id) => { await delay(); const t = MOCK_SIGN_TASKS.find(tt => tt._id === id); if (!t) throw new Error('Not found'); return { data: { data: t } }; },
  create: async (data) => { await delay(); const neu = { _id: 'st' + Date.now(), status: 'pending', ...data }; MOCK_SIGN_TASKS.push(neu); return { data: { data: neu } }; },
  update: async (id, data) => { await delay(); const idx = MOCK_SIGN_TASKS.findIndex(t => t._id === id); if (idx >= 0) { MOCK_SIGN_TASKS[idx] = { ...MOCK_SIGN_TASKS[idx], ...data }; return { data: { data: MOCK_SIGN_TASKS[idx] } }; } throw new Error('Not found'); },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  getSigners: async (id) => { await delay(); const t = MOCK_SIGN_TASKS.find(tt => tt._id === id); if (!t) throw new Error('Not found'); return { data: { data: t.signers || [] } }; },
  sign: async (id, signerId) => {
    await delay();
    const t = MOCK_SIGN_TASKS.find(tt => tt._id === id);
    if (!t) throw new Error('Not found');
    const sg = t.signers?.find(s => s._id === signerId);
    if (sg) { sg.status = 'signed'; sg.signedAt = new Date().toISOString(); }
    const allSigned = t.signers?.every(s => s.status === 'signed');
    if (allSigned) t.status = 'completed';
    return { data: { data: t } };
  },
  getStatistics: async () => {
    await delay();
    const total = MOCK_SIGN_TASKS.length;
    const completed = MOCK_SIGN_TASKS.filter(t => t.status === 'completed').length;
    const inProgress = MOCK_SIGN_TASKS.filter(t => t.status === 'in_progress').length;
    const pending = total - completed - inProgress;
    return { data: { data: { total, completed, inProgress, pending } } };
  },
  getByMeeting: async (meetingId) => { await delay(); return { data: { data: MOCK_SIGN_TASKS.filter(t => t.relatedMeeting?._id === meetingId) } }; },
};

// ====== 跨实体全局搜索（Mock）======
// 在内存数据集上做跨实体关键词匹配，归一成与后端 /api/search 一致的形状：
// { type, id, title, subtitle, link }；前端按 type 分组展示并跳转。
export const search = {
  globalSearch: async (q, limit) => {
    await delay();
    const raw = (q || '').toString().trim();
    const empty = { data: { data: { results: [], counts: {}, query: '' } } };
    if (!raw) return empty;
    const term = raw.toLowerCase();

    const defs = [
      {
        type: 'company', arr: MOCK_COMPANIES, limit: 5,
        fields: ['name', 'nameChinese', 'stockCode', 'registrationNumber'],
        map: (d) => ({
          type: 'company', id: d._id,
          title: d.name || d.nameChinese || '(unnamed)',
          subtitle: [d.registrationNumber, d.type].filter(Boolean).join(' · '),
          link: `/companies/${d._id}`,
        }),
      },
      {
        type: 'personnel', arr: MOCK_PERSONNEL, limit: 5,
        fields: ['name', 'nameChinese', 'nric', 'email'],
        map: (d) => ({
          type: 'personnel', id: d._id,
          title: d.name || d.nameChinese || '(unnamed)',
          subtitle: [d.email, d.nationality].filter(Boolean).join(' · '),
          link: `/personnel/${d._id}`,
        }),
      },
      {
        type: 'document', arr: MOCK_DOCUMENTS, limit: 5,
        fields: ['title', 'docNumber', 'description', 'tags', 'keywords'],
        map: (d) => ({
          type: 'document', id: d._id,
          title: d.title || '(untitled)',
          subtitle: [d.docNumber, d.type].filter(Boolean).join(' · '),
          link: '/documents',
        }),
      },
      {
        type: 'meeting', arr: MOCK_MEETINGS, limit: 5,
        fields: ['title', 'location'],
        map: (d) => ({
          type: 'meeting', id: d._id,
          title: d.title || '(untitled)',
          subtitle: [d.type, d.location].filter(Boolean).join(' · '),
          link: `/meetings/${d._id}`,
        }),
      },
      {
        type: 'task', arr: MOCK_TASKS, limit: 5,
        fields: ['title', 'description'],
        map: (d) => ({
          type: 'task', id: d._id,
          title: d.title || '(untitled)',
          subtitle: [d.status, d.priority].filter(Boolean).join(' · '),
          link: `/tasks/${d._id}`,
        }),
      },
      {
        type: 'reminder', arr: MOCK_COMPLIANCE_REMINDERS, limit: 5,
        fields: ['title', 'ruleId', 'category'],
        map: (d) => ({
          type: 'reminder', id: d._id,
          title: d.title || '(untitled)',
          subtitle: [d.ruleId, d.category, d.status].filter(Boolean).join(' · '),
          link: `/compliance-reminders/${d._id}`,
        }),
      },
    ]

    const matchFields = (obj, fields) =>
      fields.some((f) => obj[f] != null && String(obj[f]).toLowerCase().includes(term))

    // 简单相关度打分（与后端 search.js 一致）：exact=100 > prefix=60 > substring=15
    const scoreOf = (obj, fields) => {
      let best = 0
      for (const f of fields) {
        let vals = obj[f]
        if (vals == null) continue
        if (!Array.isArray(vals)) vals = [vals]
        for (let raw of vals) {
          if (raw == null) continue
          const v = String(raw).toLowerCase()
          if (v === term) best = Math.max(best, 100)
          else if (v.startsWith(term)) best = Math.max(best, 60)
          else if (v.includes(term)) best = Math.max(best, 15)
        }
      }
      return best
    }

    const results = []
    const counts = {}
    defs.forEach((def) => {
      const cap = limit || def.limit
      const hits = def.arr
        .filter((d) => matchFields(d, def.fields))
        .map((d) => ({ ...def.map(d), score: scoreOf(d, def.fields) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, cap)
      counts[def.type] = hits.length
      results.push(...hits)
    })

    return { data: { data: { results, counts, query: raw } } };
  },
};

// ====== 业绩排期 Mock（CSMS 集成 POC）======
// 前端 mock 预览专用：使用 timetableEngine 生成完整逼真的排期（规则库真源在后端）。
// 仅用于 UI 预览；真实生成请切换 VITE_USE_MOCK=false 走后端引擎。
const DEFAULT_ANCHORS = {
  interim: { T0: '2026-06-30', T1: '2026-08-20', T2: '2026-09-22' },
  annual:  { T0: '2025-12-31', T1: '2026-03-20', T2: '2026-04-30', T3: '2026-06-20', T4: '2026-05-28' },
};

/**
 * Mock 模式的规则库修订号。
 * 真实路径下该值来自 MongoDB `RuleLibrary.revision`（每次保存/导入 +1）；
 * 前端副本 timetableData.js 是随代码发布的静态文件、没有落库修订概念，故固定为 1。
 */
const MOCK_RULE_LIBRARY_VERSION = 1;

/**
 * 由前端规则库副本构造「生成时刻快照」，形状与后端 buildLibrarySnapshot 严格一致，
 * 使 ResultsTimetable 预览页在 mock / 真实两条链路上取值代码完全相同。
 */
const buildMockLibrarySnapshot = () => ({
  version: (RULES_MOCK.meta && RULES_MOCK.meta.version) || '',
  revision: MOCK_RULE_LIBRARY_VERSION,
  meta: RULES_MOCK.meta || {},
  parties: RULES_MOCK.parties || {},
  rules: RULES_MOCK.rules || {},
  offsets_midyear: RULES_MOCK.offsets_midyear || [],
  offsets_annual: RULES_MOCK.offsets_annual || [],
  tasks_midyear: RULES_MOCK.tasks_midyear || [],
  tasks_annual: RULES_MOCK.tasks_annual || [],
  compliance_checks: RULES_MOCK.compliance_checks || {},
  generatedAt: new Date().toISOString(),
});

export const schedules = {
  generate: async (payload = {}) => {
    await delay();
    const period = payload.period === 'annual' ? 'annual' : 'interim';
    const anchors = payload.anchors && Object.keys(payload.anchors).length ? payload.anchors : DEFAULT_ANCHORS[period];
    const eng = engineGenerate(period, anchors);
    return { data: { data: { id: 'rt-mock-' + Date.now(), period, anchors: eng.anchors, items: eng.items, offsets: eng.offsets, compliance: eng.compliance, tasksCreated: eng.items.length, ruleLibraryVersion: MOCK_RULE_LIBRARY_VERSION, ruleLibrarySnapshot: buildMockLibrarySnapshot() } } };
  },
  list: async () => {
    await delay();
    return { data: { data: { results: [ { _id: 'rt-mock-1', company: { name: '中国新城市' }, name: '中国新城市', period: 'interim', createdAt: new Date().toISOString(), ruleLibraryVersion: MOCK_RULE_LIBRARY_VERSION } ] } } };
  },
  getOne: async (id) => {
    await delay();
    const eng = engineGenerate('interim', DEFAULT_ANCHORS.interim);
    return { data: { data: { id, period: 'interim', anchors: eng.anchors, items: eng.items, offsets: eng.offsets, compliance: eng.compliance, tasksCreated: eng.items.length, ruleLibraryVersion: MOCK_RULE_LIBRARY_VERSION, ruleLibrarySnapshot: buildMockLibrarySnapshot() } } };
  },
  excelDownload: async () => ({ data: { data: { ok: false, message: 'Mock 模式不支持下载 Excel，请切换真实后端（VITE_USE_MOCK=false）' } } }),
  // ─── 规则库管理（Admin Panel）───
  // Mock 模式只读前端副本；保存 / 导入不落库，仅回执提示。
  getRules: async () => {
    await delay();
    // 补 revision 字段，使 mock 模式下「· 修订 vN」徽标与快照（MOCK_RULE_LIBRARY_VERSION）口径一致
    return { data: { data: { ...JSON.parse(JSON.stringify(RULES_MOCK)), revision: MOCK_RULE_LIBRARY_VERSION } } };
  },
  saveRules: async (payload) => {
    await delay();
    // Mock 模式：把编辑后的规则库写回内存副本，使后续生成能反映参与方指派 / 任务改动
    if (payload && typeof payload === 'object') {
      try { Object.assign(RULES_MOCK, JSON.parse(JSON.stringify(payload))); } catch { /* 忽略非序列化内容 */ }
    }
    return { data: { data: { ok: true, mock: true, message: 'Mock 模式：修改已写入会话内存副本（不落库，刷新页面即还原）' } } };
  },
  importRules: async () => {
    await delay();
    return { data: { data: { ok: true, mock: true, message: 'Mock 模式：导入仅预览，不落库' } } };
  },
};

// ====== Calendar（Wave 日历模块 · Mock）======
// 自合成贴近「当前月」的样例事件，覆盖 6 类来源，含逾期项，保证 mock 模式演示有数据。
// 真实后端走 /api/calendar/events（server/services/calendarService.js）。
const mockDate = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d }
const mockIso = (d) => d.toISOString()
const MOCK_COMPANY_NAME = { 'c-1': '中国新城市', 'c-2': 'Abundant Zone' }

// 第 7 源（user_event）样例 + 增删改内存数组（刷新页面后重置，符合「mock 仅演示」定位）
let userEvents = [
  { id: 'ue-1', source: 'user_event', module: '我的事件', title: '董事会现场会', date: mockIso(mockDate(2)), time: '14:30', allDay: false, priority: 'medium', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '', category: '会议', note: '' },
  { id: 'ue-2', source: 'user_event', module: '我的事件', title: '出差 · 深圳', date: mockIso(mockDate(7)), time: '', allDay: true, priority: 'medium', status: 'open', overdue: false, companyId: null, companyName: null, link: '', category: '出差', note: '' },
]

export const calendar = {
  getEvents: async (from, to, types) => {
    await delay();
    const now = new Date()
    const addDays = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d }
    const iso = (d) => d.toISOString()

    const all = [
      { id: 'cr-1', source: 'compliance_reminder', module: '合规提醒', title: '提交周年申报表 (NAR1)', date: iso(addDays(-3)), priority: 'high', status: 'overdue', overdue: true, companyId: 'c-1', companyName: '中国新城市', link: '/compliance-reminders/cr-1' },
      { id: 'cr-2', source: 'compliance_reminder', module: '合规提醒', title: '备存董事名册', date: iso(addDays(9)), priority: 'medium', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '/compliance-reminders/cr-2' },
      { id: 't-1', source: 'task', module: '任务', title: '签署董事会决议', date: iso(addDays(-1)), priority: 'urgent', status: 'overdue', overdue: true, companyId: 'c-2', companyName: 'Abundant Zone', link: '/tasks/t-1' },
      { id: 't-2', source: 'task', module: '任务', title: '归档会议纪要', date: iso(addDays(14)), priority: 'medium', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '/tasks/t-2' },
      { id: 'f-1', source: 'company_filing', module: '公司申报', title: 'AGM 到期 · 中国新城市', date: iso(addDays(20)), priority: 'high', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '/companies/c-1' },
      { id: 'd-1', source: 'document', module: '文档', title: '文档到期 · 商业登记证', date: iso(addDays(5)), priority: 'high', status: 'open', overdue: false, companyId: 'c-2', companyName: 'Abundant Zone', link: '/companies/c-2' },
      { id: 'm-1', source: 'meeting', module: '会议', title: '董事会（审议中期业绩）', date: iso(addDays(11)), priority: 'medium', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '/meetings/m-1' },
      { id: 'rt-1', source: 'results_timetable', module: '业绩排期', title: 'T1 董事会/公告 · 中国新城市', date: iso(addDays(16)), priority: 'high', status: 'open', overdue: false, companyId: 'c-1', companyName: '中国新城市', link: '/results-timetable' },
      ...userEvents,
    ]

    const filtered = types && types.length ? all.filter((e) => types.includes(e.source)) : all
    // 轻量 from/to 过滤：落在区间内，或逾期未完成（date < from 且 overdue）
    const fromD = from ? new Date(from) : null
    const toD = to ? new Date(to) : null
    const inRange = filtered.filter((e) => {
      const d = new Date(e.date)
      if (toD && d > toD) return false
      if (fromD && d < fromD && !e.overdue) return false
      return true
    })
    return { data: { data: { events: inRange } } }
  },
  // 新建用户自建事件（内存）
  createEvent: async (payload = {}) => {
    await delay();
    const id = 'ue-' + Date.now()
    const ev = {
      id,
      source: 'user_event',
      module: '我的事件',
      title: payload.title,
      date: new Date(payload.date).toISOString(),
      time: payload.time || '',
      allDay: payload.allDay !== false,
      priority: 'medium',
      status: 'open',
      overdue: false,
      companyId: payload.companyId || null,
      companyName: payload.companyId ? (MOCK_COMPANY_NAME[payload.companyId] || '关联公司') : null,
      link: '',
      category: payload.category || '',
      note: payload.note || '',
    }
    userEvents.push(ev)
    return { data: { data: { success: true, event: ev } } }
  },
  // 编辑用户自建事件（内存）
  updateEvent: async (id, payload = {}) => {
    await delay();
    const idx = userEvents.findIndex((e) => e.id === id)
    if (idx === -1) return { data: { data: { success: false, message: '事件不存在' } } }
    const cur = userEvents[idx]
    const merged = {
      ...cur,
      ...payload,
      date: payload.date ? new Date(payload.date).toISOString() : cur.date,
      time: payload.time !== undefined ? (payload.time || '') : cur.time,
      allDay: payload.allDay !== undefined ? !!payload.allDay : cur.allDay,
      companyId: payload.companyId !== undefined ? (payload.companyId || null) : cur.companyId,
      companyName:
        payload.companyId !== undefined
          ? (payload.companyId ? (MOCK_COMPANY_NAME[payload.companyId] || '关联公司') : null)
          : cur.companyName,
    }
    userEvents[idx] = merged
    return { data: { data: { success: true, event: merged } } }
  },
  // 删除用户自建事件（内存）
  deleteEvent: async (id) => {
    await delay();
    userEvents = userEvents.filter((e) => e.id !== id)
    return { data: { data: { success: true } } }
  },
};
