import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2, Upload, Download, FileUp, ShieldCheck, GitMerge, AlertTriangle } from 'lucide-react'
import { companyService } from '../services/index.js'
import { formatDate, getStatusColor } from '../utils/helpers'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, jurisdictionLabel, JURISDICTION_OPTIONS } from '../components/UIHelpers'
import { IconBadge } from '../components/VisualKit'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { useScope, useScopedItems } from '../hooks/useScope'
import { NO_SCOPE_HINT } from '../utils/scope'
import { validate, required } from '../utils/validators'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal'
import Nar1ImportPage from './Nar1Import'
// jurisdiction 归一化（与服务器端 companies.js 逻辑一致）
const normalizeJurisdiction = (v) => {
  const m = {
    '香港': 'HK', 'Hong Kong': 'HK',
    'BVI': 'BVI', 'British Virgin Islands': 'BVI',
    '开曼': 'Cayman', 'Cayman': 'Cayman', 'Cayman Islands': 'Cayman',
    '新加坡': 'SG', 'Singapore': 'SG',
    '其他': 'OTHER', 'Other': 'OTHER',
  };
  return m[String(v || '').trim()] || 'HK';
};

const EMPTY_FORM = {
  name: '', registrationNumber: '', type: 'private_limited', status: 'active',
  incorporationDate: '', jurisdiction: '', registeredAddress: { country: '' },
}

const FORM_RULES = {
  name: [required('公司名称为必填')],
}

// 列表行抽成 memo 组件：父组件任意 state 变更时，仅数据变化的卡片会重渲染
const CompanyCard = memo(function CompanyCard({ company: c, onEdit, onDelete }) {
  return (
    <Link to={`/companies/${c._id}`} className="card hover:shadow-md transition-shadow w-full h-full block min-w-0">
      <div className="flex items-start gap-3 mb-3 min-w-0">
        <IconBadge icon={Building2} tone="primary" size="lg" className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <h3 className="font-semibold text-primary-600 line-clamp-2 break-words min-w-0">{c.name}</h3>
            <span className={`badge ${getStatusColor(c.status)} flex-shrink-0 self-start`}>
              {c.status === 'merged' ? '已合并' : (c.status?.replace(/_/g, ' ') || '')}
            </span>
          </div>
        </div>
      </div>
      <p className="text-sm text-ink-2 break-words">{c.registrationNumber || '-'}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {c.jurisdiction && <span className="badge badge-info text-xs break-words">{jurisdictionLabel(c.jurisdiction)}</span>}
        {c.type && <span className="badge badge-gray text-xs capitalize break-words">{c.type?.replace(/_/g, ' ')}</span>}
      </div>
      {c.incorporationDate && (
        <p className="text-xs text-ink-3 mt-3">Incorporated: {formatDate(c.incorporationDate)}</p>
      )}
      {c.links?.length > 0 && (
        <p className="text-xs text-ink-3 mt-1 break-words">{c.links.length} linked people/companies</p>
      )}
      {/* 合并态徽章：区别于正常卡片，提示这是曾用公司 */}
      {c.status === 'merged' && c.mergedInto && (
        <p className="text-xs text-warning mt-2 break-words">
          已合并 · <Link to={`/companies/${c.mergedInto}`} className="underline" onClick={e => e.stopPropagation()}>查看目标公司</Link>
        </p>
      )}
      {c.formerNames?.length > 0 && (
        <p className="text-xs text-ink-3 mt-2 break-words" title={c.formerNames.map(fn => fn.name).join(' / ')}>
          曾用名：{c.formerNames.slice(-2).map(fn => fn.name).join(' / ')}
          {c.formerNames.length > 2 && ' 等'}
        </p>
      )}
      <div className="flex gap-1 mt-3 pt-2 border-t border-hairline" onClick={e => e.preventDefault()}>
        <button onClick={() => onEdit(c)} className="p-1.5 text-ink-3 hover:text-primary-600 rounded-lg hover:bg-canvas" aria-label={`编辑 ${c.name}`}><Pencil size={14} /></button>
        <button onClick={() => onDelete(c)} className="p-1.5 text-ink-3 hover:text-danger rounded-lg hover:bg-canvas" aria-label={`删除 ${c.name}`}><Trash2 size={14} /></button>
      </div>
    </Link>
  )
})

export default function Companies() {
  const { user, canEdit } = useAuth()
  const isDemo = !user?.token || user?.token?.startsWith('demo-')

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Excel import
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const importFileRef = useRef()
  // NAR1 批量导入（仅适用于香港公司）
  const [nar1Open, setNar1Open] = useState(false)
  // v6.x 公司去重 / 合并闭环
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const [dupLoading, setDupLoading] = useState(false)
  const [dupPairs, setDupPairs] = useState([])
  const [dupThreshold, setDupThreshold] = useState(0.92)
  const [mergeBusy, setMergeBusy] = useState(null) // 正在合并的 pair 索引
  const [mergingAll, setMergingAll] = useState(false)

  // 行级数据权限：渲染期无声过滤（真实模式服务端已过滤，此处幂等 no-op）
  const { noScope } = useScope()
  const scopedCompanies = useScopedItems(companies, c => c._id)

  // Search + filter via useSearchFilter
  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    scopedCompanies,
    (c, q, f) => {
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.registrationNumber?.toLowerCase().includes(q)
      const matchStatus = !f.status || c.status === f.status
      const matchType = !f.type || c.type === f.type
      const matchJurisdiction = !f.jurisdiction || c.jurisdiction === f.jurisdiction
      return matchSearch && matchStatus && matchType && matchJurisdiction
    },
    { status: '', type: '', jurisdiction: '' }
  )

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await companyService.getAll()
      setCompanies(data.data || [])
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  // 打开 NAR1 导入 Modal：Nar1ImportPage 内部会自行探测引擎可用性
  const openNar1 = useCallback(() => setNar1Open(true), [])

  const openNew = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditTarget(null); setModal('new') }
  const openEdit = useCallback((c) => {
    setForm({
      ...EMPTY_FORM,
      name: c.name || '',
      registrationNumber: c.registrationNumber || '',
      type: c.type || 'private_limited',
      status: c.status || 'active',
      incorporationDate: c.incorporationDate ? c.incorporationDate.slice(0, 10) : '',
      jurisdiction: c.jurisdiction || c.registeredAddress?.country || '',
    })
    setFormErrors({})
    setEditTarget(c)
    setModal('edit')
  }, [])

  const handleSave = async () => {
    const { valid, errors } = validate(form, FORM_RULES)
    if (!valid) { setFormErrors(errors); return }
    setSaving(true)
    try {
      if (editTarget) {
        const { data } = await companyService.update(editTarget._id, form)
        setCompanies(cs => cs.map(c => c._id === editTarget._id ? data.data : c))
        toast.success('Company updated')
      } else {
        const { data } = await companyService.create(form)
        setCompanies(cs => [data.data, ...cs])
        toast.success('Company created')
      }
      setModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      if (!isDemo) await companyService.delete(deleteTarget._id)
      setCompanies(cs => cs.filter(c => c._id !== deleteTarget._id))
      toast.success('Company deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteTarget(null)
    }
  }

  // ---- Excel 批量导入（解析 + 落库 + 去重）----
  const downloadTemplate = () => {
    const headers = ['公司名称', '注册号', '类型', '属地', '状态', '成立日期']
    const example = ['ABC Trading Ltd', '12345678', 'private_limited', 'Hong Kong', 'active', '2020-01-15']
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([headers, example])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Companies')
      XLSX.writeFile(wb, 'companies_template.xlsx')
    })
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      let created = 0, skipped = 0
      const errors = []
      const existing = [...companies]
      const typeMap = { private_limited: 'private_limited', 'Private Limited': 'private_limited', 'private limited': 'private_limited', public_limited: 'public_limited', 'Public Limited': 'public_limited', llp: 'llp', LLP: 'llp' }
      const statusMap = { active: 'active', Active: 'active', dormant: 'dormant', Dormant: 'dormant', struck_off: 'struck_off', 'Struck Off': 'struck_off' }
      for (const row of rows) {
        const name = (row['公司名称'] || row['Company Name'] || row.name || '').toString().trim()
        if (!name) { errors.push('跳过空行'); continue }
        const regNo = (row['注册号'] || row['Registration No.'] || row.registrationNumber || '').toString().trim()
        const dup = existing.find(c => c.name === name || (regNo && c.registrationNumber === regNo))
        if (dup) { skipped++; continue }
        const payload = {
          name,
          registrationNumber: regNo || undefined,
          type: typeMap[row['类型'] || row['Type']] || 'private_limited',
          jurisdiction: normalizeJurisdiction(row['属地'] || row['Jurisdiction']),
          status: statusMap[row['状态'] || row['Status']] || 'active',
          incorporationDate: row['成立日期'] || row['Incorporation Date'] || undefined,
        }
        await companyService.create(payload)
        existing.push(payload)
        created++
      }
      setImportResult({ success: true, created, skipped, errors })
      fetchCompanies()
      toast.success(`导入完成：新增 ${created} 家，跳过 ${skipped} 家`)
    } catch (err) {
      setImportResult({ success: false, message: err.message || '导入失败' })
    }
    e.target.value = ''
  }

  // C1：下传给虚拟网格卡片的稳定回调（避免父 state 抖动触发卡片重渲染）
  const companyItemProps = useMemo(
    () => ({ onEdit: openEdit, onDelete: setDeleteTarget }),
    [openEdit, setDeleteTarget]
  )

  // v6.x 公司去重：打开模态并拉取重复对
  const openDuplicateCheck = useCallback(async () => {
    setDupModalOpen(true)
    setDupLoading(true)
    setDupPairs([])
    try {
      const { data } = await companyService.duplicates({ fuzzyThreshold: dupThreshold })
      setDupPairs(data?.data?.pairs || data?.pairs || [])
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || '检测失败')
    } finally {
      setDupLoading(false)
    }
  }, [dupThreshold])

  // v6.x 公司去重：执行单对合并（targetId 即"留下"那个，源被并入）
  const handleMergePair = useCallback(async (pair, pairIdx, targetId, options) => {
    const isA = targetId === pair.a._id
    const src = isA ? pair.b : pair.a
    const tgt = isA ? pair.a : pair.b
    if (!confirm(`把「${src.name}」合并到「${tgt.name}」？\n\n源公司 status 会改为 'merged'，formerNames 加入 target，文件按 v6.x 重新编号（HKOP/LISTCO 等），反向引用全部迁到 target。\n此操作一旦执行请用 admin 工具手动清理。`)) return
    setMergeBusy(pairIdx)
    try {
      await companyService.merge(src._id, { targetCompanyId: tgt._id, options })
      toast.success(`已合并：${src.name} → ${tgt.name}`)
      setDupPairs((ps) => ps.filter((_, i) => i !== pairIdx))
      fetchCompanies()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || '合并失败')
    } finally {
      setMergeBusy(null)
    }
  }, [fetchCompanies])

  const handleMergeAll = useCallback(async (options) => {
    if (dupPairs.length === 0) return
    if (!confirm(`批量合并所有 ${dupPairs.length} 对？\n\n每对按「注册号较小者作为 target」自动选边，您仍可在合并后手动调整。`)) return
    setMergingAll(true)
    let success = 0, failed = 0
    for (let i = 0; i < dupPairs.length; i++) {
      const p = dupPairs[i]
      // 默认归并规则：exact_regno → 完整 BR 号走 target；fuzzy → 先创建者（左 a）为 target
      const target = p.type === 'exact_regno' ? p.a : p.a
      const source = target === p.a ? p.b : p.a
      setMergeBusy(i)
      try {
        await companyService.merge(source._id, { targetCompanyId: target._id, options })
        success++
      } catch {
        failed++
      }
    }
    setDupPairs([])
    setMergeBusy(null)
    setMergingAll(false)
    toast.success(`批量合并：${success} 成功 / ${failed} 失败`)
    fetchCompanies()
  }, [dupPairs, fetchCompanies])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Companies"
        subtitle={`${scopedCompanies.length} companies`}
        icon={Building2}
        actions={
          <>
            {canEdit && (
              <button onClick={() => { setImportResult(null); setImportModal(true) }}
                className="btn-secondary flex items-center gap-1.5">
                <Upload size={15} /> Excel 导入
              </button>
            )}
            {canEdit && (
              <button onClick={openNar1}
                className="btn-secondary flex items-center gap-1.5"
                title="仅适用于香港公司（BVI/Cayman 公司无 NAR1）">
                <FileUp size={15} /> 从 NAR1 导入
                <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full">
                  <ShieldCheck size={10} /> HK
                </span>
              </button>
            )}
            {/* v6.x 公司去重：点开后列出 BR 号相同 / 名称模糊匹配的对 */}
            {canEdit && (
              <button onClick={openDuplicateCheck}
                className="btn-secondary flex items-center gap-1.5"
                title="按 BR 号 / 别名 / 模糊名查找重复公司，可一键软合并">
                <GitMerge size={15} /> 检测重复
              </button>
            )}
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Company
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search companies..." className="w-full sm:flex-1" />
        <div className="flex flex-wrap gap-3 flex-1 sm:flex-initial">
          <select className="input-field flex-1 sm:flex-none sm:w-40" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="dormant">Dormant</option>
            <option value="struck_off">Struck Off</option>
          </select>
          <select className="input-field flex-1 sm:flex-none sm:w-44" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
            <option value="">All Types</option>
            <option value="private_limited">Private Limited</option>
            <option value="public_limited">Public Limited</option>
          </select>
          <select className="input-field flex-1 sm:flex-none sm:w-40" value={filters.jurisdiction} onChange={e => setFilter('jurisdiction', e.target.value)}>
            <option value="">All Jurisdictions</option>
            {JURISDICTION_OPTIONS.map(j => (
              <option key={j.value} value={j.value}>{j.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Company List */}
      {loading ? (
        <LoadingSpinner size="lg" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={noScope ? '暂无可访问的公司' : '还没有公司'}
          description={noScope ? NO_SCOPE_HINT : '添加第一家公司，开始集中管理你的公司秘书事务'}
          action={noScope ? null : <button onClick={openNew} className="btn-primary flex items-center gap-1.5"><Plus size={16} />添加公司</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CompanyCard key={c._id} company={c} {...companyItemProps} />
          ))}
        </div>
      )}

      {/* New/Edit Modal */}
      <Modal isOpen={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'new' ? 'New Company' : 'Edit Company'} size="md">
            <div className="space-y-4">
              <FormField label="Company Name" required error={formErrors.name}>
                <input className={inputClass} value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(fe => ({ ...fe, name: '' })) }} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Registration No.">
                  <input className={inputClass} value={form.registrationNumber}
                    onChange={e => setForm({ ...form, registrationNumber: e.target.value })} />
                </FormField>
                <FormField label="Jurisdiction">
                  <select className={inputClass} value={form.jurisdiction}
                    onChange={e => setForm({ ...form, jurisdiction: e.target.value })}>
                    <option value="">Select</option>
                    {JURISDICTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Type">
                  <select className={inputClass} value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="private_limited">Private Limited</option>
                    <option value="public_limited">Public Limited</option>
                    <option value="llp">LLP</option>
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className={inputClass} value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="dormant">Dormant</option>
                    <option value="struck_off">Struck Off</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Incorporation Date">
                <input type="date" className={inputClass} value={form.incorporationDate}
                  onChange={e => setForm({ ...form, incorporationDate: e.target.value })} />
              </FormField>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
      </Modal>

      {/* Delete Confirm */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={saving}
      />

      {/* Excel 导入 */}
      <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Excel 批量导入公司" size="md">
        <div className="space-y-4">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 text-sm text-primary-700">
            <p className="font-medium mb-1">导入说明</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>必填列：公司名称</li>
              <li>可选列：注册号、类型、属地、状态、成立日期</li>
              <li>相同名称或注册号的公司将自动跳过（去重）</li>
            </ul>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
            <Download size={16} /> 下载 Excel 模板
          </button>
          <div className="border-2 border-dashed border-hairline rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => importFileRef.current?.click()}>
            <Upload size={32} className="mx-auto text-ink-3 mb-3" />
            <p className="text-ink-2 text-sm">点击选择 Excel 文件</p>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
          {importResult && (
            <div className={`p-4 rounded-lg text-sm ${importResult.success ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
              {importResult.success
                ? <><p className="font-medium">导入完成</p><p>新增 {importResult.created} 家，跳过 {importResult.skipped} 家</p>
                  {importResult.errors?.length > 0 && <div className="mt-2 text-warning"><ul className="list-disc list-inside text-xs">{importResult.errors.map((er, i) => <li key={i}>{er}</li>)}</ul></div>}</>
                : <p>{importResult.message}</p>}
            </div>
          )}
        </div>
      </Modal>

      {/* NAR1 批量导入（嵌入 Nar1Import，embedded=true 隐藏 PageHeader、压缩 padding） */}
      <Modal isOpen={nar1Open} onClose={() => setNar1Open(false)} title="从 NAR1 导入香港公司" size="xl">
        {nar1Open && <Nar1ImportPage embedded />}
      </Modal>

      {/* v6.x 公司去重 / 合并 */}
      <Modal isOpen={dupModalOpen} onClose={() => setDupModalOpen(false)} title="🔍 检测公司重复" size="xl">
        <div className="space-y-4">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 text-sm text-primary-700">
            <p className="font-medium mb-1 flex items-center gap-1.5"><AlertTriangle size={14} /> 三层匹配规则</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>EXACT_REGNO</strong>：registrationNumber 完全相同（容忍 DEMO-CR- 前缀）</li>
              <li><strong>ALIAS</strong>：任一方 formerNames[] 命中对方 name</li>
              <li><strong>FUZZY</strong>：归一化后 Jaro-Winkler ≥ 阈值（默认 0.92）</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-ink-2">
              模糊阈值
              <input
                type="number" step="0.01" min="0.5" max="1"
                value={dupThreshold}
                onChange={e => setDupThreshold(parseFloat(e.target.value) || 0.92)}
                className="ml-2 w-20 input-field inline-block"
              />
            </label>
            <button onClick={openDuplicateCheck} className="btn-secondary text-sm">
              重新检测
            </button>
            {dupPairs.length > 0 && (
              <button
                onClick={() => handleMergeAll({ addAsFormerName: true, renumberFiles: true, mergeLinks: true })}
                disabled={mergingAll}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <GitMerge size={14} /> 一键合并全部（{dupPairs.length} 对）
              </button>
            )}
          </div>

          {dupLoading ? (
            <div className="py-8 text-center text-ink-3">扫描中…</div>
          ) : dupPairs.length === 0 ? (
            <div className="py-8 text-center text-ink-3">✓ 没有发现重复公司</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {dupPairs.map((pair, idx) => (
                <div key={idx} className="card flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`badge text-xs ${
                      pair.type === 'exact_regno' ? 'bg-danger/15 text-danger' :
                      pair.type === 'alias' ? 'bg-warning/15 text-warning' :
                      'bg-primary/15 text-primary'
                    }`}>
                      {pair.type} · 相似度 {(pair.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[pair.a, pair.b].map((c) => (
                      <div key={c._id} className="rounded-lg border border-hairline p-3 min-w-0">
                        <div className="font-medium text-ink-1 break-words">{c.name}</div>
                        {c.nameChinese && <div className="text-xs text-ink-3 mt-0.5 break-words">{c.nameChinese}</div>}
                        <div className="text-xs text-ink-2 mt-1">BR: {c.registrationNumber || '—'}</div>
                        {c.jurisdiction && <div className="text-xs text-ink-2">{jurisdictionLabel(c.jurisdiction)}</div>}
                        {c.formerNames?.length > 0 && (
                          <div className="text-xs text-ink-3 mt-1 break-words" title={c.formerNames.map(fn => fn.name).join(' / ')}>
                            曾用名：{c.formerNames.slice(-2).map(fn => fn.name).join(' / ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={mergeBusy === idx || mergingAll}
                      onClick={() => handleMergePair(pair, idx, pair.a._id)}
                      className="btn-secondary text-xs"
                    >
                      {mergeBusy === idx ? '合并中…' : `把 B 合到 A`}
                    </button>
                    <button
                      disabled={mergeBusy === idx || mergingAll}
                      onClick={() => handleMergePair(pair, idx, pair.b._id)}
                      className="btn-secondary text-xs"
                    >
                      {mergeBusy === idx ? '合并中…' : `把 A 合到 B`}
                    </button>
                    <span className="text-xs text-ink-3 self-center">说明：源公司将进入 status=merged 软合并，文件按 v6.x 重编号</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-hairline">
            <button onClick={() => setDupModalOpen(false)} className="btn-secondary">关闭</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
