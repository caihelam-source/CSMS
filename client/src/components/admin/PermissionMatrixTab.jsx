// PermissionMatrixTab — 角色权限矩阵（D1 等价重构，搬迁自 AdminPanel 的 permissions Tab 分支）。
import { PERM_MATRIX, Tick, ROLES } from './_shared'

export default function PermissionMatrixTab() {
  return (
    <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline">
        <h3 className="font-semibold text-ink">Role Permission Matrix</h3>
        <p className="text-sm text-ink-2 mt-0.5">What each role can and cannot do</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-canvas border-b border-hairline">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Feature</th>
            {ROLES.map(r => {
              const Icon = r.icon
              return (
                <th key={r.value} className="px-4 py-3 text-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${r.color}`}>
                    <Icon size={12} />{r.label}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {PERM_MATRIX.map((row, i) => (
            <tr key={i} className="hover:bg-canvas">
              <td className="px-5 py-3.5 text-ink">{row.feature}</td>
              <td className="px-4 py-3.5 text-center"><Tick ok={row.admin} /></td>
              <td className="px-4 py-3.5 text-center"><Tick ok={row.auditor} /></td>
              <td className="px-4 py-3.5 text-center"><Tick ok={row.secretary} /></td>
              <td className="px-4 py-3.5 text-center"><Tick ok={row.manager} /></td>
              <td className="px-4 py-3.5 text-center"><Tick ok={row.viewer} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
