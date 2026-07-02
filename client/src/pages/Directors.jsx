import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { Users, Plus, Search, Pencil, Trash2, Upload, Download, Building2, RefreshCw, Calendar, Mail, Phone } from 'lucide-react'

const DEMO_DIRECTORS = [
  {
    _id: 'd1', name: 'John Smith', nameChinese: '张三', dateOfBirth: '1980-05-20',
    idNumber: 'A123456(7)', email: 'john@example.com', phone: '+852 9876 5432',
    appointments: [
      { _id: 'a1', company: { _id: 'c1', name: 'Acme Holdings Limited' }, position: '执行董事', appointedDate: '2021-03-15', status: '在任' },
      { _id: 'a2', company: { _id: 'c2', name: 'Pacific Trading Corp' }, position: '董事', appointedDate: '2022-06-01', status: '在任' },
    ]
  },
  {
    _id: 'd2', name: 'Mary Johnson', nameChinese: '李梅', dateOfBirth: '1985-08-12',
    idNumber: 'B987654(3)', email: 'mary@example.com', phone: '+852 6543 2198',
    appointments: [
      { _id: 'a3', company: { _id: 'c1', name: 'Acme Holdings Limited' }, position: '独立非执行董事', appointedDate: '2021-03-15', status: '在任' },
    ]
  },
]

const EMPTY_FORM = {
  name: '', nameChinese: '', dateOfBirth: '', idNumber: '', passportNumber: '',
  email: '', phone: '', residentialAddress: '', correspondenceAddress: '', nationality: '',
}

export default function Directors() {
  const { canEdit, canDelete, isDemo } = useAuth()
  const [directors, setDirectors] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modal, setModal] = useState(null) // null | 'new' | 'edit' | 'delete' | 'import' | 'appt'
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [apptForm, setApptForm] = useState({ company: '', position: '董事', appointedDate: '', status: '在任' })
  const [saving, setSaving] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef()

  useEffect(() => {
    fetchDirectors()
    fetchCompanies()
  }, [])

  const fetchDirectors = async () => {
    setLoading(true)
    try {
      const res = await api.get('/directors')
      setDirectors(res.directors || [])
    } catch {
      setDirectors(DEMO_DIRECTORS)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies')
      setCompanies(res.companies || [])
    } catch { setCompanies([]) }
  }

  const filtered = directors.filter(d => {
    const q = search.toLowerCase()
    return !q || [d.name, d.nameChinese, d.idNumber, d.email].some(f => f && f.toLowerCase().includes(q))
  })

  const openNew = () => { setForm(EMPTY_FORM); setEditTarget(null); setModal('new') }
  const openEdit = (d) => {
    setForm({
      name: d.name || '', nameChinese: d.nameChinese || '',
      dateOfBirth: d.dateOfBirth ? d.dateOfBirth.slice(0, 10) : '',
      idNumber: d.idNumber || '', passportNumber: d.passportNumber || '',
      email: d.email || '', phone: d.phone || '',
      residentialAddress: d.residentialAddress || '',
      correspondenceAddress: d.correspondenceAddress || '',
      nationality: d.nationality || '',
    })
    setEditTarget(d)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name) return alert('姓名不能为空')
    setSaving(true)
    try {
      if (isDemo) {
        const data = { ...form, _id: editTarget?._id || `demo-${Date.now()}`, appointments: editTarget?.appointments || [] }
        if (editTarget) setDirectors(ds => ds.map(d => d._id === editTarget._id ? data : d))
        else setDirectors(ds => [data, ...ds])
      } else {
        if (editTarget) {
          const res = await api.put(`/directors/${editTarget._id}`, form)
          setDirectors(ds => ds.map(d => d._id === editTarget._id ? res.director : d))
        } else {
          const res = await api.post('/directors', form)
          setDirectors(ds => [res.director, ...ds])
        }
      }
      setModal(null)
    } catch (err) {
      alert(err.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      if (!isDemo) await api.delete(`/directors/${editTarget._id}`)
      setDirectors(ds => ds.filter(d => d._id !== editTarget._id))
      setModal(null)
    } catch (err) {
      alert(err.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAppt = async () => {
    if (!apptForm.company) return alert('请选择公司')
    setSaving(true)
    try {
      if (!isDemo) {
        const res = await api.post(`/directors/${editTarget._id}/appointments`, apptForm)
        setDirectors(ds => ds.map(d => d._id === editTarget._id ? res.director : d))
      } else {
        const co = companies.find(c => c._id === apptForm.company)
        const updated = {
          ...editTarget,
          appointments: [...(editTarget.appointments || []), { ...apptForm, _id: `a${Date.now()}`, company: co || { _id: apptForm.company, name: '未知' } }]
        }
        setDirectors(ds => ds.map(d => d._id === editTarget._id ? updated : d))
        setEditTarget(updated)
      }
      setApptForm({ company: '', position: '董事', appointedDate: '', status: '在任' })
    } catch (err) {
      alert(err.response?.data?.message || '添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImportResult(null)
    const formData = new FormData(); formData.append('file', file)
    try {
      const res = await api.post('/directors/import/excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult(res); fetchDirectors()
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-primary-600" size={28} /> 董事管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">共 {directors.length} 位董事</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
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
          )}
        </div>
      </div>

      {/* 搜索 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索姓名、证件号、邮箱..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <button onClick={fetchDirectors} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={15} className="text-gray-500" />
        </button>
      </div>

      {/* 董事列表 */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无董事数据</p>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['name', '英文姓名 *', 'text', 'John Smith'],
            ['nameChinese', '中文姓名', 'text', '张三'],
            ['dateOfBirth', '出生日期', 'date', ''],
            ['idNumber', '身份证号', 'text', 'A123456(7)'],
            ['passportNumber', '护照号', 'text', ''],
            ['nationality', '国籍', 'text', '中国'],
            ['email', '邮箱', 'email', ''],
            ['phone', '电话', 'text', '+852 9876 5432'],
            ['residentialAddress', '住址', 'text', ''],
            ['correspondenceAddress', '通讯地址', 'text', ''],
          ].map(([key, label, type, ph]) => (
            <div key={key} className={key.includes('Address') ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={f(key)}
                placeholder={ph}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          ))}
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
                    {a.appointedDate && <span className="text-gray-400 ml-2 text-xs">{a.appointedDate?.slice(0, 10)}</span>}
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
                <label className="block text-xs font-medium text-gray-600 mb-1">任职公司 *</label>
                <select value={apptForm.company} onChange={af('company')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                  <option value="">— 选择公司 —</option>
                  {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">职位</label>
                <input value={apptForm.position} onChange={af('position')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="执行董事" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">任命日期</label>
                <input type="date" value={apptForm.appointedDate} onChange={af('appointedDate')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
            <button onClick={handleAddAppt} disabled={saving} className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              + 添加职位
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="确认删除" size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm">取消</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50">
              {saving ? '删除中...' : '确认删除'}
            </button>
          </div>
        }>
        <p className="text-gray-600">确定要删除董事 <strong>{editTarget?.name}</strong> 吗？</p>
      </Modal>

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
