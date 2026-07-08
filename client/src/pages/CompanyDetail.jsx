import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Users, FileText, Plus, Trash2, Calendar, Shield, ExternalLink, BookOpen, Download, Edit3, Network, ClipboardCheck } from 'lucide-react'
import { companyService, documentService, meetingService, personnelService } from '../services/index.js'
import EquityGraph from './EquityGraph'
import { formatDate, getStatusColor, DOC_CATEGORY_LABELS } from '../utils/helpers'
import { LoadingSpinner, EmptyState, DetailHeader, FormField, inputClass, labelClass, TabNav } from '../components/UIHelpers'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'
import { validate, required } from '../utils/validators'

const LINK_FORM_RULES = {
  name: [required('名称为必填')],
}

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [company, setCompany] = useState(null)
  const [documents, setDocuments] = useState([])
  const [meetings, setMeetings] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [docFilterCategory, setDocFilterCategory] = useState('all')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingLink, setEditingLink] = useState(null)
  const [linkForm, setLinkForm] = useState({ linkModel: 'Personnel', name: '', roles: ['director'], shares: '', shareType: 'ordinary', nric: '', appointedDate: '', ceasedDate: '', selectedId: '' })
  const [linkFormErrors, setLinkFormErrors] = useState({})
  // 登记册生成
  const [generatingReg, setGeneratingReg] = useState(null) // 'rod' | 'rom' | null
  // 所有 personnel 和 companies（用于联动显示最新数据）
  const [allPersonnel, setAllPersonnel] = useState([])
  const [allCompanies, setAllCompanies] = useState([])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [compRes, docRes, meetRes, compRes2, persRes, compsRes] = await Promise.all([
        companyService.getOne(id),
        documentService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        meetingService.getByCompany(id).catch(() => ({ data: { data: [] } })),
        companyService.getCompliance(id).catch(() => null),
        personnelService.getAll().catch(() => ({ data: { data: [] } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setCompany(compRes.data.data)
      setDocuments(docRes.data.data || [])
      setMeetings(meetRes.data.data || [])
      if (compRes2) setCompliance(compRes2.data.data)
      setAllPersonnel(persRes?.data?.data || [])
      setAllCompanies(compsRes?.data?.data || [])
    } catch {
      toast.error('Failed to load company')
      navigate('/companies')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadAll() }, [loadAll])

  // Build maps for display (always use latest personnel/company data)
  const personnelMap = useMemo(() => {
    const map = {}
    allPersonnel.forEach(p => { map[p._id] = p })
    return map
  }, [allPersonnel])
  const companyMap = useMemo(() => {
    const map = {}
    allCompanies.forEach(c => { map[c._id] = c })
    return map
  }, [allCompanies])

  // Resolve a link's display data: always prefer the map (latest data)
  const resolveLinkDisplay = useCallback((link) => {
    if (link.linkModel === 'Personnel' && link.link?._id && personnelMap[link.link._id]) {
      return personnelMap[link.link._id]
    }
    if (link.linkModel === 'Company' && link.link?._id && companyMap[link.link._id]) {
      return companyMap[link.link._id]
    }
    return link.link || {}
  }, [personnelMap, companyMap])

  const directors = useMemo(() => (company?.links || []).filter(l => l.roles.includes('director') || l.roles.includes('alternate_director')), [company?.links])
  const shareholders = useMemo(() => (company?.links || []).filter(l => l.roles.includes('shareholder')), [company?.links])
  const secretaries = useMemo(() => (company?.links || []).filter(l => l.roles.includes('secretary')), [company?.links])

  // ---- Link CRUD ----
  const openAddLink = () => {
    setEditingLink(null)
    setLinkForm({ linkModel: 'Personnel', name: '', roles: ['director'], shares: '', shareType: 'ordinary', nric: '', appointedDate: '', ceasedDate: '', selectedId: '' })
    setShowLinkModal(true)
  }

  const openEditLink = (link) => {
    setEditingLink(link._id)
    setLinkForm({
      linkModel: link.linkModel || 'Personnel',
      name: link.link?.name || '',
      roles: [...(link.roles || [])],
      shares: link.shares || '',
      shareType: link.shareType || 'ordinary',
      nric: link.link?.nric || '',
      appointedDate: link.appointedDate ? link.appointedDate.substring(0, 10) : '',
      ceasedDate: link.ceasedDate ? link.ceasedDate.substring(0, 10) : '',
      selectedId: link.link?._id || '',
    })
    setShowLinkModal(true)
  }

  const handleRemoveLink = async (linkId) => {
    const ok = await confirm({ title: '移除关联', message: '移除这个关联？此操作不可撤销。', confirmLabel: '确认移除' })
    if (!ok) return
    try {
      await companyService.removeLink(id, linkId)
      toast.success('Link removed')
      loadAll()
    } catch {
      toast.error('Failed to remove')
    }
  }

  const handleAddLink = async (e) => {
    e.preventDefault()
    const { valid, errors } = validate(linkForm, LINK_FORM_RULES)
    if (!valid) { setLinkFormErrors(errors); return }
    setLinkFormErrors({})
    try {
      // Determine the _id for link.link
      let linkId = linkForm.selectedId
      if (!linkId && linkForm.name) {
        // No existing personnel selected — will create a new personnel first (only in real backend)
        // For now, generate a temp ID
        linkId = 'p' + Date.now()
      }
      const payload = {
        linkModel: linkForm.linkModel,
        link: {
          _id: linkId,
          name: linkForm.name,
          nric: linkForm.nric || undefined,
          registrationNumber: linkForm.linkModel === 'Company' ? (linkForm.registrationNumber || 'N/A') : undefined,
        },
        roles: linkForm.roles,
        shares: linkForm.roles.includes('shareholder') ? Number(linkForm.shares) || 0 : undefined,
        shareType: linkForm.roles.includes('shareholder') ? linkForm.shareType : undefined,
        appointedDate: linkForm.appointedDate || undefined,
        ceasedDate: linkForm.ceasedDate || undefined,
      }
      if (editingLink) {
        await companyService.updateLink(id, editingLink, payload)
        toast.success('Link updated')
      } else {
        await companyService.addLink(id, payload)
        toast.success('Link added')
      }
      setShowLinkModal(false)
      setEditingLink(null)
      loadAll()
    } catch {
      toast.error('Failed to save link')
    }
  }

  // Handle selecting existing personnel in Link Modal
  const handlePersonnelSelect = useCallback((e) => {
    const pid = e.target.value
    if (!pid) {
      setLinkForm({ ...linkForm, selectedId: '', name: '', nric: '', nationality: '' })
      return
    }
    const p = allPersonnel.find(pp => pp._id === pid)
    if (p) {
      setLinkForm({ ...linkForm, selectedId: pid, name: p.name, nric: p.nric || '', nationality: p.nationality || '' })
    }
  }, [linkForm, allPersonnel])
  const handleCompanySelect = useCallback((e) => {
    const cid = e.target.value
    if (!cid) {
      setLinkForm({ ...linkForm, selectedId: '', name: '' })
      return
    }
    const c = allCompanies.find(cc => cc._id === cid)
    if (c) {
      setLinkForm({ ...linkForm, selectedId: cid, name: c.name, registrationNumber: c.registrationNumber || '' })
    }
  }, [linkForm, allCompanies])
  const downloadRegister = (type) => {
    if (!company) return
    setGeneratingReg(type)
    try {
      const html = type === 'rod' ? buildRodHtml(company) : buildRomHtml(company)
      const filename = `${type.toUpperCase()}_${(company.registrationNumber || 'N_A')}_${new Date().toISOString().substring(0, 10)}.doc`
      const blob = new Blob(['\ufeff' + html], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success(`${type === 'rod' ? 'ROD' : 'ROM'} downloaded`)
    } catch {
      toast.error('Failed to generate register')
    } finally {
      setGeneratingReg(null)
    }
  }

  // ROD — Register of Directors HTML
  const buildRodHtml = (c) => {
    const dirLinks = (c.links || []).filter(l => l.roles.includes('director') || l.roles.includes('alternate_director'))
    const rows = dirLinks.map(l => {
      const p = resolveLinkDisplay(l)
      return `<tr>
        <td>${formatDate(l.appointedDate)}</td>
        <td>${p.name || '-'}</td>
        <td>${p.nric ? (p.nric.startsWith('P') ? p.nric : `Passport: ${p.nric}`) : '-'}</td>
        <td>${p.nationality || '-'}</td>
        <td>${p.address?.country || '-'}</td>
        <td>${l.roles.join(', ')}</td>
        <td>${formatDate(l.ceasedDate) || 'Present'}</td>
      </tr>`
    }).join('')

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Times New Roman',serif;margin:40px 60px;color:#000;line-height:1.6}
h2{text-align:center;margin-bottom:4px;font-size:16px}
.reg-title{text-align:center;font-size:14px;font-weight:bold;margin:8px 0 20px;border:1px solid #000;padding:6px;letter-spacing:2px}
.meta{text-align:center;margin-bottom:20px;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #000;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#f0f0f0;font-weight:bold;text-align:center}
.footer-note{margin-top:30px;font-size:9px;color:#666}
@media print{body{margin:20px}}
</style></head><body>
<h2>${c.name || ''}</h2>
${c.nameChinese ? `<p style="text-align:center;font-size:12px">${c.nameChinese}</p>` : ''}
<div class="reg-title">REGISTER OF DIRECTORS</div>
<div class="meta">Company No.: ${c.registrationNumber || 'N/A'} &nbsp;|&nbsp; Jurisdiction: ${c.jurisdiction || 'N/A'} &nbsp;|&nbsp; Date: ${new Date().toISOString().substring(0,10)}</div>
<table><thead><tr>
<th>Date Appointed</th><th>Full Name</th><th>NRIC / Passport</th><th>Nationality</th><th>Address</th><th>Role</th><th>Date Ceased</th>
</tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999">No directors registered</td></tr>'}</tbody></table>
<p class="footer-note">Generated by Claw Company Secretary System on ${new Date().toISOString().substring(0,10)}</p>
</body></html>`
  }

  // ROM — Register of Members HTML
  const buildRomHtml = (c) => {
    const shLinks = (c.links || []).filter(l => l.roles.includes('shareholder'))
    const rows = shLinks.map(l => {
      const p = resolveLinkDisplay(l)
      return `<tr>
        <td>${formatDate(l.appointedDate)}</td>
        <td>${p.name || '-'}</td>
        <td>${p.address?.country || p.registrationNumber || '-'}</td>
        <td>${(l.shares || 0).toLocaleString()}</td>
        <td>${l.shareType || 'Ordinary'}</td>
        <td>${c.shareCapital?.currency || 'HKD'} ${c.shareCapital?.paidUp ? (l.shares ? ((l.shares / c.shareCapital.paidUp * 100).toFixed(2) + '%') : '-') : '-'}</td>
        <td>${formatDate(l.ceasedDate) || 'Present'}</td>
      </tr>`
    }).join('')

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Times New Roman',serif;margin:40px 60px;color:#000;line-height:1.6}
h2{text-align:center;margin-bottom:4px;font-size:16px}
.reg-title{text-align:center;font-size:14px;font-weight:bold;margin:8px 0 20px;border:1px solid #000;padding:6px;letter-spacing:2px}
.meta{text-align:center;margin-bottom:20px;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #000;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#f0f0f0;font-weight:bold;text-align:center}
.footer-note{margin-top:30px;font-size:9px;color:#666}
</style></head><body>
<h2>${c.name || ''}</h2>
${c.nameChinese ? `<p style="text-align:center;font-size:12px">${c.nameChinese}</p>` : ''}
<div class="reg-title">REGISTER OF MEMBERS</div>
<div class="meta">Company No.: ${c.registrationNumber || 'N/A'} &nbsp;|&nbsp; Jurisdiction: ${c.jurisdiction || 'N/A'} &nbsp;|&nbsp; Issued Shares: ${(c.shareCapital?.issued || 0).toLocaleString()} ${c.shareCapital?.currency || 'HKD'} &nbsp;|&nbsp; Date: ${new Date().toISOString().substring(0,10)}</div>
<table><thead><tr>
<th>Date Entered</th><th>Member Name</th><th>Address / Jurisdiction</th><th>No. of Shares</th><th>Share Type</th><th>Shareholding %</th><th>Date Ceased</th>
</tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999">No members registered</td></tr>'}</tbody></table>
<p class="footer-note">Generated by Claw Company Secretary System on ${new Date().toISOString().substring(0,10)}</p>
</body></html>`
  }

  // ---- Render helpers ----
  const renderLinkRow = (link) => {
    const p = resolveLinkDisplay(link)
    return (
      <div key={link._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${link.roles.includes('director') ? 'bg-primary-100 text-primary-700' : link.roles.includes('shareholder') ? 'bg-green-100 text-green-700' : link.roles.includes('secretary') ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
            {p.name?.charAt(0) || '?'}
          </div>
          <div>
            {link.linkModel === 'Personnel' ? (
              <Link to={`/personnel/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {p.name || link.link?.name || 'Unknown'} <ExternalLink size={12} />
              </Link>
            ) : (
              <Link to={`/companies/${p._id || link.link?._id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-1">
                {p.name || link.link?.name || 'Unknown'} <ExternalLink size={12} />
              </Link>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              {link.appointedDate && <span>Since {formatDate(link.appointedDate)}</span>}
              {link.ceasedDate && <span className="text-red-500">Ceased {formatDate(link.ceasedDate)}</span>}
              {p.nric && <span>{p.nric}</span>}
              {link.shares > 0 && <span>{link.shares.toLocaleString()} {link.shareType}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {link.roles.map(r => <span key={r} className="badge badge-info text-xs">{r}</span>)}
          </div>
          <button onClick={() => openEditLink(link)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit link"><Edit3 size={14} /></button>
          <button onClick={() => handleRemoveLink(link._id)} className="p-1 text-gray-400 hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner size="md" />
  if (!company) return <EmptyState icon={Building2} title="未找到该公司" description="该公司记录不存在或已被删除" />

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailHeader
        onBack={() => navigate('/companies')}
        title={company.name}
        subtitle={
          <>
            {company.registrationNumber}
            {company.type && <> &middot; {company.type.replace(/_/g, ' ')}</>}
            {company.incorporationDate && <> &middot; Incorporated {formatDate(company.incorporationDate)}</>}
          </>
        }
        initials={company.name?.charAt(0) || '?'}
        badges={
          <>
            <span className={`badge ${getStatusColor(company.status)}`}>{company.status}</span>
            {company.jurisdiction && <span className="badge badge-info">{company.jurisdiction}</span>}
          </>
        }
      />

      {/* Tabs */}
      <TabNav
        tabs={[
          { key: 'info', label: '基本信息', icon: Building2 },
          { key: 'people', label: `董事/股东 (${(company.links || []).length})`, icon: Users },
          { key: 'documents', label: `文件 (${documents.length})`, icon: FileText },
          { key: 'equity', label: '股权架构', icon: Network },
          { key: 'registers', label: '登记册', icon: BookOpen },
          { key: 'compliance', label: '合规', icon: Shield },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">公司信息</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">注册号</span><span>{company.registrationNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">类型</span><span className="capitalize">{company.type?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">属地</span><span>{company.jurisdiction || company.registeredAddress?.country || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">成立日期</span><span>{formatDate(company.incorporationDate)}</span></div>
              {company.shareCapital && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">已发行股份</span><span>{company.shareCapital.issued?.toLocaleString()} {company.shareCapital.currency}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">已缴股本</span><span>{company.shareCapital.paidUp?.toLocaleString()} {company.shareCapital.currency}</span></div>
                </>
              )}
            </dl>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">地址</h3>
            {company.registeredAddress ? (
              <p className="text-sm text-gray-600">
                {[company.registeredAddress.street, company.registeredAddress.city, company.registeredAddress.state, company.registeredAddress.country].filter(Boolean).join(', ') || company.registeredAddress.country || '-'}
              </p>
            ) : <p className="text-sm text-gray-400">-</p>}
          </div>
          {/* Compliance dates */}
          <div className="card">
            <h3 className="font-semibold mb-4">合规日期</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">AGM 到期</span><span>{formatDate(company.compliance?.agmDueDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">年报到期</span><span className={company.compliance?.arDueDate && new Date(company.compliance.arDueDate) < new Date() ? 'text-red-600 font-medium' : ''}>{formatDate(company.compliance?.arDueDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">上次 AGM</span><span>{formatDate(company.compliance?.lastAgmDate)}</span></div>
            </dl>
          </div>
          {meetings.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar size={16} /> 近期会议</h3>
              <div className="space-y-2">
                {meetings.slice(0, 3).map(m => (
                  <Link key={m._id} to={`/meetings/${m._id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                    <span className="text-primary-600">{m.title}</span>
                    <span className="text-gray-400">{formatDate(m.scheduledAt)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* People Tab */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">董事、股东及公司秘书</h2>
            <button onClick={openAddLink} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> Add Link
            </button>
          </div>

          {/* Directors Section */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> 董事 ({directors.length})</h3>
            {directors.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无董事</p>
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
              <p className="text-gray-400 text-sm">暂无股东</p>
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
              <p className="text-gray-400 text-sm">暂无公司秘书</p>
            ) : (
              <div className="space-y-2">
                {secretaries.map(link => renderLinkRow(link))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab — 分类侧栏 */}
      {activeTab === 'documents' && (
        <div className="flex gap-6">
          {/* 侧栏：分类 */}
          <aside className="w-48 shrink-0 space-y-1">
            <h3 className="text-sm font-semibold text-gray-500 px-2 pb-2">文档分类</h3>
            <button onClick={() => setDocFilterCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${docFilterCategory === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
              <span>全部</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{documents.length}</span>
            </button>
            {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => {
              const count = documents.filter(d => (d.category || 'other') === key).length
              return (
                <button key={key} onClick={() => setDocFilterCategory(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${docFilterCategory === key ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                  <span className="flex items-center gap-2"><ClipboardCheck size={14} /> {label}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{count}</span>
                </button>
              )
            })}
          </aside>

          {/* 主区：文件列表 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold mb-4">关联文件</h2>
            {documents.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无关联文件</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents
                  .filter(d => docFilterCategory === 'all' || (d.category || 'other') === docFilterCategory)
                  .map(doc => (
                    <div key={doc._id} className="card flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={20} className="text-primary-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {doc.docNumber && <span className="text-xs font-mono text-gray-400">{doc.docNumber}</span>}
                            <p className="font-medium truncate">{doc.name}</p>
                          </div>
                          <p className="text-xs text-gray-400">
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{DOC_CATEGORY_LABELS[doc.category] || '其他'}</span>
                            {doc.type && <> &middot; {doc.type.replace(/_/g, ' ')}</>}
                            {doc.fileSize && <> &middot; {(doc.fileSize / 1024).toFixed(0)} KB</>}
                            {doc.createdAt && <> &middot; {formatDate(doc.createdAt)}</>}
                          </p>
                        </div>
                      </div>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm shrink-0">Download</a>
                      ) : (
                        <span className="text-xs text-gray-400 shrink-0">无文件</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equity Graph Tab — 股权穿透架构 */}
      {activeTab === 'equity' && (
        <div className="space-y-4">
          <EquityGraph companyId={id} />
        </div>
      )}

      {/* ======== 登记册 Tab ======== */}
      {activeTab === 'registers' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={20} /> 公司登记册</h2>

          {/* ROD Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Register of Directors (ROD)</h3>
                <p className="text-sm text-gray-500">董事登记册 &mdash; {directors.length} 位董事</p>
              </div>
              <button
                onClick={() => downloadRegister('rod')}
                disabled={generatingReg === 'rod'}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {generatingReg === 'rod' ? 'Generating...' : <><Download size={16} /> 生成 Word (.doc)</>}
              </button>
            </div>

            {/* Preview table */}
            {directors.length === 0 ? (
              <p className="text-gray-400 text-sm py-4">No directors registered</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-2 font-medium text-gray-600">Date Appointed</th>
                      <th className="text-left p-2 font-medium text-gray-600">Full Name</th>
                      <th className="text-left p-2 font-medium text-gray-600">NRIC / Passport</th>
                      <th className="text-left p-2 font-medium text-gray-600">Nationality</th>
                      <th className="text-left p-2 font-medium text-gray-600">Address</th>
                      <th className="text-left p-2 font-medium text-gray-600">Role</th>
                      <th className="text-left p-2 font-medium text-gray-600">Date Ceased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directors.map(link => {
                      const p = resolveLinkDisplay(link)
                      return (
                        <tr key={link._id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-xs">{formatDate(link.appointedDate)}</td>
                          <td className="p-2">{p.name || '-'}</td>
                          <td className="p-2 text-xs text-gray-500">{p.nric || '-'}</td>
                          <td className="p-2 text-xs">{p.nationality || '-'}</td>
                          <td className="p-2 text-xs text-gray-500">{p.address?.country || '-'}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-0.5">
                              {link.roles.map(r => <span key={r} className="badge badge-info text-xs">{r}</span>)}
                            </div>
                          </td>
                          <td className="p-2 text-xs">{link.ceasedDate ? formatDate(link.ceasedDate) : 'Present'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ROM Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Register of Members (ROM)</h3>
                <p className="text-sm text-gray-500">股东登记册 &mdash; {shareholders.length} 位股东 &middot; Issued: {(company.shareCapital?.issued || 0).toLocaleString()} {company.shareCapital?.currency || ''}</p>
              </div>
              <button
                onClick={() => downloadRegister('rom')}
                disabled={generatingReg === 'rom'}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {generatingReg === 'rom' ? 'Generating...' : <><Download size={16} /> 生成 Word (.doc)</>}
              </button>
            </div>

            {shareholders.length === 0 ? (
              <p className="text-gray-400 text-sm py-4">No shareholders registered</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-2 font-medium text-gray-600">Date Entered</th>
                      <th className="text-left p-2 font-medium text-gray-600">Member Name</th>
                      <th className="text-left p-2 font-medium text-gray-600">Address / Jurisdiction</th>
                      <th className="text-right p-2 font-medium text-gray-600">No. of Shares</th>
                      <th className="text-left p-2 font-medium text-gray-600">Type</th>
                      <th className="text-right p-2 font-medium text-gray-600">%</th>
                      <th className="text-left p-2 font-medium text-gray-600">Date Ceased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholders.map(link => {
                      const p = resolveLinkDisplay(link)
                      const pct = company.shareCapital?.paidUp ? (link.shares ? ((link.shares / company.shareCapital.paidUp * 100).toFixed(2) + '%') : '-') : '-'
                      return (
                        <tr key={link._id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-xs">{formatDate(link.appointedDate)}</td>
                          <td className="p-2">{p.name || '-'}</td>
                          <td className="p-2 text-xs text-gray-500">{p.address?.country || p.registrationNumber || '-'}</td>
                          <td className="p-2 text-xs text-right">{(link.shares || 0).toLocaleString()}</td>
                          <td className="p-2 text-xs">{link.shareType || 'Ordinary'}</td>
                          <td className="p-2 text-xs text-right">{pct}</td>
                          <td className="p-2 text-xs">{link.ceasedDate ? formatDate(link.ceasedDate) : 'Present'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Secretary Register */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Register of Secretaries</h3>
                <p className="text-sm text-gray-500">公司秘书登记册 &mdash; {secretaries.length} 位秘书</p>
              </div>
            </div>
            {secretaries.length === 0 ? (
              <p className="text-gray-400 text-sm py-4">No secretary registered</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-2 font-medium text-gray-600">Date Appointed</th>
                      <th className="text-left p-2 font-medium text-gray-600">Name</th>
                      <th className="text-left p-2 font-medium text-gray-600">NRIC / Passport</th>
                      <th className="text-left p-2 font-medium text-gray-600">Address</th>
                      <th className="text-left p-2 font-medium text-gray-600">Date Ceased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secretaries.map(link => {
                      const p = resolveLinkDisplay(link)
                      return (
                        <tr key={link._id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-xs">{formatDate(link.appointedDate)}</td>
                          <td className="p-2">{p.name || '-'}</td>
                          <td className="p-2 text-xs text-gray-500">{p.nric || '-'}</td>
                          <td className="p-2 text-xs text-gray-500">{p.address?.country || '-'}</td>
                          <td className="p-2 text-xs">{link.ceasedDate ? formatDate(link.ceasedDate) : 'Present'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">合规状态</h2>
          {compliance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="font-semibold mb-3">统计</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-600">{compliance.links?.active || 0}</p>
                    <p className="text-gray-500">Active Links</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-600">{compliance.items?.length || 0}</p>
                    <p className="text-gray-500">Items</p>
                  </div>
                </div>
                {compliance.links?.roles && (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
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
                    <p className="text-sm text-gray-500">Due: {formatDate(item.dueDate)}</p>
                  </div>
                  <span className={`badge ${getStatusColor(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
                <p>Compliance data not available</p>
          )}
        </div>
      )}

      {/* ======== Add/Edit Link Modal ======== */}
      <Modal isOpen={showLinkModal} onClose={() => { setShowLinkModal(false); setEditingLink(null) }} title={editingLink ? 'Edit Link' : 'Add Link'} size="md">
        <form onSubmit={handleAddLink} className="space-y-4">
              <FormField label="Link Type">
                <select className={inputClass} value={linkForm.linkModel}
                  onChange={(e) => setLinkForm({ ...linkForm, linkModel: e.target.value, roles: e.target.value === 'Company' ? ['shareholder'] : ['director'] })}>
                  <option value="Personnel">Person (Personnel)</option>
                  <option value="Company">Company</option>
                </select>
              </FormField>
              {/* Select existing personnel/company */}
              {linkForm.linkModel === 'Personnel' && (
                <FormField label="Select Existing Personnel (optional)">
                  <select className={inputClass} value={linkForm.selectedId} onChange={handlePersonnelSelect}>
                    <option value="">-- Enter new person --</option>
                    {allPersonnel.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.nric || 'no ID'})</option>
                    ))}
                  </select>
                </FormField>
              )}
              {linkForm.linkModel === 'Company' && (
                <FormField label="Select Existing Company (optional)">
                  <select className={inputClass} value={linkForm.selectedId} onChange={handleCompanySelect}>
                    <option value="">-- Enter new company --</option>
                    {allCompanies.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.registrationNumber || 'N/A'})</option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Name" required error={linkFormErrors.name}>
                <input className={inputClass} value={linkForm.name}
                  onChange={(e) => { setLinkForm({ ...linkForm, name: e.target.value, selectedId: '' }); setLinkFormErrors(fe => ({ ...fe, name: '' })) }} />
              </FormField>
              {linkForm.linkModel === 'Personnel' && (
                <FormField label="NRIC">
                  <input className={inputClass} value={linkForm.nric}
                    onChange={(e) => setLinkForm({ ...linkForm, nric: e.target.value })} />
                </FormField>
              )}
              <FormField label="Roles">
                <div className="flex flex-wrap gap-2">
                  {['director', 'shareholder', 'secretary', 'other'].map(r => (
                    <label key={r} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer border ${
                      linkForm.roles.includes(r) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'
                    }`}>
                      <input type="checkbox" className="hidden" checked={linkForm.roles.includes(r)}
                        onChange={() => {
                          setLinkForm({ ...linkForm, roles: linkForm.roles.includes(r) ? linkForm.roles.filter(x => x !== r) : [...linkForm.roles, r] })
                        }} />
                      {r}
                    </label>
                  ))}
                </div>
              </FormField>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Appointed Date">
                  <input type="date" className={inputClass} value={linkForm.appointedDate}
                    onChange={(e) => setLinkForm({ ...linkForm, appointedDate: e.target.value })} />
                </FormField>
                <FormField label="Ceased Date">
                  <input type="date" className={inputClass} value={linkForm.ceasedDate}
                    onChange={(e) => setLinkForm({ ...linkForm, ceasedDate: e.target.value })} />
                </FormField>
              </div>

              {linkForm.roles.includes('shareholder') && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Shares">
                    <input type="number" className={inputClass} value={linkForm.shares}
                      onChange={(e) => setLinkForm({ ...linkForm, shares: e.target.value })} />
                  </FormField>
                  <FormField label="Share Type">
                    <select className={inputClass} value={linkForm.shareType}
                      onChange={(e) => setLinkForm({ ...linkForm, shareType: e.target.value })}>
                      <option value="ordinary">Ordinary</option>
                      <option value="preference">Preference</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowLinkModal(false); setEditingLink(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingLink ? 'Save Changes' : 'Add Link'}</button>
              </div>
            </form>
      </Modal>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}
