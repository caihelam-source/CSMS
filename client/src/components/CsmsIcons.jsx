// CSMS 专属定制图标集 —— 与 logo 印章同系列（navy 锚点 / 圆形+对勾 视觉 DNA）
// 统一规范：viewBox 24×24、stroke-width 1.75、圆角线帽/连接；
// 使用 currentColor 描边，颜色由父容器 .m-ico（navy 方块 → 白字）继承。
// 用途：Dashboard 8 项核心指标卡（公司/人员/文档/会议/待办/签署/合规/模板）。

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 20, children, ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props} aria-hidden="true">
      {children}
    </svg>
  )
}

// 公司总数 —— 企业楼宇 + 顶端印章式收顶圆点
export function CsmsIconCompanies(props) {
  return (
    <Svg {...props}>
      <rect x="6" y="8" width="12" height="13" rx="1.5" />
      <path d="M9.5 21v-4M14.5 21v-4M12 21v-4" />
      <path d="M12 8V3.6" />
      <circle cx="12" cy="2.7" r="1.1" />
    </Svg>
  )
}

// 人员库 —— 双人（前后叠错，体现「库/团队」）
export function CsmsIconPersonnel(props) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="8.5" r="3" />
      <path d="M4.5 19.5c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="16.5" cy="10" r="2.3" />
      <path d="M13.6 19.5c0-2.3 1.4-3.8 2.9-3.8s2.9 1.5 2.9 3.8" />
    </Svg>
  )
}

// 文档 —— 文件 + 右下角印章戳（圆形+对勾，呼应 logo 母题）
export function CsmsIconDocuments(props) {
  return (
    <Svg {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h5M10 15h5M10 18h3" />
      <circle cx="16.5" cy="16.5" r="2.4" />
      <path d="M15.3 16.5l.9.9 1.5-1.8" />
    </Svg>
  )
}

// 会议 —— 日历 + 高亮日期印章（圆形+对勾，呼应 logo 母题）
export function CsmsIconMeetings(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M8 3v3M16 3v3" />
      <circle cx="14.5" cy="14.5" r="2.6" />
      <path d="M13.2 14.5l.9.9 1.7-2" />
    </Svg>
  )
}

// 待办 Task —— 清单 + 品牌对勾
export function CsmsIconTasks(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9l1.5 1.5L13 7.5" />
      <path d="M8 15l1.5 1.5L13 13.5" />
      <path d="M14.5 9h2.5M14.5 15h2.5" />
    </Svg>
  )
}

// 签署任务 —— 已签文件（签名笔迹 + 签名线）
export function CsmsIconSign(props) {
  return (
    <Svg {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M9 13c.8-1.8 1.8.4 2.6-.8s1.4 1.2 2.6.2" />
      <path d="M9 17h6" />
    </Svg>
  )
}

// 合规提醒 —— 时钟（外环 = 印章环母题）+ 指针 + 12 点刻度
export function CsmsIconCompliance(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.5 2" />
      <path d="M12 3v1.6" />
    </Svg>
  )
}

// 模板 —— 页面版式（页眉条 + 左文行 + 图块）+ 右上印章点
export function CsmsIconTemplate(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 8h14" />
      <path d="M8 12h4M8 15.5h4" />
      <rect x="14" y="11" width="3.5" height="3.5" rx="1" />
      <circle cx="16" cy="5.5" r="1" />
    </Svg>
  )
}

export default {
  CsmsIconCompanies,
  CsmsIconPersonnel,
  CsmsIconDocuments,
  CsmsIconMeetings,
  CsmsIconTasks,
  CsmsIconSign,
  CsmsIconCompliance,
  CsmsIconTemplate,
}
