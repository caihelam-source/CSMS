import { useEffect, useState, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { companyService, personnelService, documentService, meetingService, complianceReminderService, templateService, taskService } from '../services/index.js'
import { formatDate, formatRelative, buildCtcDocName } from '../utils/helpers'
import Modal from '../components/Modal'
import { LoadingSpinner, PageHeader, WarningBanner, FormField, inputClass } from '../components/UIHelpers'
import { Calendar, FileText, Building2, Users, Clock, AlertTriangle, FileCode, PenLine, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react'

// 统计卡：去彩虹——中性卡 + 大数字为主角，图标方块统一中性灰。
// 仅"需要你行动"的信息由上方 WarningBanner 以语义色亮起，卡片本身保持安静。
const StatCard = memo(({ icon: Icon, label, value, to }) => (
  <Link to={to} className="card hover:shadow-card-hover transition-shadow flex items-start justify-between">
    <div>
      <p className="text-sm text-ink-2 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-ink tracking-tight">{value}</p>
    </div>
    <div className="p-3 rounded-xl bg-canvas text-ink-3"><Icon size={22} /></div>
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

  // v5.2 模块4：Dashboard 发起签署任务（双来源，无需会议）
  const [companies, setCompanies] = useState([])
  const [dashSignOpen, setDashSignOpen] = useState(false)
  const [dsForm, setDsForm] = useState({ companyId: '', responsiblePerson: '', dueDate: '', isCTC: false, file: null })
  const [dsErrors, setDsErrors] = useState({})
  const [dsSaving, setDsSaving] = useState(false)

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
      setCompanies(companies)
      // v5.2 模块4：签署任务总数 = 会议衍生(taskSource:meeting) + Dashboard 发起(taskSource:dashboard)
      const signingTasks = allTasks.filter(t => t.type === 'signing')
      setSignTasksCount(signingTasks.length)
    } catch {
      // silently fail - stats will show zeros
    } finally {
      setLoading(false)
      setLastRefreshed(new Date())
    }
  }, [])

  // v5.2 模块4：Dashboard 发起签署任务（双来源，无需会议，直接归档至公司库）
  const submitDashSign = useCallback(async () => {
    const errors = {}
    if (!dsForm.companyId) errors.companyId = '请选择关联公司'
    if (!dsForm.responsiblePerson.trim()) errors.responsiblePerson = '请填写签署人'
    if (!dsForm.dueDate) errors.dueDate = '请选择截止日期'
    if (!dsForm.file) errors.file = '请上传签署文件'
    if (Object.keys(errors).length) { setDsErrors(errors); return }
    setDsErrors({})
    setDsSaving(true)
    try {
      const company = companies.find(c => c._id === dsForm.companyId)
      const coRef = company ? { _id: company._id, name: company.name, registrationNumber: company.registrationNumber } : undefined
      // 1) 直接归档签署文件到公司库（不经会议流程），命名按 CTC / 普通签署区分
      const docName = buildCtcDocName(dsForm.file.name, dsForm.isCTC)
      const { data: docRes } = await documentService.create({
        name: docName,
        type: 'task_attachment',
        category: 'other',
        company: coRef,
        fileName: dsForm.file.name,
        fileSize: dsForm.file.size,
        fileUrl: '/scan/' + encodeURIComponent(dsForm.file.name),
        signStatus: dsForm.isCTC ? 'ctc' : 'fully_signed',
        note: dsForm.isCTC ? 'CTC 文件（Dashboard 发起）' : '签署文件（Dashboard 发起）',
        source: { kind: 'dashboard_sign', refId: '', label: '来自 [Dashboard 签署任务]' },
        createdAt: new Date().toISOString().split('T')[0],
      }).catch(() => ({ data: { data: null } }))
      // 2) 创建双来源签署 Task（taskSource: dashboard），文件已归档 → hasAttachment:true
      const { data: tRes } = await taskService.create({
        title: `${dsForm.isCTC ? '[CTC] ' : ''}签署：${company ? company.name : '未关联公司'}`,
        type: 'signing',
        priority: 'high',
        status: 'pending',
        taskSource: 'dashboard',
        isCTC: dsForm.isCTC,
        dueDate: dsForm.dueDate,
        responsiblePerson: dsForm.responsiblePerson.trim(),
        company: coRef,
        hasAttachment: true,
        description: `由 Dashboard 发起的签署任务${dsForm.isCTC ? '（CTC 文件）' : ''}，签署文件已直接归档至公司库。`,
      }).catch(() => ({ data: { data: null } }))
      // 回写 source.refId，便于公司档案点击跳回该 Task
      if (docRes?.data?._id && tRes?.data?._id) {
        await documentService.update(docRes.data._id, {
          source: { kind: 'dashboard_sign', refId: tRes.data._id, label: '来自 [Dashboard 签署任务]' },
        }).catch(() => {})
      }
      toast.success('Dashboard 签署任务已创建，签署文件已归档至公司库')
      setDashSignOpen(false)
      setDsForm({ companyId: '', responsiblePerson: '', dueDate: '', isCTC: false, file: null })
      loadAll()
    } catch {
      toast.error('创建失败')
    } finally {
      setDsSaving(false)
    }
  }, [dsForm, companies, loadAll])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={lastRefreshed ? `上次刷新 ${formatRelative(lastRefreshed)}` : '欢迎回来'}
        icon={Building2}
        actions={
          <>
            <button onClick={() => setDashSignOpen(true)} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              <span className="flex items-center gap-1"><PenLine size={14} /> 发起签署任务</span>
            </button>
            <button onClick={loadAll} className="px-3 py-2 border border-hairline rounded-lg hover:bg-canvas text-sm">
              <span className="flex items-center gap-1"><RefreshCw size={14} /> 刷新</span>
            </button>
          </>
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
        <StatCard icon={PenLine} label="签署任务" value={signTasksCount} to="/tasks" />
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
              <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-3 bg-canvas rounded-lg hover:bg-canvas">
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

      {/* v5.2 模块4：Dashboard 发起签署任务 Modal */}
      <Modal isOpen={dashSignOpen} onClose={() => setDashSignOpen(false)} title="发起签署任务（Dashboard）" size="md">
        <div className="space-y-4">
          <FormField label="关联公司" error={dsErrors.companyId}>
            <select className={inputClass} value={dsForm.companyId} onChange={e => setDsForm(p => ({ ...p, companyId: e.target.value }))}>
              <option value="">请选择公司</option>
              {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="签署人" error={dsErrors.responsiblePerson}>
            <input className={inputClass} value={dsForm.responsiblePerson} onChange={e => setDsForm(p => ({ ...p, responsiblePerson: e.target.value }))} placeholder="例如：张三" />
          </FormField>
          <FormField label="截止日期" error={dsErrors.dueDate}>
            <input type="date" className={inputClass} value={dsForm.dueDate} onChange={e => setDsForm(p => ({ ...p, dueDate: e.target.value }))} />
          </FormField>
          <FormField label="是否为 CTC 文件？">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={!dsForm.isCTC} onChange={() => setDsForm(p => ({ ...p, isCTC: false }))} /> 否（普通签署）</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={dsForm.isCTC} onChange={() => setDsForm(p => ({ ...p, isCTC: true }))} /> 是（CTC）</label>
            </div>
          </FormField>
          <FormField label="上传签署文件" error={dsErrors.file}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDsForm(p => ({ ...p, file: e.target.files?.[0] || null }))} className="block w-full text-sm" />
            {dsForm.file && <p className="text-xs text-ink-3 mt-1">将归档为：{buildCtcDocName(dsForm.file.name, dsForm.isCTC)}</p>}
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDashSignOpen(false)} className="btn-secondary">取消</button>
            <button onClick={submitDashSign} disabled={dsSaving} className="btn-primary disabled:opacity-50">{dsSaving ? '提交中...' : '创建并归档'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
