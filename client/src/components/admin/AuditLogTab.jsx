// AuditLogTab — 审计日志（D1 等价重构，搬迁自 AdminPanel 的 audit Tab 分支，使用 useAuditLogs）。
import { ScrollText, Loader2, CheckSquare, Lock, Building2 } from 'lucide-react'
import { useAuditLogs } from '../../hooks/useAuditLogs'

export default function AuditLogTab() {
  const { auditLogs, loading: auditLoading } = useAuditLogs()

  return (
    <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-2">
        <ScrollText size={18} className="text-primary-600" />
        <div>
          <h3 className="font-semibold text-ink">审计日志</h3>
          <p className="text-sm text-ink-2 mt-0.5">归档 / 锁定 / 权限分配等敏感操作的留痕记录</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas border-b border-hairline">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">时间</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">操作者</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">动作</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">对象</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {auditLoading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3"><Loader2 className="inline animate-spin" size={18} /> 加载中…</td></tr>
            ) : auditLogs.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3">暂无审计记录</td></tr>
            ) : auditLogs.map(a => (
              <tr key={a._id} className="hover:bg-canvas">
                <td className="px-5 py-3 text-ink-3 text-xs whitespace-nowrap">{String(a.createdAt).slice(0, 19).replace('T', ' ')}</td>
                <td className="px-5 py-3 text-ink">{a.actorName}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${a.action === 'archive' ? 'bg-success/10 text-success' : a.action === 'lock' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-primary-700'}`}>
                    {a.action === 'archive' && <CheckSquare size={11} />}
                    {a.action === 'lock' && <Lock size={11} />}
                    {a.action === 'assign_scope' && <Building2 size={11} />}
                    {a.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-2 text-xs">{a.entityType}</td>
                <td className="px-5 py-3 text-ink-2">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
