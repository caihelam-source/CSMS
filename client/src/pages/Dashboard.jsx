import { useEffect, useState, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { companyService, meetingService, complianceReminderService, signTaskService, templateService, taskService } from '../services/index.js'
import { formatDate, formatRelative } from '../utils/helpers'
import { LoadingSpinner, PageHeader, WarningBanner } from '../components/UIHelpers'
import { Calendar, FileText, Building2, Users, Clock, AlertTriangle, FileCode, PenLine, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react'

const StatCard = memo(({ icon: Icon, label, value, color, to }) => (
  <Link to={to} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}><Icon size={24} /></div>
    </div>
  </Link>
))

const STAT_CARD_COLORS = {
  companies: 'bg-blue-50 text-blue-600',
  personnel: 'bg-green-50 text-green-600',
  documents: 'bg-purple-50 text-purple-600',
  meetings: 'bg-orange-50 text-orange-600',
  tasks: 'bg-amber-50 text-amber-600',
  signTasks: 'bg-indigo-50 text-indigo-600',
  templates: 'bg-teal-50 text-teal-600',
  reminders: 'bg-red-50 text-red-600',
}

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
      const [
        statsRes,
        meetRes,
        reminderUpRes,
        reminderExpRes,
        tasksRes,
        signRes,
        templRes,
      ] = await Promise.all([
        companyService.getDashboardStats().catch(() => ({ data: { data: {} } })),
        meetingService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getScheduled({ status: 'upcoming' }).catch(() => ({ data: { data: [] } })),
        complianceReminderService.getExpired().catch(() => ({ data: { data: [] } })),
        taskService.getAll().catch(() => ({ data: { data: [] } })),
        signTaskService.getAll().catch(() => ({ data: { data: [] } })),
        templateService.getAll().catch(() => ({ data: { data: [] } })),
      ])

      setStats(statsRes.data?.data || {})
      const meetings = meetRes.data?.data || []
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
          <button onClick={loadAll} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
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
                <span className={`text-xs font-medium ${days < 0 ? 'text-red-700' : days <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                  {days < 0 ? `逾期${Math.abs(days)}天` : days === 0 ? '今天' : `${days}天后`}
                </span>
              </Link>
            )
          }}
          linkTo="/tasks"
          linkLabel={`查看全部 ${urgentTasks.length} 项`}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="公司总数" value={stats?.totalCompanies || 0} color={STAT_CARD_COLORS.companies} to="/companies" />
        <StatCard icon={Users} label="人员库" value={stats?.totalPersonnel || 0} color={STAT_CARD_COLORS.personnel} to="/personnel" />
        <StatCard icon={FileText} label="文档" value={stats?.totalDocuments || 0} color={STAT_CARD_COLORS.documents} to="/documents" />
        <StatCard icon={Calendar} label="会议" value={stats?.totalMeetings || 0} color={STAT_CARD_COLORS.meetings} to="/meetings" />
        <StatCard icon={CheckCircle2} label="待办 Task" value={pendingTasksCount} color={STAT_CARD_COLORS.tasks} to="/tasks" />
        <StatCard icon={PenLine} label="签署任务" value={signTasksCount} color={STAT_CARD_COLORS.signTasks} to="/sign-tasks" />
        <StatCard icon={FileCode} label="模板" value={templatesCount} color={STAT_CARD_COLORS.templates} to="/templates" />
        <StatCard icon={Clock} label="合规提醒" value={upcomingReminders.length} color={STAT_CARD_COLORS.reminders} to="/compliance-reminders" />
      </div>

      {/* Upcoming Meetings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Calendar size={18} /> 即将到来的会议</h3>
          <Link to="/meetings" className="text-sm text-primary-600 hover:underline">查看全部</Link>
        </div>
        {upcomingMeetings.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">暂无即将到来的会议</p>
        ) : (
          <div className="space-y-2">
            {upcomingMeetings.map(m => (
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${m.status === 'scheduled' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="font-medium text-sm">{m.title}</p>
                    <p className="text-xs text-gray-400">{m.company?.name} · {m.type?.toUpperCase()}</p>
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
          <p className="text-gray-400 text-sm py-4 text-center">暂无即将到期的合规提醒</p>
        ) : (
          <div className="space-y-2">
            {upcomingReminders.slice(0, 5).map(r => {
              const days = r.dueDate ? Math.ceil((new Date(r.dueDate) - new Date()) / 86400000) : null
              const isOverdue = days !== null && days < 0
              return (
                <Link key={r._id} to={`/compliance-reminders/${r._id}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.company?.name || '未关联'}</p>
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
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100">
                <div>
                  <p className="font-medium text-sm text-green-800">{m.title}</p>
                  <p className="text-xs text-green-600">{m.company?.name}</p>
                </div>
                <span className="text-xs text-green-700">{formatDate(m.completedAt || m.updatedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
