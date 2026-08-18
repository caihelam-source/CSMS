// CompanyTasksTab — 公司关联任务列表（D2 等价重构，搬迁自 CompanyDetail 的 tasks Tab，配 useCompanyTasks）。
// 行为 / 样式 / 交互与原版完全一致。
import { CheckSquare, Plus } from 'lucide-react'
import { formatDate, getStatusColor } from '../../utils/helpers'
import { TabActionBar, taskPriorityColor } from '../../components/UIHelpers'

export default function CompanyTasksTab({ ctx }) {
  const { tasks, openAddTask } = ctx

  return (
    <div className="space-y-3">
      <TabActionBar title="关联任务" count={tasks.length} actionLabel="新增任务" onAction={openAddTask} />
      {tasks.length === 0 ? (
        <div className="card text-center py-10 text-ink-3">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-50" />
          <p className="mb-3">暂无关联任务</p>
          <button onClick={openAddTask} className="btn-primary flex items-center gap-1.5 text-sm mx-auto">
            <Plus size={14} /> 新增任务
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t._id} className="card flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{t.title}</p>
                <p className="text-xs text-ink-3">{t.type} &middot; 到期 {formatDate(t.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${taskPriorityColor(t.priority)}`}>{t.priority}</span>
                <span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
