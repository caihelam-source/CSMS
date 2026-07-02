import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { companyService } from '../services/index.js'
import { formatDate, getStatusColor } from '../utils/helpers'
import { useAuth } from '../contexts/AuthContext.jsx'
import toast from 'react-hot-toast'
import { Building2, Plus, Search, Pencil, Trash2, Upload, Download } from 'lucide-react'

const EMPTY_FORM = {
  name: '', registrationNumber: '', type: 'private_limited', status: 'active',
  incorporationDate: '', jurisdiction: '', registeredAddress: { country: '' },
}

export default function Companies() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const isDemo = !user?.token || user?.token?.startsWith('demo-')

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => { fetchCompanies() }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const { data } = await companyService.getAll()
      setCompanies(data.data || [])
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const filtered = companies.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.registrationNumber?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || c.status === filterStatus
    const matchType = !filterType || c.type === filterType
    return matchSearch && matchStatus && matchType
  })

  const openNew = () => { setForm(EMPTY_FORM); setEditTarget(null); setModal('new') }
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
    setEditTarget(c)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name) { toast.error('Company name required'); return }
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
    if (!editTarget) return
    setSaving(true)
    try {
      if (!isDemo) await companyService.delete(editTarget._id)
      setCompanies(cs => cs.filter(c => c._id !== editTarget._id))
      setModal(null)
      toast.success('Company deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-gray-500">{companies.length} companies</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Company
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search companies..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="dormant">Dormant</option>
          <option value="struck_off">Struck Off</option>
        </select>
        <select className="input-field w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="private_limited">Private Limited</option>
          <option value="public_limited">Public Limited</option>
        </select>
      </div>

      {/* Company List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>No companies found</p>
        </div>
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
              {(c.links?.length > 0) && (
                <p className="text-xs text-gray-400 mt-1">{c.links.length} linked people/companies</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* New/Edit Modal */}
      {(modal === 'new' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">{modal === 'new' ? 'New Company' : 'Edit Company'}</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Company Name *</label>
                <input className="input-field" value={form.name} required
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Registration No.</label>
                  <input className="input-field" value={form.registrationNumber}
                    onChange={e => setForm({ ...form, registrationNumber: e.target.value })} />
                </div>
                <div>
                  <label className="label">Jurisdiction</label>
                  <select className="input-field" value={form.jurisdiction}
                    onChange={e => setForm({ ...form, jurisdiction: e.target.value })}>
                    <option value="">Select</option>
                    <option value="Hong Kong">Hong Kong</option>
                    <option value="BVI">BVI</option>
                    <option value="Cayman Islands">Cayman Islands</option>
                    <option value="Singapore">Singapore</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field" value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="private_limited">Private Limited</option>
                    <option value="public_limited">Public Limited</option>
                    <option value="llp">LLP</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="dormant">Dormant</option>
                    <option value="struck_off">Struck Off</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Incorporation Date</label>
                <input type="date" className="input-field" value={form.incorporationDate}
                  onChange={e => setForm({ ...form, incorporationDate: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {modal === 'delete' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">Delete "{editTarget?.name}"? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={saving} className="btn-danger">
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
