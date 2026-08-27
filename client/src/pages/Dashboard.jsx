import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { companyService, personnelService, documentService, meetingService, complianceReminderService, templateService, taskService, calendarService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { toArray } from '../utils/responseNormalize.js'
import { LoadingSpinner } from '../components/UIHelpers'
import { useAuth } from '../contexts/AuthContext.jsx'
import BrandLogo from '../components/BrandLogo'
import {
  CsmsIconCompanies, CsmsIconPersonnel, CsmsIconDocuments, CsmsIconMeetings,
  CsmsIconTasks, CsmsIconSign, CsmsIconCompliance, CsmsIconTemplate,
  CsmsIconOverdue, CsmsIconUrgent, CsmsIconUpcoming, CsmsIconResults,
  CsmsIconAddTask, CsmsIconAddSign,
} from '../components/CsmsIcons'
import {
  RefreshCw, ArrowRight,
} from 'lucide-react'

const BANNER_KEY = 'csms.dashboardBanner'

// 日历来源着色（与 pages/Calendar.jsx 保持一致）
const SOURCE_COLOR = {
  compliance_reminder: '#ef4444',
  task: '#2563EB',
  company_filing: '#f59e0b',
  document: '#0ea5e9',
  meeting: '#8b5cf6',
  results_timetable: '#ec4899',
}

const fmtTime = (d) => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—'

export default function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.name || '林才贺'
  const [stats, setStats] = useState(null)
  const [upcomingMeetings, setUpcomingMeetings] = useState([])
  const [upcomingReminders, setUpcomingReminders] = useState([])
  const [expiredReminders, setExpiredReminders] = useState([])
  const [_recentMeetings, setRecentMeetings] = useState([])
  const [urgentTasks, setUrgentTasks] = useState([])
  const [pendingTasksCount, setPendingTasksCount] = useState(0)
  const [signTasksCount, setSignTasksCount] = useState(0)
  const [templatesCount, setTemplatesCount] = useState(0)
  const [calendarItems, setCalendarItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [bannerVariant, setBannerVariant] = useState(() => localStorage.getItem(BANNER_KEY) || 'light')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // 各服务独立调用，统计卡片数据不再依赖单一 getDashboardStats 端点（该端点内联
      //   调 getAll 容易级联失败导致全部归零）。改为从各独立响应中自行聚合。
      const [
        compRes,
        persRes,
        docRes,
        meetRes,
        reminderUpRes,
        reminderExpRes,
        tasksRes,
        templRes,
      ] = await Promise.all([
        companyService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        personnelService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        documentService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        meetingService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getScheduled({ status: 'upcoming' }).catch(() => ({ data: { data: [] } })),
        complianceReminderService.getExpired().catch(() => ({ data: { data: [] } })),
        taskService.getAll().catch(() => ({ data: { data: [] } })),
        templateService.getAll().catch(() => ({ data: { data: [] } })),
      ])

      // 从各服务独立响应中聚合统计，单点故障不影响其余卡片
      const companies = compRes.data?.data || []
      const personnel = persRes.data?.data || []
      const documents = docRes.data?.data || []
      const meetings = meetRes.data?.data || []
      setStats({
        totalCompanies: companies.length || compRes.data?.total || 0,
        activeCompanies: companies.filter(c => c.status === 'active').length,
        totalPersonnel: personnel.length || persRes.data?.total || 0,
        totalDocuments: documents.length || docRes.data?.total || 0,
        totalMeetings: meetings.length,
      })
      setUpcomingMeetings(meetings.filter(m => m.status === 'scheduled' || m.status === 'draft').slice(0, 5))
      setRecentMeetings(meetings.filter(m => m.status === 'completed').slice(0, 3))
      setExpiredReminders(reminderExpRes.data?.data || [])
      setUpcomingReminders(reminderUpRes.data?.data || [])

      // Parse tasks for urgency
      const allTasks = tasksRes.data?.data || []
      const now = new Date()
      const pending = allTasks.filter(t => t.status !== 'completed')
      const urgent = pending.filter(t => {
        const days = Math.ceil((new Date(t.dueDate) - now) / 86400000)
        return days <= 3 || days < 0
      }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      setUrgentTasks(urgent.slice(0, 5))
      setPendingTasksCount(pending.length)
      setTemplatesCount(templRes.data?.data?.length || 0)
      // 签署任务总数 = 全部 type === 'signing' 的任务
      const signingTasks = allTasks.filter(t => t.type === 'signing')
      setSignTasksCount(signingTasks.length)
    } catch {
      // silently fail - stats will show zeros
    } finally {
      setLoading(false)
      setLastRefreshed(new Date())
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // 日历聚合：本月 + 未来 14 天的未完成事件（逾期 + 待办），作为 Dashboard「打开即见」提醒面
  useEffect(() => {
    (async () => {
      try {
        const now = new Date()
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const from = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
        const to = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 14))
        const res = await calendarService.getEvents(from, to).catch(() => ({ data: { data: { events: [] } } }))
        const list = toArray(res?.data?.data, 'events')
        setCalendarItems(
          list
            .filter((e) => e.status === 'open' || e.status === 'overdue')
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 8)
        )
      } catch {
        /* 日历面板失败不影响其余卡片 */
      }
    })()
  }, [])

  // 时段问候（纯视图逻辑，不调接口）
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '凌晨好'
    if (h < 12) return '上午好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  // Banner 摘要：干净、可读、用真实数据
  const bannerSummary = useMemo(() => {
    const parts = []
    if (pendingTasksCount) parts.push(`今日 ${pendingTasksCount} 项待办`)
    if (signTasksCount) parts.push(`${signTasksCount} 份待签文件`)
    if (expiredReminders.length) parts.push(`${expiredReminders.length} 项逾期`)
    if (upcomingReminders.length && !parts.length) parts.push(`${upcomingReminders.length} 项即将到期`)
    return parts.length ? parts.join(' · ') : '全局合规概览已就绪'
  }, [pendingTasksCount, signTasksCount, expiredReminders.length, upcomingReminders.length])

  const toggleBanner = () => {
    const next = bannerVariant === 'navy' ? 'light' : 'navy'
    localStorage.setItem(BANNER_KEY, next)
    setBannerVariant(next)
  }

  // 8 项核心指标（标签 / 数据不变；副文案用真实派生数据，去除占位 trend 串）
  const metrics = [
    { icon: CsmsIconCompanies, label: '公司总数', value: stats?.totalCompanies || 0, sub: `在管 ${stats?.activeCompanies || 0} 家`, to: '/companies' },
    { icon: CsmsIconPersonnel, label: '人员库', value: stats?.totalPersonnel || 0, sub: '董事 · 股东 · 员工', to: '/personnel' },
    { icon: CsmsIconDocuments, label: '文档', value: stats?.totalDocuments || 0, sub: '归档与模板', to: '/documents' },
    { icon: CsmsIconMeetings, label: '会议', value: stats?.totalMeetings || 0, sub: '本年度排期', to: '/meetings' },
    { icon: CsmsIconTasks, label: '待办 Task', value: pendingTasksCount, sub: `${urgentTasks.length} 项紧急`, to: '/tasks' },
    { icon: CsmsIconSign, label: '签署任务', value: signTasksCount, sub: '待签署', to: '/sign-tasks' },
    { icon: CsmsIconCompliance, label: '合规提醒', value: upcomingReminders.length, sub: `${expiredReminders.length} 项逾期`, to: '/compliance-reminders' },
    { icon: CsmsIconTemplate, label: '模板', value: templatesCount, sub: '可复用', to: '/templates' },
  ]

  // 快捷操作：状态快捷入口 + 创建快捷入口（全部使用 CSMS 专属定制图标）
  const quickActions = [
    { to: '/compliance-reminders', label: '逾期合规', count: expiredReminders.length, icon: CsmsIconOverdue, tone: 'danger' },
    { to: '/tasks', label: '紧急任务', count: urgentTasks.length, icon: CsmsIconUrgent, tone: 'warn' },
    { to: '/compliance-reminders', label: '即将到期', count: upcomingReminders.length, icon: CsmsIconUpcoming, tone: 'info' },
    { to: '/results-timetable', label: '业绩排期', icon: CsmsIconResults, tone: 'info' },
    { to: '/tasks?open=new', label: '新增一般任务', icon: CsmsIconAddTask, tone: 'action' },
    { to: '/tasks?mode=signing', label: '新增签署任务', icon: CsmsIconAddSign, tone: 'action' },
  ]

  // 逾期 + 紧急合并（各取前 3，右侧去色：中性小字 + 中性小圆点）
  const now = new Date()
  const attention = [
    ...expiredReminders.map(r => ({ kind: 'expired', item: r })),
    ...urgentTasks.map(t => ({ kind: 'urgent', item: t })),
  ].slice(0, 3)

  const attentionRight = (kind, item) => {
    const due = item.dueDate ? Math.ceil((new Date(item.dueDate) - now) / 86400000) : null
    if (kind === 'expired') return due !== null && due < 0 ? `逾期${Math.abs(due)}天` : '逾期'
    if (due === null) return ''
    if (due < 0) return `逾期${Math.abs(due)}天`
    if (due === 0) return '今天'
    return `${due}天后`
  }

  // 所有 hook 与派生计算必须在 early return 之前完成，保证每次 render 的 hook 数量一致
  if (loading) return <LoadingSpinner size="lg" />

  return (
    <>
      <a className="skip-link" href="#main">跳到主内容</a>
      <div id="main" className="max-w-[var(--fluid-content-max)] mx-auto w-full">

        {/* Hero Banner：深蓝/浅蓝切换 + 印章线框纹理 + CSMS 字标（与设计稿同系列） */}
        <div className={`dash-banner dash-banner--${bannerVariant}`}>
          <button
            type="button"
            className="dash-banner__toggle"
            onClick={toggleBanner}
            title={`当前：${bannerVariant === 'navy' ? '深蓝' : '浅蓝'}，点击切换`}
            aria-label="切换 Banner 风格"
          >
            <span className={bannerVariant === 'navy' ? 'is-active' : ''}>深蓝</span>
            <span className="dash-banner__toggle-divider" aria-hidden="true">/</span>
            <span className={bannerVariant === 'light' ? 'is-active' : ''}>浅蓝</span>
          </button>

          <div className="dash-banner__watermark" aria-hidden="true" />

          <div className="dash-banner__body">
            <div className="dash-banner__main">
              <h2 className="dash-banner__title">{getGreeting()}，{displayName}</h2>
              <p className="dash-banner__summary">{bannerSummary}</p>
            </div>

            <Link to="/tasks" className="dash-banner__cta">
              查看待办 <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* 快捷操作：状态入口 + 创建入口，全部可点 */}
        <div className="dash-eyebrow dash-eyebrow--plain">
          <div className="dash-eyebrow__title"><span className="cn">快捷操作</span><span className="en">Quick Actions</span></div>
        </div>
        <div className="quick-actions" role="group" aria-label="快捷操作">
          {quickActions.map((a, i) => {
            const Icon = a.icon
            return (
              <Link
                key={i}
                to={a.to}
                className={`qa-chip qa-chip--${a.tone}`}
              >
                <Icon size={16} />
                <span>{a.label}</span>
                {typeof a.count === 'number' && <span className="qa-chip__count">{a.count}</span>}
              </Link>
            )
          })}
        </div>

        {/* 核心指标：分区眉标 + 刷新（去掉占位 trend，副文案改用真实派生数据） */}
        <div className="dash-eyebrow">
          <div className="dash-eyebrow__title"><span className="cn">核心指标</span><span className="en">Key Metrics</span></div>
          <button className="dash-eyebrow__action" onClick={loadAll} title="刷新数据">
            <RefreshCw size={15} /> 刷新数据
          </button>
        </div>
        <div className="metric-grid">
          {metrics.map((m, i) => (
            <Link to={m.to} className="metric-card" key={i} aria-label={`查看${m.label}`}>
              <div className="m-ico"><m.icon size={20} /></div>
              <p className="m-label">{m.label}</p>
              <p className="m-value">{m.value}</p>
              <p className="m-sub">{m.sub}</p>
            </Link>
          ))}
        </div>

        {/* 近期动态：会议 / 逾期与紧急 / 本月待办（日历整卡，三卡同栅格对齐） */}
        <div className="dash-eyebrow dash-eyebrow--plain">
          <div className="dash-eyebrow__title"><span className="cn">近期动态</span><span className="en">Activity</span></div>
        </div>
        <div className="mini-grid">
          <div className="mini-col">
            <div className="mini-col__head">
              <h3 className="mini-col__title"><CsmsIconMeetings size={18} />即将到来的会议</h3>
              <Link to="/meetings" className="mini-col__more">查看全部</Link>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="text-ink-3 text-sm py-4 text-center">暂无即将到来的会议</p>
            ) : (
              upcomingMeetings.slice(0, 3).map(m => (
                <Link to={`/meetings/${m._id}`} className="mini-row" key={m._id}>
                  <div className="mr-main">
                    <p className="mr-t">{m.title}</p>
                    <p className="mr-s">{m.company?.name} · {m.type?.toUpperCase()}</p>
                  </div>
                  <span className="mr-right">{formatDate(m.scheduledAt)}</span>
                </Link>
              ))
            )}
          </div>

          <div className="mini-col">
            <div className="mini-col__head">
              <h3 className="mini-col__title"><CsmsIconUrgent size={18} />逾期与紧急</h3>
              <Link to="/compliance-reminders" className="mini-col__more">查看全部</Link>
            </div>
            {attention.length === 0 ? (
              <p className="text-ink-3 text-sm py-4 text-center">暂无逾期与紧急事项</p>
            ) : (
              attention.map(({ kind, item }, idx) => {
                const to = kind === 'expired' ? `/compliance-reminders/${item._id}` : `/tasks/${item._id}`
                return (
                  <Link to={to} className="mini-row" key={`${item._id || kind}-${idx}`}>
                    <div className="mr-main">
                      <p className="mr-t">{item.title}</p>
                      <p className="mr-s">{item.company?.name || '未关联'} · {kind === 'expired' ? '逾期合规' : '紧急任务'}</p>
                    </div>
                    <span className="mr-right"><i className="mi-dot"></i>{attentionRight(kind, item)}</span>
                  </Link>
                )
              })
            )}
          </div>

          <div className="mini-col mini-col--full">
            <div className="mini-col__head">
              <h3 className="mini-col__title"><CsmsIconUpcoming size={18} />本月待办 / 临近到期</h3>
              <Link to="/calendar" className="mini-col__more">打开日历</Link>
            </div>
            {calendarItems.length === 0 ? (
              <p className="text-ink-3 text-sm py-4 text-center">本月暂无待办 🎉</p>
            ) : (
              <div className="mini-col__grid">
                {calendarItems.map((e) => (
                  <Link to={e.link} className="mini-row" key={e.id}>
                    <div className="mr-main">
                      <p className="mr-t">{e.title}</p>
                      <p className="mr-s">{e.module} · {e.companyName || '未关联'}</p>
                    </div>
                    <span className="mr-right" style={{ color: e.overdue ? '#b91c1c' : '#64748b' }}>
                      <i className="mi-dot" style={{ background: e.overdue ? '#ef4444' : (SOURCE_COLOR[e.source] || '#64748b') }}></i>
                      {e.overdue ? '逾期' : formatDate(e.date)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 页脚：收尾，给页面完整感 */}
        <footer className="dash-footer">
          <span className="dash-footer__brand"><BrandLogo variant="icon" size="sm" /> CSMS</span>
          <span className="dash-footer__meta">香港公司秘书管理系统 · 最后更新 {fmtTime(lastRefreshed)}</span>
        </footer>

      </div>
    </>
  )
}
