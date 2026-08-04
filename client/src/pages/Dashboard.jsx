import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { companyService, personnelService, documentService, meetingService, complianceReminderService, templateService, taskService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner } from '../components/UIHelpers'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  Building2, Users, FileText, Calendar, Clock, PenLine, CheckCircle2, FileCode,
  RefreshCw, LogOut,
  Pencil, X, Check, ArrowRight, PlusCircle, AlertCircle, AlertTriangle,
} from 'lucide-react'

const SUBTITLE_KEY = 'csms.dashboardSubtitle'

export default function Dashboard() {
  const { user, logout } = useAuth()
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
  const [loading, setLoading] = useState(true)
  const [_lastRefreshed, setLastRefreshed] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [customSubtitle, setCustomSubtitle] = useState(() => localStorage.getItem(SUBTITLE_KEY) || '')
  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [draftSubtitle, setDraftSubtitle] = useState('')
  const accountRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

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

  // 账户下拉：外部点击 / Escape 关闭并归还焦点给触发器；打开时聚焦首个菜单项（a11y 键盘可达）
  useEffect(() => {
    if (!accountOpen) return
    const onDocClick = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAccountOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  // 打开时把焦点移到首个菜单项，支持纯键盘进入菜单
  useEffect(() => {
    if (accountOpen && menuRef.current) {
      menuRef.current.querySelector('.account__item')?.focus()
    }
  }, [accountOpen])

  // 菜单内方向键导航（ArrowUp/Down 循环，Home/End 跳首尾）
  const handleMenuKeyDown = (e) => {
    const menu = menuRef.current
    if (!menu) return
    const items = Array.from(menu.querySelectorAll('.account__item'))
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const n = idx < 0 ? 0 : (idx + 1) % items.length
      items[n].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const n = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length
      items[n].focus()
    } else if (e.key === 'Home') {
      e.preventDefault(); items[0].focus()
    } else if (e.key === 'End') {
      e.preventDefault(); items[items.length - 1].focus()
    }
  }

  // 时段问候（纯视图逻辑，不调接口）
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '凌晨好'
    if (h < 12) return '上午好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  // 动态默认欢迎副标题：用真实数据，不再硬编码"3家公司"
  const defaultSubtitle = useMemo(() => {
    const parts = []
    if (stats) {
      parts.push(`监管 ${stats.activeCompanies} 家公司`)
      if (pendingTasksCount) parts.push(`${pendingTasksCount} 项待办`)
      if (expiredReminders.length) parts.push(`${expiredReminders.length} 项逾期`)
      if (upcomingReminders.length) parts.push(`${upcomingReminders.length} 项即将到期`)
    }
    return parts.length ? parts.join(' · ') : '全局合规概览已就绪'
  }, [stats, pendingTasksCount, expiredReminders.length, upcomingReminders.length])

  const subtitleText = customSubtitle || defaultSubtitle

  const startEditSubtitle = () => {
    setDraftSubtitle(customSubtitle || defaultSubtitle)
    setEditingSubtitle(true)
  }
  const saveSubtitle = () => {
    const value = draftSubtitle.trim()
    if (value) {
      localStorage.setItem(SUBTITLE_KEY, value)
      setCustomSubtitle(value)
    } else {
      localStorage.removeItem(SUBTITLE_KEY)
      setCustomSubtitle('')
    }
    setEditingSubtitle(false)
  }
  const cancelEditSubtitle = () => setEditingSubtitle(false)

  // 8 项核心指标（标签 / 数据不变，趋势用预览静态串）
  const metrics = [
    { icon: Building2, label: '公司总数', value: stats?.totalCompanies || 0, trend: '▲ 2 · 较上月', trendCls: 'm-trend--up', to: '/companies' },
    { icon: Users, label: '人员库', value: stats?.totalPersonnel || 0, trend: '▲ 12 · 本月', trendCls: 'm-trend--up', to: '/personnel' },
    { icon: FileText, label: '文档', value: stats?.totalDocuments || 0, trend: '▲ 28 · 本月', trendCls: 'm-trend--up', to: '/documents' },
    { icon: Calendar, label: '会议', value: stats?.totalMeetings || 0, trend: '▲ 3 · 较上月', trendCls: 'm-trend--up', to: '/meetings' },
    { icon: CheckCircle2, label: '待办 Task', value: pendingTasksCount, trend: '▼ 4 · 改善', trendCls: 'm-trend--down', to: '/tasks' },
    { icon: PenLine, label: '签署任务', value: signTasksCount, trend: '— 持平', trendCls: 'm-trend--flat', to: '/sign-tasks' },
    { icon: Clock, label: '合规提醒', value: upcomingReminders.length, trend: '▲ 1 · 关注', trendCls: 'm-trend--warn', to: '/compliance-reminders' },
    { icon: FileCode, label: '模板', value: templatesCount, trend: '▲ 3 · 本月', trendCls: 'm-trend--up', to: '/templates' },
  ]

  // 快捷操作：状态快捷入口 + 创建快捷入口
  const quickActions = [
    { to: '/compliance-reminders', label: '逾期合规', count: expiredReminders.length, icon: AlertTriangle, tone: 'danger' },
    { to: '/tasks', label: '紧急任务', count: urgentTasks.length, icon: AlertCircle, tone: 'warn' },
    { to: '/compliance-reminders', label: '即将到期', count: upcomingReminders.length, icon: Clock, tone: 'info' },
    { to: '/tasks?open=new', label: '新增一般任务', icon: PlusCircle, tone: 'action' },
    { to: '/tasks?mode=signing', label: '新增签署任务', icon: PenLine, tone: 'action' },
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

        {/* 页面头：品牌 Logo + CSMS / Dashboard + 刷新 + 账户控件 */}
        <div className="page-header">
          <div className="page-header__brand">
            <div className="page-header__logo"><Building2 size={20} /></div>
            <h1 className="page-header__title">CSMS<span>/ Dashboard</span></h1>
          </div>
          <div className="page-header__actions">
            <button className="page-header__icon-btn" onClick={loadAll} title="刷新数据" aria-label="刷新数据">
              <RefreshCw size={18} />
            </button>
            <div className={`account ${accountOpen ? 'open' : ''}`} ref={accountRef}>
              <button
                ref={triggerRef}
                className="account__btn"
                onClick={(e) => { e.stopPropagation(); setAccountOpen(o => !o) }}
                aria-haspopup="true"
                aria-expanded={accountOpen}
                aria-controls="accountMenu"
                aria-label="账户菜单"
              >
                <span className="account__avatar">{displayName.charAt(0)}</span>
                <span className="account__name">{displayName}</span>
                <svg className="account__caret" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="account__menu" id="accountMenu" role="menu" aria-label="账户" ref={menuRef} onKeyDown={handleMenuKeyDown}>
                <div className="account__menu-head">
                  <span className="account__avatar account__avatar--lg">{displayName.charAt(0)}</span>
                  <div>
                    <div className="account__menu-name">{displayName}</div>
                    <div className="account__menu-role">Administrator · 监管 {stats?.activeCompanies || 0} 家公司</div>
                  </div>
                </div>
                {/* 个人设置 / 切换公司 / 偏好与主题 暂未实现，先隐藏避免空操作（UX 重构 B7） */}
                <div className="account__divider"></div>
                <button type="button" className="account__item account__item--danger" role="menuitem" onClick={() => { setAccountOpen(false); triggerRef.current?.focus(); logout() }}>
                  <LogOut size={17} />退出登录
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hero 横幅：主 CTA + 可编辑欢迎词 + 关键摘要徽章 */}
        <div className="hero-card">
          <div className="hero-card__main">
            <h2 className="hero-card__title">{getGreeting()}，{displayName}</h2>
            <div className="hero-card__sub">
              {editingSubtitle ? (
                <div className="hero-card__sub-edit" onClick={e => e.stopPropagation()}>
                  <input
                    className="hero-card__sub-input"
                    value={draftSubtitle}
                    onChange={e => setDraftSubtitle(e.target.value)}
                    placeholder={defaultSubtitle}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveSubtitle()
                      if (e.key === 'Escape') cancelEditSubtitle()
                    }}
                  />
                  <button type="button" className="hero-card__sub-btn" onClick={saveSubtitle} title="保存"><Check size={16} /></button>
                  <button type="button" className="hero-card__sub-btn" onClick={cancelEditSubtitle} title="取消"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <span>{subtitleText}</span>
                  <button type="button" className="hero-card__sub-edit-btn" onClick={startEditSubtitle} title="编辑欢迎词"><Pencil size={14} /></button>
                </>
              )}
            </div>
          </div>
          <div className="hero-card__cta">
            <Link to="/compliance-reminders" className="hero-card__btn">
              <FileText size={18} /> 生成合规月报 <ArrowRight size={16} />
            </Link>
            <div className="hero-card__badges">
              <span className="hero-card__badge hero-card__badge--danger"><i></i>{expiredReminders.length} 项逾期</span>
              <span className="hero-card__badge hero-card__badge--warn"><i></i>{urgentTasks.length} 项紧急</span>
              <span className="hero-card__badge hero-card__badge--info"><i></i>{upcomingReminders.length} 项即将到期</span>
            </div>
          </div>
        </div>

        {/* 快捷操作：状态入口 + 创建入口，全部可点 */}
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

        {/* 核心指标卡片网格 */}
        <div className="metric-grid">
          {metrics.map((m, i) => (
            <Link to={m.to} className="metric-card" key={i} aria-label={`查看${m.label}`}>
              <div className="m-ico"><m.icon size={20} /></div>
              <p className="m-label">{m.label}</p>
              <p className="m-value">{m.value}</p>
              <span className={`m-trend ${m.trendCls}`}>{m.trend}</span>
            </Link>
          ))}
        </div>

        {/* 迷你双栏：会议 / 逾期与紧急 */}
        <div className="mini-grid">
          <div className="mini-col">
            <div className="mini-col__head">
              <h3 className="mini-col__title"><Calendar size={18} />即将到来的会议</h3>
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
              <h3 className="mini-col__title"><Clock size={18} />逾期与紧急</h3>
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
        </div>

      </div>
    </>
  )
}
