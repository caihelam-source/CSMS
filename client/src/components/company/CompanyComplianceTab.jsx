// CompanyComplianceTab — 合规提醒 / 规则库 / 合规状态（D2 等价重构，搬迁自 CompanyDetail 的 compliance Tab，配 useRuleLibrary）。
// 行为 / 样式 / 交互与原版完全一致。
import { formatDate, getStatusColor } from '../../utils/helpers'
import { TabActionBar } from '../../components/UIHelpers'

export default function CompanyComplianceTab({ ctx }) {
  const {
    reminders, openAddReminder, applicableRules, setReminderForm,
    handleRuleSelect, setShowReminderModal, compliance,
  } = ctx

  return (
    <div className="space-y-4">
      {/* 合规提醒列表 + 新增入口 */}
      <TabActionBar
        title="合规提醒"
        count={reminders.length}
        actionLabel="新增提醒"
        onAction={openAddReminder}
      />
      <div className="card">
        {reminders.length === 0 ? (
          <p className="text-sm text-ink-3">暂无与该公司的合规提醒，点击"新增提醒"添加</p>
        ) : (
          <div className="space-y-2">
            {reminders.map(r => (
              <div key={r._id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-xs text-ink-2">
                    到期: {formatDate(r.dueDate)} · 优先级: {r.priority}
                    {r.rule?.name && <> · 规则: <span className="text-primary-600">{r.rule.name}</span></>}
                  </p>
                </div>
                <span className={`badge ${getStatusColor(r.status)}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 可用规则库（快捷参考，仅显示适配本公司的规则） */}
      {applicableRules.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">可用规则 ({applicableRules.length})</h3>
          <div className="flex flex-wrap gap-2">
            {applicableRules.map(r => (
              <button
                key={r._id}
                onClick={() => {
                  setReminderForm({ mode: 'rule', ruleId: r._id, title: '', description: '', priority: '中', dueDate: '', saveAsRule: false, ruleName: '', ruleCategory: r.category, ruleFrequency: r.frequency })
                  handleRuleSelect(r._id)
                  setShowReminderModal(true)
                }}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                title={`${r.description || ''} (${r.frequency})`}
              >
                {r.ruleName || r.name}
                {r.isPreset && <span className="ml-1 tag">预设</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold">合规状态</h2>
      {compliance ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3">统计</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-canvas rounded-lg text-center">
                <p className="text-2xl font-bold text-primary-600">{compliance.links?.active || 0}</p>
                <p className="text-ink-2">Active Links</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg text-center">
                <p className="text-2xl font-bold text-primary-600">{compliance.items?.length || 0}</p>
                <p className="text-ink-2">Items</p>
              </div>
            </div>
            {compliance.links?.roles && (
              <div className="mt-3 space-y-1 text-xs text-ink-2">
                <p>董事: {compliance.links.roles.director || 0}</p>
                <p>股东: {compliance.links.roles.shareholder || 0}</p>
                <p>秘书: {compliance.links.roles.secretary || 0}</p>
                <p>个人: {compliance.links.byType?.Personnel || 0} | 公司: {compliance.links.byType?.Company || 0}</p>
              </div>
            )}
          </div>
          {compliance.items?.map((item) => (
            <div key={`${item.type}-${item.dueDate}`} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{item.type}</p>
                <p className="text-sm text-ink-2">Due: {formatDate(item.dueDate)}</p>
              </div>
              <span className={`badge ${getStatusColor(item.status)}`}>{item.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p>Compliance data not available</p>
      )}
    </div>
  )
}
