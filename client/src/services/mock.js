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
    type: 'private_limited', status: 'active', jurisdiction: 'Hong Kong',
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
    type: 'private_limited', status: 'active', jurisdiction: 'Hong Kong',
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
    type: 'private_limited', status: 'active', jurisdiction: 'Hong Kong',
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
    type: 'private_limited', status: 'active', jurisdiction: 'Hong Kong',
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
    type: 'private_limited', status: 'active', jurisdiction: 'Hong Kong',
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
    type: 'public_limited', status: 'active', jurisdiction: 'Cayman Islands',
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
  { _id: 'c12', name: 'Conyers Trust Company (Cayman) Ltd', registrationNumber: 'N/A', type: 'service_provider', status: 'active', jurisdiction: 'Cayman Islands', links: [] },
];

// ====== 文档数据 ======
const MOCK_DOCUMENTS = [
  { _id: 'd1', name: 'NAR1 周年申报表 2026', type: 'return', company: { _id: 'c1', name: 'Easy Rich Corporation Ltd (順富興業)', registrationNumber: '65940948' }, personnel: null, fileUrl: '/docs/EasyRich_NAR1_2026.pdf', fileName: 'NAR1 - Easy Rich Corporation Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-04-21' },
  { _id: 'd2', name: 'NAR1 周年申报表 2026', type: 'return', company: { _id: 'c2', name: 'Zhong An Travel Ltd (眾安旅遊)', registrationNumber: '69459923' }, personnel: null, fileUrl: '/docs/ZhongAn_NAR1_2026.pdf', fileName: 'NAR1- Zhong An Travel Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-06-10' },
  { _id: 'd3', name: 'NAR1 周年申报表 2026', type: 'return', company: { _id: 'c3', name: 'HuiJun (International) Holdings Ltd (匯駿控股)', registrationNumber: '35387857' }, personnel: null, fileUrl: '/docs/Huijun_NAR1_2026.pdf', fileName: 'NAR1 - HuiJun (International) Holdings Ltd 2026.pdf', fileSize: 512000, createdAt: '2026-06-10' },
  { _id: 'd4', name: 'NAR1 周年申报表 2025', type: 'return', company: { _id: 'c4', name: 'Hong Kong Time Honour Property Ltd (香港時駿地産)', registrationNumber: '63822186' }, personnel: null, fileUrl: '/docs/TimeHonour_NAR1_2025.pdf', fileName: 'NAR1 - Hong Kong Time Honour Property Ltd 2025.pdf', fileSize: 512000, createdAt: '2025-12-04' },
  { _id: 'd5', name: 'NAR1 周年申报表 2025', type: 'return', company: { _id: 'c5', name: 'Pannix Industrial (Hong Kong) Ltd (佳穎實業)', registrationNumber: '63822047' }, personnel: null, fileUrl: '/docs/Pannix_NAR1_2025.pdf', fileName: 'NAR1 - Pannix Industrial (Hong Kong) Limited 2025.pdf', fileSize: 512000, createdAt: '2025-12-02' },
  // 个人证件文档
  { _id: 'd6', name: '施金帆 — 香港身份证', type: 'id_document', company: null, personnel: { _id: 'p1', name: '施金帆' }, fileUrl: '', fileName: 'shijinfan_id.pdf', fileSize: 256000, createdAt: '2025-01-01' },
  { _id: 'd7', name: '施南路 — 护照复印件', type: 'passport', company: null, personnel: { _id: 'p2', name: '施南路' }, fileUrl: '', fileName: 'shinanlu_passport.pdf', fileSize: 256000, createdAt: '2025-01-01' },
  { _id: 'd8', name: '施中安 — 香港身份证', type: 'id_document', company: null, personnel: { _id: 'p3', name: '施中安 (施侃成)' }, fileUrl: '', fileName: 'shizhongan_id.pdf', fileSize: 256000, createdAt: '2025-01-01' },
  { _id: 'd9', name: '林才賀 — NRIC副本', type: 'id_document', company: null, personnel: { _id: 'p4', name: '林才賀 (LIN CAI HE)' }, fileUrl: '', fileName: 'lincaihe_nric.pdf', fileSize: 256000, createdAt: '2025-01-01' },
  // CNC 文档
  { _id: 'd10', name: 'NAR1 NN3 周年申报表 2025', type: 'return', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_NAR1_NN3_2025.pdf', fileSize: 1024000, createdAt: '2025-11-01', notes: '注册非香港公司周年申报表' },
  { _id: 'd11', name: 'Certificate of Incumbency 2026-01-08', type: 'certificate', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_COI_20260108.pdf', fileSize: 512000, createdAt: '2026-01-08', notes: '在职证明' },
  { _id: 'd12', name: 'Certificate of Good Standing 2026-01-07', type: 'certificate', company: { _id: 'c8', name: 'China New City Group Ltd (中国新城市集团)', registrationNumber: '62264234' }, personnel: null, fileUrl: '', fileName: 'CNC_CGS_20260107.pdf', fileSize: 512000, createdAt: '2026-01-07', notes: '存续证明 / 良好存续证书' },
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

// ====== 导出 ======
export const DEMO_USER = {
  id: 'u1', name: 'Alice Chen', email: 'alice@example.com', role: 'secretary', token: 'demo-token-xxx',
};
export { MOCK_COMPANIES as DEMO_COMPANIES, MOCK_PERSONNEL as DEMO_PERSONNEL, MOCK_DOCUMENTS as DEMO_DOCUMENTS, MOCK_MEETINGS as DEMO_MEETINGS, STATS as DEMO_STATS };

// ====== Auth Service ======
export const auth = {
  login: async (email, password) => {
    await delay(100);
    const demoEmail = DEMO_USER.email;
    const demoPass = 'demo123';
    if (email === demoEmail && password === demoPass) return { data: { data: DEMO_USER } };
    if (email === 'admin@example.com' && password === 'admin123') return { data: { data: { ...DEMO_USER, role: 'admin' } } };
    if (email === 'secretary@example.com' && password === 'secretary123') return { data: { data: { ...DEMO_USER, role: 'secretary' } } };
    if (email === 'manager@example.com' && password === 'manager123') return { data: { data: { ...DEMO_USER, role: 'secretary' } } };
    if (email === 'viewer@example.com' && password === 'viewer123') return { data: { data: { ...DEMO_USER, role: 'viewer' } } };
    const err = new Error('Invalid credentials');
    err.response = { data: { message: 'Invalid credentials' } };
    throw err;
  },
  register: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  getMe: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  updateProfile: async () => { await delay(); return { data: { data: DEMO_USER } }; },
  updatePassword: async () => { await delay(); return { data: { data: { token: 'new-token' } } }; },
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
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
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
    return { data: { data: list, total: list.length, totalPages: 1, currentPage: 1 } };
  },
  getOne: async (id) => {
    await delay();
    const d = MOCK_DOCUMENTS.find(doc => doc._id === id);
    return { data: { data: d || MOCK_DOCUMENTS[0] } };
  },
  getByCompany: async (companyId) => {
    await delay();
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.company?._id === companyId) } };
  },
  getByPersonnel: async (personnelId) => {
    await delay();
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.personnel?._id === personnelId) } };
  },
  upload: async () => { await delay(); return { data: { data: MOCK_DOCUMENTS[0] } }; },
  delete: async (id) => { await delay(); return { data: { data: { _id: id } } }; },
  getExpiring: async () => {
    await delay();
    return { data: { data: MOCK_DOCUMENTS.filter(d => d.expiresAt || d.renewalDueDate) } };
  },
};

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
};

// ====== Notice HTML Builder ======
function buildNoticeHtml({ greeting, customNote, dateStr, timeRange, meetingType, agendaItems, locationInfo, meetingId, meetingPassword, meetingLink, isVirtual, location, attendeeNames, signOff, companyName, companyCode }) {
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

// ====== Tasks Service (stub) ======
export const tasks = {
  getAll: async () => { await delay(); return { data: { data: [], total: 0 } }; },
  create: async () => { await delay(); return { data: { data: {} } }; },
  update: async () => { await delay(); return { data: { data: {} } }; },
  delete: async () => { await delay(); return { data: { data: {} } }; },
};

// ====== Compliance Rules (stub) ======
export const complianceRules = {
  getAll: async () => { await delay(); return { data: { data: [] } }; },
};

// ====== Compliance Reminders (stub) ======
export const complianceReminders = {
  getAll: async () => { await delay(); return { data: { data: [] } }; },
};

// ====== Templates (stub) ======
export const templates = {
  getAll: async () => { await delay(); return { data: { data: [] } }; },
};

// ====== Sign Tasks (stub) ======
export const signTasks = {
  getAll: async () => { await delay(); return { data: { data: [] } }; },
};
