import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { companyService } from '../services/index.js'
import { formatDate, getStatusColor } from '../utils/helpers'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { useAuth } from '../contexts/AuthContext.jsx'
import Modal from '../components/Modal'

const EMPTY_FORM = {
  name: '', registrationNumber: '', type: 'private_limited', status: 'active',
  incorporationDate: '', jurisdiction: '', registeredAddress: { country: '' },
}

const FORM_RULES = {
  name: [required('公司名称为必填')],
}

export default function Companies() {
  const { user } = useAuth()
  const isDemo = !user?.token || user?.token?.startsWith('demo-')

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} companies`}
        icon={Building2}
        actions={
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Company
          </button>
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
              <p className="text-sm text-gray-500">{c.registrationNumber || '-'}</p>
              <div className="flex gap-2 mt-2">
                {c.jurisdiction && <span className="badge badge-info text-xs">{c.jurisdiction}</span>}
                {c.type && <span className="badge badge-gray text-xs capitalize">{c.type?.replace(/_/g, ' ')}</span>}
              </div>
              {c.incorporationDate && (
                <p className="text-xs text-gray-400 mt-3">Incorporated: {formatDate(c.incorporationDate)}</p>
              )}
              {c.links?.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">{c.links.length} linked people/companies</p>
              )}
              <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100" onClick={e => e.preventDefault()}>
                <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50"><Pencil size={14} /></button>
                <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50"><Trash2 size={14} /></button>
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
                    <option value="Hong Kong">Hong Kong</option>
                    <option value="BVI">BVI</option>
                    <option value="Cayman Islands">Cayman Islands</option>
                    <option value="Singapore">Singapore</option>
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
    </div>
  )
}
