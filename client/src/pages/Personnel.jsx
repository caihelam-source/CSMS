import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { personnelService } from '../services/index.js'
import { Plus, Search, Users, Pencil, Trash2, Merge, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = { name: '', nric: '', email: '', phone: '', nationality: '', address: { country: '' } }

export default function Personnel() {
  const [personnel, setPersonnel] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [duplicateWarnings, setDuplicateWarnings] = useState([])
  // Merge feature
  const [selectedIds, setSelectedIds] = useState([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')

  useEffect(() => { loadPersonnel() }, [])

  const loadPersonnel = async () => {
    setLoading(true)
    try {
      const { data } = await personnelService.getAll()
      setPersonnel(data.personnel || data.data || [])
      // Load duplicate info
      try {
        const dupRes = await personnelService.getDuplicates()
        if (dupRes.success) setDuplicateWarnings(dupRes.duplicates || [])
      } catch {}
    } catch {
      toast.error('Failed to load personnel')
    } finally {
      setLoading(false)
    }
  }

  const filtered = personnel.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name?.toLowerCase().includes(q) || p.nric?.toLowerCase().includes(q)
  })

  const findDuplicateGroup = (id) => {
    return duplicateWarnings.find(group => 
      group.records.some(r => r._id === id)
    )
  }

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowModal(true) }
  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      nric: p.nric || '',
      email: p.email || '',
      phone: p.phone || '',
      nationality: p.nationality || '',
      address: { country: p.address?.country || '' },
    })
    setEditTarget(p)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      if (editTarget) {
        const { data } = await personnelService.update(editTarget._id, form)
        setPersonnel(ps => ps.map(p => p._id === editTarget._id ? data : p))
        toast.success('Person updated')
      } else {
        const result = await personnelService.create(form)
        if (result.duplicateFound) {
          toast.warning(`Possible duplicate: ${result.error}`, { icon: <AlertTriangle /> })
          // Still create, but warn
        }
        setPersonnel(ps => [result.personnel || result, ...ps])
        toast.success('Person created')
      }
      setShowModal(false)
      setForm(EMPTY_FORM)
      // Refresh duplicate info
      loadPersonnel()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p) => {
    if (!confirm(`Delete ${p.name}? This will remove all associated appointments.`)) return
    try {
      await personnelService.delete(p._id)
      setPersonnel(ps => ps.filter(x => x._id !== p._id))
      toast.success('Person deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  // Merge handlers
  const toggleSelect = (id) => {
    setSelectedIds(ids => {
      if (ids.includes(id)) return ids.filter(x => x !== id)
      if (ids.length >= 2) return ids
      return [...ids, id]
    })
  }

  const handleMerge = async () => {
    if (selectedIds.length !== 2 || !mergeTargetId) { toast.error('Select exactly 2 personnel and choose target'); return }
    const sourceId = selectedIds.find(id => id !== mergeTargetId)
    if (!sourceId) return
    try {
      const result = await personnelService.merge(mergeTargetId, sourceId)
      toast.success('Personnel merged successfully')
      setSelectedIds([])
      setShowMergeModal(false)
      setMergeTargetId('')
      loadPersonnel()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Merge failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personnel</h1>
          <p className="text-gray-500">{personnel.length} people</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length === 2 && (
            <button onClick={() => setShowMergeModal(true)} className="btn-primary flex items-center gap-2">
              <Merge size={16} /> Merge Selected
            </button>
          )}
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Person
          </button>
        </div>
      </div>

      {/* Duplicate warnings */}
      {duplicateWarnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Duplicate Detection Warning</h3>
            <span className="ml-auto text-sm text-yellow-600">{duplicateWarnings.length} duplicate group{duplicateWarnings.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-1 text-sm">
            {duplicateWarnings.slice(0, 3).map(group => (
              <div key={group.name} className="flex items-center gap-2">
                <span className="text-yellow-700 font-medium">{group.name}</span>
                <span className="text-yellow-500">({group.count} records)</span>
              </div>
            ))}
            {duplicateWarnings.length > 3 && (
              <div className="text-yellow-500 text-xs mt-1">... and {duplicateWarnings.length - 3} more duplicate groups</div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or NRIC..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>No personnel found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => {
            const dupGroup = findDuplicateGroup(p._id)
            return (
              <div key={p._id} className={`card flex items-center justify-between hover:shadow-md transition-shadow ${selectedIds.includes(p._id) ? 'ring-2 ring-primary-500' : ''} ${dupGroup ? 'border-l-4 border-l-yellow-400' : ''}`}>
                <div className="flex items-center gap-3 flex-1">
                  <input type="checkbox" checked={selectedIds.includes(p._id)} onChange={() => toggleSelect(p._id)}
                    className="w-4 h-4 text-primary-600 rounded" />
                  <Link to={`/personnel/${p._id}`} className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                      {p.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-primary-600 hover:underline">{p.name}</p>
                        {dupGroup && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1" title="Duplicate detected">
                            <AlertTriangle size={10} /> {dupGroup.count}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-xs text-gray-400">
                        {p.nric && <span>{p.nric}</span>}
                        {p.nationality && <span>· {p.nationality}</span>}
                        {p.email && <span>· {p.email}</span>}
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:text-blue-600 rounded"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(p)} className="p-2 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">{editTarget ? 'Edit Person' : 'New Person'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input-field" value={form.name} required
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">NRIC</label>
                  <input className="input-field" value={form.nric}
                    onChange={e => setForm({ ...form, nric: e.target.value })} />
                </div>
                <div>
                  <label className="label">Nationality</label>
                  <input className="input-field" value={form.nationality}
                    onChange={e => setForm({ ...form, nationality: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Merge Personnel</h2>
            <p className="text-sm text-gray-500 mb-4">Select which person to keep as the main record. The other will be deleted and all references (companies, meetings, documents) will be updated.</p>
            <div className="space-y-3">
              {selectedIds.map(id => {
                const p = personnel.find(pp => pp._id === id)
                if (!p) return null
                return (
                  <div key={id} className={`p-3 border rounded-lg cursor-pointer ${mergeTargetId === id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                    onClick={() => setMergeTargetId(id)}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={mergeTargetId === id} onChange={() => setMergeTargetId(id)} />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.nric || 'No ID'} · {p.nationality || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setShowMergeModal(false); setSelectedIds([]); setMergeTargetId('') }} className="btn-secondary">Cancel</button>
              <button onClick={handleMerge} disabled={!mergeTargetId} className="btn-primary">Merge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
