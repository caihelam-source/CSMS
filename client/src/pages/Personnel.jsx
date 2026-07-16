import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Users, Pencil, Trash2, Merge, AlertTriangle, Upload, Download, Building2 } from 'lucide-react'
import { personnelService, companyService } from '../services/index.js'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required, email as emailValidator } from '../utils/validators'
import { useConfirm } from '../components/ConfirmDialog'
import { VirtualList } from '../components/VirtualList'
import Modal from '../components/Modal'

const EMPTY_FORM = { name: '', nric: '', email: '', phone: '', nationality: '', address: { country: '' } }

const FORM_RULES = {
  name: [required('姓名为必填')],
  email: [emailValidator('邮箱格式不正确')],
}

export default function Personnel() {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [personnel, setPersonnel] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [duplicateWarnings, setDuplicateWarnings] = useState([])
  // Merge feature
  const [selectedIds, setSelectedIds] = useState([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')
  // 角色筛选（董事/股东/秘书）
  const [roleFilter, setRoleFilter] = useState('all')
  // Excel 批量导入（统一入口：导入人员并自动关联任职公司）
  const [companies, setCompanies] = useState([])
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const importFileRef = useRef()

  // Search + filter via useSearchFilter
  const { search, setSearch, filtered } = useSearchFilter(
    personnel,
    (p, q) => !q || p.name?.toLowerCase().includes(q) || p.nric?.toLowerCase().includes(q),
    {}
  )

  const loadPersonnel = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, compRes] = await Promise.all([
        personnelService.getAll({ role: roleFilter === 'all' ? undefined : roleFilter }),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setPersonnel(listRes.data.data || [])
      setCompanies(compRes.data.data || [])
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
  }, [roleFilter])

  useEffect(() => { loadPersonnel() }, [loadPersonnel])

  const findDuplicateGroup = useCallback((id) => {
    return duplicateWarnings.find(group =>
      group.records.some(r => r._id === id)
    )
  }, [duplicateWarnings])

  const openCreate = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditTarget(null); setShowModal(true) }
  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      nric: p.nric || '',
      email: p.email || '',
      phone: p.phone || '',
      nationality: p.nationality || '',
      address: { country: p.address?.country || '' },
    })
    setFormErrors({})
    setEditTarget(p)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const { valid, errors } = validate(form, FORM_RULES)
    if (!valid) { setFormErrors(errors); return }
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
        }
        setPersonnel(ps => [result.personnel || result, ...ps])
        toast.success('Person created')
      }
      setShowModal(false)
      setForm(EMPTY_FORM)
      loadPersonnel()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p) => {
    const ok = await confirm({ title: '删除人员', message: `确定删除 ${p.name}？此操作将移除所有关联任职记录，不可撤销。`, confirmLabel: '确认删除' })
    if (!ok) return
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
      await personnelService.merge(mergeTargetId, sourceId)
      toast.success('Personnel merged successfully')
      setSelectedIds([])
      setShowMergeModal(false)
      setMergeTargetId('')
      loadPersonnel()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Merge failed')
    }
  }

  // 角色中文标签
  const ROLE_LABELS = { director: '董事', alternate_director: '替任董事', shareholder: '股东', secretary: '公司秘书', auditor: '审计师', authorized_representative: '授权代表', corporate_secretary: '公司秘书(公司)', other: '其他' }
  const roleLabel = (r) => ROLE_LABELS[r] || r

  // ---- Excel 批量导入（统一：建人员 + 自动关联任职公司）----
  const downloadTemplate = () => {
    const headers = ['姓名', '中文名', '证件号', '邮箱', '电话', '任职公司', '角色', '任命日期', '状态']
    const example = ['John Smith', '张三', 'A123456(7)', 'john@example.com', '+852 9876 5432', 'Easy Rich Corporation Ltd (順富興業)', '董事', '2021-03-15', '在任']
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([headers, example])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Personnel')
      XLSX.writeFile(wb, 'personnel_template.xlsx')
    })
  }

  const ROLE_MAP = { 董事: 'director', 股东: 'shareholder', 秘书: 'secretary', 公司秘书: 'secretary', 审计师: 'auditor', 授权代表: 'authorized_representative' }

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      let created = 0, linked = 0
      const errors = []
      const companyMap = {}
      companies.forEach(c => { companyMap[c.name] = c._id })
      const existing = [...personnel]
      for (const row of rows) {
        const name = (row['姓名'] || row['Name'] || '').toString().trim()
        if (!name) { errors.push('跳过空行'); continue }
        const idNumber = (row['证件号'] || row['ID No.'] || row['idNumber'] || '').toString().trim()
        let p = existing.find(x => x.name === name && (!idNumber || x.nric === idNumber))
        if (!p) {
          const { data: res } = await personnelService.create({
            name,
            nameChinese: row['中文名'] || row['Name (Chinese)'] || '',
            nric: idNumber || undefined,
            email: row['邮箱'] || row['Email'] || '',
            phone: row['电话'] || row['Phone'] || '',
            nationality: row['国籍'] || row['Nationality'] || '',
          })
          p = res; existing.push(res); created++
        }
        // 关联任职公司
        const companyName = row['任职公司'] || row['Company'] || ''
        const roleZh = row['角色'] || row['Role'] || '董事'
        const role = ROLE_MAP[roleZh] || 'director'
        const appointedDate = row['任命日期'] || row['Appointed Date'] || ''
        const status = row['状态'] || row['Status'] || '在任'
        if (companyName && companyMap[companyName]) {
          const cid = companyMap[companyName]
          const already = (p.companies || []).some(c => c.company?._id === cid && (c.roles || []).includes(role))
          if (!already) {
            await companyService.addLink(cid, {
              linkModel: 'Personnel',
              link: { _id: p._id, name: p.name, nric: p.nric },
              roles: [role],
              appointmentDate: appointedDate || undefined,
              ceasedDate: status === '离任' ? (appointedDate || '') : undefined,
            })
            linked++
          }
        }
      }
      setImportResult({ success: true, created, linked, errors })
      loadPersonnel()
      toast.success(`导入完成：新增 ${created} 人，关联 ${linked} 条任职`)
    } catch (err) {
      setImportResult({ success: false, message: err.message || '导入失败' })
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel"
        subtitle={`${personnel.length} people`}
        icon={Users}
        actions={
          <div className="flex gap-2">
            {selectedIds.length === 2 && (
              <button onClick={() => setShowMergeModal(true)} className="btn-primary flex items-center gap-2">
                <Merge size={16} /> Merge Selected
              </button>
            )}
            <button onClick={() => { setImportResult(null); setImportModal(true) }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Upload size={15} /> Excel 导入
            </button>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Person
            </button>
          </div>
        }
      />

      {/* 角色筛选 Tab */}
      <div className="flex gap-2 flex-wrap">
        {[{ key: 'all', label: '全部' }, { key: 'director', label: '董事' }, { key: 'shareholder', label: '股东' }, { key: 'secretary', label: '公司秘书' }].map(t => (
          <button key={t.key} onClick={() => setRoleFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${roleFilter === t.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
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
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or NRIC..." />
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner size="lg" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No personnel found" />
      ) : filtered.length > 50 ? (
        <VirtualList
          items={filtered}
          itemHeight={80}
          maxHeight={600}
          renderItem={(p, _idx, style) => {
            const dupGroup = findDuplicateGroup(p._id)
            return (
              <div key={p._id} style={style} className={`px-1 py-1`}>
                <div className={`card flex items-center justify-between hover:shadow-md transition-shadow ${selectedIds.includes(p._id) ? 'ring-2 ring-primary-500' : ''} ${dupGroup ? 'border-l-4 border-l-yellow-400' : ''}`}>
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
                        {p.roles?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {p.roles.map(r => (
                              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">{roleLabel(r)}</span>
                            ))}
                          </div>
                        )}
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
              </div>
            )
          }}
        />
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
                      {p.roles?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.roles.map(r => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">{roleLabel(r)}</span>
                          ))}
                        </div>
                      )}
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

      {/* Excel 导入 */}
      <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Excel 批量导入人员" size="md">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">导入说明</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>必填列：姓名</li>
              <li>可选列：中文名、证件号、邮箱、电话、任职公司、角色(董事/股东/秘书)、任命日期、状态</li>
              <li>填写"任职公司"将自动把该人员关联为对应角色（董事/股东/秘书）</li>
            </ul>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
            <Download size={16} /> 下载 Excel 模板
          </button>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => importFileRef.current?.click()}>
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 text-sm">点击选择 Excel 文件</p>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
          {importResult && (
            <div className={`p-4 rounded-lg text-sm ${importResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {importResult.success
                ? <><p className="font-medium">导入完成</p><p>新增 {importResult.created} 人，关联 {importResult.linked} 条任职</p>
                  {importResult.errors?.length > 0 && <div className="mt-2 text-amber-700"><ul className="list-disc list-inside text-xs">{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}</>
                : <p>{importResult.message}</p>}
            </div>
          )}
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Person' : 'New Person'} size="md">
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Name" required error={formErrors.name}>
                <input className={inputClass} value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(fe => ({ ...fe, name: '' })) }} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="NRIC">
                  <input className={inputClass} value={form.nric}
                    onChange={e => setForm({ ...form, nric: e.target.value })} />
                </FormField>
                <FormField label="Nationality">
                  <input className={inputClass} value={form.nationality}
                    onChange={e => setForm({ ...form, nationality: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Email" error={formErrors.email}>
                <input type="email" className={inputClass} value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setFormErrors(fe => ({ ...fe, email: '' })) }} />
              </FormField>
              <FormField label="Phone">
                <input className={inputClass} value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </FormField>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
      </Modal>

      {/* Merge Modal */}
      <Modal isOpen={showMergeModal} onClose={() => { setShowMergeModal(false); setSelectedIds([]); setMergeTargetId('') }} title="Merge Personnel" size="md">
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
      </Modal>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}
