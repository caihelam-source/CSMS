// SystemInfoTab — 系统信息（D1 等价重构，搬迁自 AdminPanel 的 system Tab 分支，纯静态）。
import { Activity, Building2, Calendar, FileText, CheckSquare, Users } from 'lucide-react'

export default function SystemInfoTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-surface rounded-xl border border-hairline shadow-sm p-5">
        <h3 className="font-semibold text-ink mb-4 flex items-center gap-2"><Activity size={18} className="text-primary-600" />System Overview</h3>
        <div className="space-y-3 text-sm">
          {[
            { label: 'Application', value: 'CSMS v5.0' },
            { label: 'Framework', value: 'React 18 + Vite' },
            { label: 'Backend', value: 'Node.js / Express' },
            { label: 'Database', value: 'MongoDB' },
            { label: 'Auth', value: 'JWT Tokens (5-role RBAC + row-level)' },
            { label: 'Mode', value: localStorage.getItem('demoEmail') ? '⚡ Demo (no backend)' : '🟢 Live' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-hairline last:border-0">
              <span className="text-ink-2">{label}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-hairline shadow-sm p-5">
        <h3 className="font-semibold text-ink mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary-600" />Module Status</h3>
        <div className="space-y-2 text-sm">
          {[
            { icon: Building2, label: 'Companies',  status: 'Active' },
            { icon: Calendar,  label: 'Meetings',   status: 'Active' },
            { icon: FileText,  label: 'Documents',  status: 'Active' },
            { icon: CheckSquare, label: 'Tasks',    status: 'Active' },
            { icon: Users,     label: 'User Mgmt',  status: 'Active' },
          ].map(({ icon: Icon, label, status }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-hairline last:border-0">
              <div className="flex items-center gap-2 text-ink"><Icon size={15} className="text-ink-3" />{label}</div>
              <span className="flex items-center gap-1 text-success text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-success" />{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
