// CompanyEquityTab — 股权穿透架构（D2 等价重构，搬迁自 CompanyDetail 的 equity Tab，复用 EquityGraph）。
// 行为 / 样式 / 交互与原版完全一致。
import EquityGraph from '../../pages/EquityGraph'

export default function CompanyEquityTab({ ctx }) {
  const { companyId } = ctx
  return (
    <div className="space-y-4">
      <EquityGraph companyId={companyId} />
    </div>
  )
}
