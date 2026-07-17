import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { companyService } from '../services/index.js'
import { formatDate, getStatusColor } from '../utils/helpers'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, jurisdictionLabel, JURISDICTION_OPTIONS } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal'

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

  // Search + filter via useSearchFilter
  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    companies,
    (c, q, f) => {
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.registrationNumber?.toLowerCase().includes(q)
      const matchStatus = !f.status || c.status === f.status
      const matchType = !f.type || c.type === f.type
      return matchSearch && matchStatus && matchType
    },
    { status: '', type: '' }
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

  const openNew = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditTarget(null); setModal('new') }
  const openEdit = (c) => {
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
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} companies`}
        icon={Building2}
        actions={
          <>
            {canEdit && (
              <button onClick={() => { setImportResult(null); setImportModal(true) }}
                className="btn-secondary flex items-center gap-1.5">
                <Upload size={15} /> Excel 导入
              </button>
            )}
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Company
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search companies..." />
        <select className="input-field w-auto" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="dormant">Dormant</option>
          <option value="struck_off">Struck Off</option>
        </select>
        <select className="input-field w-auto" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
          <option value="">All Types</option>
          <option value="private_limited">Private Limited</option>
          <option value="public_limited">Public Limited</option>
        </select>
      </div>

      {/* Company List */}
      {loading ? (
        <LoadingSpinner size="lg" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No companies found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Link key={c._id} to={`/companies/${c._id}`} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-primary-600 line-clamp-2">{c.name}</h3>
                <span className={`badge ${getStatusColor(c.status)}`}>{c.status?.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm text-ink-2">{c.registrationNumber || '-'}</p>
              <div className="flex gap-2 mt-2">
                {c.jurisdiction && <span className="badge badge-info text-xs">{jurisdictionLabel(c.jurisdiction)}</span>}
                {c.type && <span className="badge badge-gray text-xs capitalize">{c.type?.replace(/_/g, ' ')}</span>}
              </div>
              {c.incorporationDate && (
                <p className="text-xs text-ink-3 mt-3">Incorporated: {formatDate(c.incorporationDate)}</p>
              )}
              {c.links?.length > 0 && (
                <p className="text-xs text-ink-3 mt-1">{c.links.length} linked people/companies</p>
              )}
              <div className="flex gap-1 mt-3 pt-2 border-t border-hairline" onClick={e => e.preventDefault()}>
                <button onClick={() => openEdit(c)} className="p-1.5 text-ink-3 hover:text-primary-600 rounded-lg hover:bg-canvas"><Pencil size={14} /></button>
                <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-ink-3 hover:text-danger rounded-lg hover:bg-canvas"><Trash2 size={14} /></button>
              </div>
            </Link>
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
    </div>
  )
}
