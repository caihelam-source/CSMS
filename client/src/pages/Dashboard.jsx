import { useEffect, useState, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { companyService, personnelService, documentService, meetingService, complianceReminderService, signTaskService, templateService, taskService } from '../services/index.js'
import { formatDate, formatRelative } from '../utils/helpers'
import { LoadingSpinner, PageHeader, WarningBanner } from '../components/UIHelpers'
import { Calendar, FileText, Building2, Users, Clock, AlertTriangle, FileCode, PenLine, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react'

// 统计卡：去彩虹——中性卡 + 大数字为主角，图标方块统一中性灰。
// 仅"需要你行动"的信息由上方 WarningBanner 以语义色亮起，卡片本身保持安静。
const StatCard = memo(({ icon: Icon, label, value, to }) => (
  <Link to={to} className="card hover:shadow-card-hover transition-shadow flex items-start justify-between">
    <div>
      <p className="text-sm text-ink-2 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-ink tracking-tight">{value}</p>
    </div>
    <div className="p-3 rounded-xl bg-gray-100 text-ink-3"><Icon size={22} /></div>
  </Link>
))

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [upcomingMeetings, setUpcomingMeetings] = useState([])
  const [upcomingReminders, setUpcomingReminders] = useState([])
  const [expiredReminders, setExpiredReminders] = useState([])
  const [recentMeetings, setRecentMeetings] = useState([])
  const [urgentTasks, setUrgentTasks] = useState([])
  const [pendingTasksCount, setPendingTasksCount] = useState(0)
  const [signTasksCount, setSignTasksCount] = useState(0)
  const [templatesCount, setTemplatesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(null)

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
        signRes,
        templRes,
      ] = await Promise.all([
        companyService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        personnelService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        documentService.getAll().catch(() => ({ data: { data: [], total: 0 } })),
        meetingService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getScheduled({ status: 'upcoming' }).catch(() => ({ data: { data: [] } })),
        complianceReminderService.getExpired().catch(() => ({ data: { data: [] } })),
        taskService.getAll().catch(() => ({ data: { data: [] } })),
        signTaskService.getAll().catch(() => ({ data: { data: [] } })),
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
      setSignTasksCount(signRes.data?.data?.length || 0)
      setTemplatesCount(templRes.data?.data?.length || 0)
    } catch {
      // silently fail - stats will show zeros
    } finally {
      setLoading(false)
      setLastRefreshed(new Date())
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={lastRefreshed ? `上次刷新 ${formatRelative(lastRefreshed)}` : '欢迎回来'}
        icon={Building2}
        actions={
          <button onClick={loadAll} className="px-3 py-2 border border-hairline rounded-lg hover:bg-canvas text-sm">
            <span className="flex items-center gap-1"><RefreshCw size={14} /> 刷新</span>
          </button>
        }
      />

      {/* 逾期提醒横幅 */}
      {expiredReminders.length > 0 && (
        <WarningBanner
          icon={Clock}
          title="逾期合规提醒"
          count={expiredReminders.length}
          color="amber"
          items={expiredReminders}
          renderItem={(r, c) => (
            <Link key={r._id} to="/compliance-reminders" className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <ChevronRight size={14} className={c.itemSub} />
                <span className={`text-sm font-medium ${c.itemTitle}`}>{r.title}</span>
                {r.company?.name && <span className={`text-xs ${c.itemSub}`}>({r.company.name})</span>}
              </div>
            </Link>
          )}
          linkTo="/compliance-reminders"
          linkLabel={`查看全部 ${expiredReminders.length} 项`}
        />
      )}

      {/* 紧急提醒横幅 */}
      {urgentTasks.length > 0 && (
        <WarningBanner
          icon={AlertTriangle}
          title="紧急提醒"
          count={urgentTasks.length}
          color="red"
          items={urgentTasks}
          renderItem={(t, c) => {
            const days = Math.ceil((new Date(t.dueDate) - new Date()) / 86400000)
            return (
              <Link to={`/tasks/${t._id}`} className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ChevronRight size={14} className={c.itemSub} />
                  <span className={`text-sm font-medium ${c.itemTitle}`}>{t.title}</span>
                  {t.company?.name && <span className={`text-xs ${c.itemSub}`}>({t.company.name})</span>}
                </div>
                <span className={`text-xs font-medium ${days < 0 ? 'text-danger' : days <= 3 ? 'text-warning' : 'text-ink-2'}`}>
                  {days < 0 ? `逾期${Math.abs(days)}天` : days === 0 ? '今天' : `${days}天后`}
                </span>
              </Link>
            )
          }}
          linkTo="/tasks"
          linkLabel={`查看全部 ${urgentTasks.length} 项`}
        />
      )}

      {/* Stats Grid — 去彩虹：中性卡 + 数字为主角，仅需要时由上方 WarningBanner 亮色 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="公司总数" value={stats?.totalCompanies || 0} to="/companies" />
        <StatCard icon={Users} label="人员库" value={stats?.totalPersonnel || 0} to="/personnel" />
        <StatCard icon={FileText} label="文档" value={stats?.totalDocuments || 0} to="/documents" />
        <StatCard icon={Calendar} label="会议" value={stats?.totalMeetings || 0} to="/meetings" />
        <StatCard icon={CheckCircle2} label="待办 Task" value={pendingTasksCount} to="/tasks" />
        <StatCard icon={PenLine} label="签署任务" value={signTasksCount} to="/sign-tasks" />
        <StatCard icon={FileCode} label="模板" value={templatesCount} to="/templates" />
        <StatCard icon={Clock} label="合规提醒" value={upcomingReminders.length} to="/compliance-reminders" />
      </div>

      {/* Upcoming Meetings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Calendar size={18} /> 即将到来的会议</h3>
          <Link to="/meetings" className="text-sm text-primary-600 hover:underline">查看全部</Link>
        </div>
        {upcomingMeetings.length === 0 ? (
          <p className="text-ink-3 text-sm py-4 text-center">暂无即将到来的会议</p>
        ) : (
          <div className="space-y-2">
            {upcomingMeetings.map(m => (
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${m.status === 'scheduled' ? 'bg-primary-500' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="font-medium text-sm">{m.title}</p>
                    <p className="text-xs text-ink-3">{m.company?.name} · {m.type?.toUpperCase()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm">{formatDate(m.scheduledAt)}</p>
                  <span className={`badge text-xs ${m.status === 'scheduled' ? 'badge-info' : 'badge-warning'}`}>{m.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Compliance Reminders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Clock size={18} /> 即将到期的合规提醒</h3>
          <Link to="/compliance-reminders" className="text-sm text-primary-600 hover:underline">查看全部</Link>
        </div>
        {upcomingReminders.length === 0 ? (
          <p className="text-ink-3 text-sm py-4 text-center">暂无即将到期的合规提醒</p>
        ) : (
          <div className="space-y-2">
            {upcomingReminders.slice(0, 5).map(r => {
              const days = r.dueDate ? Math.ceil((new Date(r.dueDate) - new Date()) / 86400000) : null
              const isOverdue = days !== null && days < 0
              return (
                <Link key={r._id} to={`/compliance-reminders/${r._id}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-warning/10">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-ink-2">{r.company?.name || '未关联'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDate(r.dueDate)}</p>
                    {days !== null && (
                      <span className={`badge text-xs ${isOverdue ? 'badge-danger' : days <= 7 ? 'badge-warning' : 'badge-info'}`}>
                        {isOverdue ? `逾期${Math.abs(days)}天` : days === 0 ? '今天' : `剩余${days}天`}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Completed Meetings */}
      {recentMeetings.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 size={18} /> 最近的已完成会议</h3>
            <Link to="/meetings" className="text-sm text-primary-600 hover:underline">查看全部</Link>
          </div>
          <div className="space-y-2">
            {recentMeetings.map(m => (
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-success/10 rounded-lg hover:bg-success/10">
                <div>
                  <p className="font-medium text-sm text-success">{m.title}</p>
                  <p className="text-xs text-success">{m.company?.name}</p>
                </div>
                <span className="text-xs text-success">{formatDate(m.completedAt || m.updatedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
