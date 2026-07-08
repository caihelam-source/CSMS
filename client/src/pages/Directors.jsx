import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Pencil, Trash2, Upload, Download, Building2, RefreshCw, Mail, Phone } from 'lucide-react'
import { directorService, personnelService, companyService } from '../services/index.js'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required, email as emailValidator } from '../utils/validators'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

const EMPTY_FORM = {
  name: '', nameChinese: '', dateOfBirth: '', idNumber: '', passportNumber: '',
  email: '', phone: '', residentialAddress: '', correspondenceAddress: '', nationality: '',
}

const FORM_RULES = {
  name: [required('姓名为必填')],
  email: [emailValidator('邮箱格式不正确')],
}

export default function Directors() {
  const { canEdit, canDelete, isDemo } = useAuth()
  const [directors, setDirectors] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  const { search, setSearch, filtered } = useSearchFilter(directors, (d, q) =>
    !q || [d.name, d.nameChinese, d.idNumber, d.email].some(f => f && f.toLowerCase().includes(q))
  )

  const [modal, setModal] = useState(null) // null | 'new' | 'edit' | 'delete' | 'import' | 'appt'
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [apptForm, setApptForm] = useState({ company: '', position: '董事', appointedDate: '', status: '在任' })
  const [saving, setSaving] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef()

  // 人员库数据（用于从人员库选择）
  const [personnel, setPersonnel] = useState([])

  // Fetch callbacks (defined before useEffect to ensure correct reference order)
  const fetchPersonnel = useCallback(async () => {
    try {
      const { data: res } = await personnelService.getAll()
      setPersonnel(res.data || [])
    } catch { /* silent */ }
  }, [])

  const fetchCompanies = useCallback(async () => {
    try {
      const { data: res } = await companyService.getAll()
      setCompanies(res.data || [])
    } catch { setCompanies([]) }
  }, [])

  const fetchDirectors = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const { data: res } = await directorService.getAll({ search: q })
      setDirectors(res.data || [])
    } catch {
      setDirectors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchCompanies(), fetchPersonnel(), fetchDirectors()])
      setLoading(false)
    }
    init()
  }, [fetchCompanies, fetchPersonnel, fetchDirectors])

  const openNew = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditTarget(null); setModal('new') }
  const openEdit = (d) => {
    setForm({
      name: d.name || '', nameChinese: d.nameChinese || '',
      dateOfBirth: d.dateOfBirth ? (typeof d.dateOfBirth === 'string' ? d.dateOfBirth.slice(0, 10) : new Date(d.dateOfBirth).toISOString().slice(0, 10)) : '',
      idNumber: d.idNumber || '', passportNumber: d.passportNumber || '',
      email: d.email || '', phone: d.phone || '',
      residentialAddress: d.residentialAddress || '',
      correspondenceAddress: d.correspondenceAddress || '',
      nationality: d.nationality || '',
    })
    setFormErrors({})
    setEditTarget(d)
    setModal('edit')
  }

  const handleSave = async () => {
    const { valid, errors } = validate(form, FORM_RULES)
    if (!valid) { setFormErrors(errors); return }
    setSaving(true)
    try {
      if (editTarget) {
        const { data: res } = await directorService.update(editTarget._id, form)
        setDirectors(ds => ds.map(d => d._id === editTarget._id ? res : d))
        toast.success('更新成功')
      } else {
        const { data: res } = await directorService.create(form)
        setDirectors(ds => [res, ...ds])
        toast.success('创建成功')
      }
      setModal(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await directorService.delete(editTarget._id)
      setDirectors(ds => ds.filter(d => d._id !== editTarget._id))
      toast.success('删除成功')
      setModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAppt = async () => {
    if (!apptForm.company) { toast.error('请选择公司'); return }
    setSaving(true)
    try {
      const { data: res } = await directorService.addAppointment(editTarget._id, apptForm)
      setDirectors(ds => ds.map(d => d._id === editTarget._id ? res : d))
      setEditTarget(res)
      toast.success('添加职位成功')
      setApptForm({ company: '', position: '董事', appointedDate: '', status: '在任' })
    } catch (err) {
      toast.error(err.response?.data?.message || '添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      // Mock import for demo mode
      if (isDemo) {
        await new Promise(r => setTimeout(r, 500))
        setImportResult({ success: true, created: 0, updated: 0, errors: [] })
        return
      }
      const { data: res } = await directorService.getAll() // just to test connection
      setImportResult({ success: true, created: 0, updated: 0, errors: ['Excel导入功能需要后端连接，当前为演示模式'] })
    } catch (err) {
      setImportResult({ success: false, message: err.response?.data?.message || '导入失败' })
    }
    e.target.value = ''
  }

  const downloadTemplate = () => {
    const headers = ['姓名', '中文名', '出生日期', '证件号', '护照号', '邮箱', '电话', '住址', '通讯地址', '任职公司', '职位', '任命日期', '状态']
    const example = ['John Smith', '张三', '1980-05-20', 'A123456(7)', '', 'john@example.com', '+852 9876 5432', '', '', 'ABC Limited', '执行董事', '2021-03-15', '在任']
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([headers, example])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Directors')
      XLSX.writeFile(wb, 'directors_template.xlsx')
    })
  }

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v.target.value }))
  const af = (k) => (v) => setApptForm(prev => ({ ...prev, [k]: v.target.value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="董事管理"
        subtitle={`共 ${directors.length} 位董事`}
        icon={Users}
        actions={
          canEdit ? (
            <>
              <button onClick={() => { setImportResult(null); setModal('import') }}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                <Upload size={15} /> Excel 导入
              </button>
              <button onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                <Plus size={15} /> 新增董事
              </button>
            </>
          ) : null
        }
      />

      {/* 搜索 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="搜索姓名、证件号、邮箱..." />
        <button onClick={() => fetchDirectors(search)} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={15} className="text-gray-500" />
        </button>
      </div>

      {/* 董事列表 */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="暂无董事数据" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => (
            <div key={d._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{d.name}</h3>
                  {d.nameChinese && <p className="text-gray-500 text-sm">{d.nameChinese}</p>}
                </div>
                <div className="flex gap-1">
                  {canEdit && <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>}
                  {canDelete && <button onClick={() => { setEditTarget(d); setModal('delete') }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                  {canEdit && <button onClick={() => { setEditTarget(d); setApptForm({ company: '', position: '董事', appointedDate: '', status: '在任' }); setModal('appt') }}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="管理职位"><Building2 size={14} /></button>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {d.email && <div className="flex items-center gap-1.5"><Mail size={12} />{d.email}</div>}
                {d.phone && <div className="flex items-center gap-1.5"><Phone size={12} />{d.phone}</div>}
                {d.idNumber && <div className="flex items-center gap-1.5"><span className="font-mono bg-gray-100 px-1 rounded">{d.idNumber}</span></div>}
              </div>
              {d.appointments && d.appointments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1.5">任职公司（{d.appointments.length}）</p>
                  <div className="flex flex-wrap gap-1">
                    {d.appointments.slice(0, 3).map((a, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${a.status === '在任' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {a.company?.name || '—'} · {a.position}
                      </span>
                    ))}
                    {d.appointments.length > 3 && <span className="text-xs text-gray-400">+{d.appointments.length - 3}更多</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <Modal isOpen={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? `编辑董事：${editTarget?.name}` : '新增董事'} size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm">取消</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        }>
        {/* 从人员库快速选择 */}
        {!editTarget && personnel.length > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <FormField label="从人员库选择（自动填充）">
              <select className={inputClass} value="" onChange={e => {
                if (!e.target.value) return
                const p = personnel.find(x => x._id === e.target.value)
                if (p) {
                  setForm({
                    ...EMPTY_FORM,
                    name: p.name || '', nameChinese: p.nameChinese || '',
                    email: p.email || '', phone: p.phone || '',
                    nationality: p.nationality || '',
                    idNumber: p.nric || '',
                  })
                  setFormErrors({})
                }
              }}>
                <option value="">— 选择人员自动填充 —</option>
                {personnel.map(p => <option key={p._id} value={p._id}>{p.name} {p.nric ? `(${p.nric})` : ''}</option>)}
              </select>
            </FormField>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="英文姓名" required error={formErrors.name}>
            <input className={inputClass} value={form.name} onChange={f('name')} placeholder="John Smith" />
          </FormField>
          <FormField label="中文姓名">
            <input className={inputClass} value={form.nameChinese} onChange={f('nameChinese')} placeholder="张三" />
          </FormField>
          <FormField label="出生日期">
            <input type="date" className={inputClass} value={form.dateOfBirth} onChange={f('dateOfBirth')} />
          </FormField>
          <FormField label="身份证号">
            <input className={inputClass} value={form.idNumber} onChange={f('idNumber')} placeholder="A123456(7)" />
          </FormField>
          <FormField label="护照号">
            <input className={inputClass} value={form.passportNumber} onChange={f('passportNumber')} />
          </FormField>
          <FormField label="国籍">
            <input className={inputClass} value={form.nationality} onChange={f('nationality')} placeholder="中国" />
          </FormField>
          <FormField label="邮箱" error={formErrors.email}>
            <input type="email" className={inputClass} value={form.email} onChange={f('email')} />
          </FormField>
          <FormField label="电话">
            <input className={inputClass} value={form.phone} onChange={f('phone')} placeholder="+852 9876 5432" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="住址">
              <input className={inputClass} value={form.residentialAddress} onChange={f('residentialAddress')} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="通讯地址">
              <input className={inputClass} value={form.correspondenceAddress} onChange={f('correspondenceAddress')} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* 管理职位弹窗 */}
      <Modal isOpen={modal === 'appt'} onClose={() => setModal(null)}
        title={`${editTarget?.name} — 任职公司管理`} size="lg">
        <div className="space-y-4">
          {/* 已有职位 */}
          {editTarget?.appointments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">现有职位</p>
              {editTarget.appointments.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{a.company?.name}</span>
                    <span className="text-gray-500 mx-2">·</span>
                    <span>{a.position}</span>
                    {a.appointedDate && <span className="text-gray-400 ml-2 text-xs">{typeof a.appointedDate === 'string' ? a.appointedDate.slice(0, 10) : new Date(a.appointedDate).toISOString().split('T')[0]}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === '在任' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
          {/* 添加新职位 */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">添加新职位</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FormField label="任职公司" required>
                  <select value={apptForm.company} onChange={af('company')} className={inputClass}>
                    <option value="">— 选择公司 —</option>
                    {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="职位">
                <input value={apptForm.position} onChange={af('position')} className={inputClass} placeholder="执行董事" />
              </FormField>
              <FormField label="任命日期">
                <input type="date" value={apptForm.appointedDate} onChange={af('appointedDate')} className={inputClass} />
              </FormField>
            </div>
            <button onClick={handleAddAppt} disabled={saving} className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              + 添加职位
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <DeleteConfirmModal
        isOpen={modal === 'delete'}
        name={editTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
        loading={saving}
      />

      {/* Excel 导入 */}
      <Modal isOpen={modal === 'import'} onClose={() => setModal(null)} title="Excel 批量导入董事" size="md">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">导入说明</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>必填列：姓名、出生日期、任职公司、任命日期</li>
              <li>同一董事在多家公司任职，需创建多行记录（姓名+出生日期相同）</li>
              <li>任职公司必须已存在于系统中</li>
              <li>以证件号，或姓名+出生日期查重</li>
            </ul>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
            <Download size={16} /> 下载 Excel 模板
          </button>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}>
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 text-sm">点击选择 Excel 文件</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
          {importResult && (
            <div className={`p-4 rounded-lg text-sm ${importResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {importResult.success
                ? <><p className="font-medium">导入完成</p><p>新增 {importResult.created} 条，更新 {importResult.updated} 条</p>
                  {importResult.errors?.length > 0 && <div className="mt-2 text-amber-700"><ul className="list-disc list-inside text-xs">{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}</>
                : <p>{importResult.message}</p>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
