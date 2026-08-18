// CompanyRegistersTab — 公司登记册 ROD / ROM / ROS（D2 等价重构，搬迁自 CompanyDetail 的 registers Tab）。
// 行为 / 样式 / 交互与原版完全一致；RegisterTable / RegSelect 共享渲染器由 Shell 经 ctx 下传。
import { BookOpen } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

export default function CompanyRegistersTab({ ctx }) {
  const {
    company, directors, shareholders, secretaries,
    activeDirectors, activeShareholders, activeSecretaries,
    formerDirectors, formerShareholders, formerSecretaries,
    rodRegion, setRodRegion, rodPurpose, setRodPurpose,
    romRegion, setRomRegion, romPurpose, setRomPurpose,
    generatingReg, downloadRegister, setPreviewReg,
    RegisterTable, RegSelect, REGION_OPTS, PURPOSE_OPTS,
  } = ctx

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={20} /> 公司登记册</h2>

      {/* ROD — Register of Directors */}
      <RegisterTable
        title="Register of Directors (ROD)"
        subtitle={`董事登记册 — 现任 ${activeDirectors.length} 位 / 历任 ${formerDirectors.length} 位`}
        links={directors}
        regType="rod"
        onDownload={downloadRegister}
        onPreview={() => setPreviewReg({ type: 'rod', title: 'Register of Directors (ROD)', region: rodRegion, purpose: rodPurpose })}
        generating={generatingReg === 'rod'}
        emptyText="No directors registered"
        extraControls={
          <>
            <RegSelect label="地区" value={rodRegion} onChange={setRodRegion} options={REGION_OPTS} />
            <RegSelect label="用途" value={rodPurpose} onChange={setRodPurpose} options={PURPOSE_OPTS} />
          </>
        }
        columns={[
          { key: 'appointed', header: 'Date Appointed', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
          { key: 'name', header: 'Full Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
          { key: 'nric', header: 'NRIC / Passport', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.nric || '-' },
          { key: 'nationality', header: 'Nationality', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.nationality || '-' },
          { key: 'address', header: 'Address', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.address?.country || '-' },
          { key: 'role', header: 'Role', tdClass: 'p-2', cell: (l) => l.roles.map(r => <span key={r} className="badge badge-info text-xs mr-1">{r}</span>) },
          { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
        ]}
      />

      {/* ROM — Register of Members */}
      <RegisterTable
        title="Register of Members (ROM)"
        subtitle={`股东登记册 — 现任 ${activeShareholders.length} 位 / 历任 ${formerShareholders.length} 位 · Issued: ${(company.shareCapital?.issued || 0).toLocaleString()} ${company.shareCapital?.currency || ''}`}
        links={shareholders}
        regType="rom"
        onDownload={downloadRegister}
        onPreview={() => setPreviewReg({ type: 'rom', title: 'Register of Members (ROM)', region: romRegion, purpose: romPurpose })}
        generating={generatingReg === 'rom'}
        emptyText="No shareholders registered"
        extraControls={
          <>
            <RegSelect label="地区" value={romRegion} onChange={setRomRegion} options={REGION_OPTS} />
            <RegSelect label="用途" value={romPurpose} onChange={setRomPurpose} options={PURPOSE_OPTS} />
          </>
        }
        columns={[
          { key: 'entered', header: 'Date Entered', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
          { key: 'name', header: 'Member Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
          { key: 'address', header: 'Address / Jurisdiction', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.address?.country || p.registrationNumber || '-' },
          { key: 'shares', header: 'No. of Shares', tdClass: 'p-2 text-right text-xs', cell: (l) => (l.shares || 0).toLocaleString() },
          { key: 'type', header: 'Type', tdClass: 'p-2 text-xs', cell: (l) => l.shareType || 'Ordinary' },
          { key: 'pct', header: '%', tdClass: 'p-2 text-right text-xs', cell: (l) => company.shareCapital?.paidUp && l.shares ? ((l.shares / company.shareCapital.paidUp * 100).toFixed(2) + '%') : '-' },
          { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
        ]}
      />

      {/* Secretary Register */}
      <RegisterTable
        title="Register of Secretaries"
        subtitle={`公司秘书登记册 — 现任 ${activeSecretaries.length} 位 / 历任 ${formerSecretaries.length} 位`}
        links={secretaries}
        regType="sec"
        onDownload={() => { /* TODO: generate ROS Word */ }}
        onPreview={() => setPreviewReg({ type: 'sec', title: 'Register of Secretaries', region: 'HK', purpose: 'standard' })}
        generating={false}
        emptyText="No secretary registered"
        columns={[
          { key: 'appointed', header: 'Date Appointed', tdClass: 'p-2 text-xs', cell: (l) => formatDate(l.appointedDate) },
          { key: 'name', header: 'Name', tdClass: 'p-2', cell: (l, p) => p.name || '-' },
          { key: 'nric', header: 'NRIC / Passport', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.nric || '-' },
          { key: 'address', header: 'Address', tdClass: 'p-2 text-xs text-ink-2', cell: (l, p) => p.address?.country || '-' },
          { key: 'ceased', header: 'Date Ceased', tdClass: 'p-2 text-xs', cell: (l) => l.ceasedDate ? formatDate(l.ceasedDate) : 'Present' },
        ]}
      />
    </div>
  )
}
