// CompanyPeopleTab — 董事 / 股东 / 公司秘书（D2 等价重构，搬迁自 CompanyDetail 的 people Tab）。
// 行为 / 样式 / 交互与原版完全一致；renderLinkRow 等共享渲染器由 Shell 经 ctx 下传。
import { Users, Building2, Shield } from 'lucide-react'
import { TabActionBar } from '../../components/UIHelpers'

export default function CompanyPeopleTab({ ctx }) {
  const { directors, shareholders, secretaries, openAddLink, renderLinkRow } = ctx

  return (
    <div className="space-y-6">
      <TabActionBar
        title="董事、股东及公司秘书"
        count={(directors?.length || 0) + (shareholders?.length || 0) + (secretaries?.length || 0)}
        actionLabel="添加关联人员"
        onAction={openAddLink}
      />

      {/* Directors Section */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> 董事 ({directors.length})</h3>
        {directors.length === 0 ? (
          <p className="text-ink-3 text-sm">暂无董事</p>
        ) : (
          <div className="space-y-2">
            {directors.map(link => renderLinkRow(link))}
          </div>
        )}
      </div>

      {/* Shareholders Section */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 size={18} /> 股东 ({shareholders.length})</h3>
        {shareholders.length === 0 ? (
          <p className="text-ink-3 text-sm">暂无股东</p>
        ) : (
          <div className="space-y-2">
            {shareholders.map(link => renderLinkRow(link))}
          </div>
        )}
      </div>

      {/* Secretary Section */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield size={18} /> 公司秘书 ({secretaries.length})</h3>
        {secretaries.length === 0 ? (
          <p className="text-ink-3 text-sm">暂无公司秘书</p>
        ) : (
          <div className="space-y-2">
            {secretaries.map(link => renderLinkRow(link))}
          </div>
        )}
      </div>
    </div>
  )
}
