import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  PenLine, Plus, RefreshCw,
  CheckCircle2, Clock, XCircle, Pencil, Trash2,
  User, FileText, Building2
} from 'lucide-react'
import { signTaskService, companyService, documentService } from '../services/index.js'
import { fmtDateShort, fmtDateTimeShort } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import Modal from '../components/Modal'

const SIGN_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'expired']
const STATUS_LABELS = { pending: '待签署', in_progress: '签署中', completed: '已完成', cancelled: '已取消', expired: '已过期' }
const STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
}

const SIGN_TASK_RULES = {
  title: [required('签署任务标题为必填')],
}

const emptySignerRow = () => ({ name: '', email: '', role: '' })

const SignTaskForm = ({ initial = {}, onSave, onCancel, loading, documents, companies }) => {
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    documentId: initial.document?._id || initial.document || '',
    companyId: initial.company?._id || initial.company || '',
    dueDate: initial.dueDate ? fmtDateShort(initial.dueDate) : '',
    signers: initial.signers?.length
      ? initial.signers.map(s => ({ name: s.name || '', email: s.email || '', role: s.role || '' }))
      : [emptySignerRow()],
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const setSigner = (i, k, v) => {
    const s = [...form.signers]
    s[i] = { ...s[i], [k]: v }
    set('signers', s)
  }
  const addSigner = () => set('signers', [...form.signers, emptySignerRow()])
  const removeSigner = (i) => set('signers', form.signers.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, SIGN_TASK_RULES)
    // 验证签署人：至少一位签署人需填写姓名
    const validSigners = form.signers.filter(s => s.name?.trim() || s.email?.trim())
    if (!valid) { setErrors({ ...vErrors, signers: validSigners.length === 0 ? '至少需要一位签署人' : '' }); return }
    if (validSigners.length === 0) { setErrors({ ...vErrors, signers: '至少需要一位签署人' }); return }
    setErrors({})
    onSave({
      ...form,
      document: form.documentId || undefined,
      company: form.companyId || undefined,
      signers: validSigners,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="任务标题" required error={errors.title}>
        <input className={inputClass} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Q1 董事会决议签署" />
      </FormField>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>关联文档</label>
          <select className={inputClass} value={form.documentId} onChange={e => set('documentId', e.target.value)}>
            <option value="">-- 不关联 --</option>
            {documents.map(d => <option key={d._id} value={d._id}>{d.name || d.title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>关联公司</label>
          <select className={inputClass} value={form.companyId} onChange={e => set('companyId', e.target.value)}>
            <option value="">-- 不关联 --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>截止日期</label>
          <input type="date" className={inputClass} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>描述</label>
        <textarea rows={2} className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} placeholder="签署说明..." />
      </div>

      {/* Signers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass + ' mb-0'}>签署人列表</label>
          <button type="button" onClick={addSigner} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            <Plus size={13} /> 添加签署人
          </button>
        </div>
        {errors.signers && <p className="text-xs text-red-500 mt-1">{errors.signers}</p>}
        <div className="space-y-2">
          {form.signers.map((s, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="mt-2.5 text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
              <input className={inputClass + ' flex-1'} value={s.name} onChange={e => setSigner(i, 'name', e.target.value)} placeholder="姓名" />
              <input className={inputClass + ' flex-1'} type="email" value={s.email} onChange={e => setSigner(i, 'email', e.target.value)} placeholder="邮箱" />
              <input className={inputClass + ' w-28'} value={s.role} onChange={e => setSigner(i, 'role', e.target.value)} placeholder="职位" />
              {form.signers.length > 1 && (
                <button type="button" onClick={() => removeSigner(i)} className="mt-2.5 text-gray-400 hover:text-red-500 shrink-0">
                  <XCircle size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '保存中...' : '创建签署任务'}
        </button>
      </div>
    </form>
  )
}

const SignTasks = () => {
  const [tasks, setTasks] = useState([])
  const [documents, setDocuments] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [error, setError] = useState('')

  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    tasks,
    (t, q, f) => {
      const matchSearch = !q || t.title?.toLowerCase().includes(q)
      const matchStatus = !f.status || t.status === f.status
      return matchSearch && matchStatus
    },
    { status: '' }
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, docsRes, compRes] = await Promise.all([
        signTaskService.getAll().catch(() => ({ data: { data: [] } })),
        documentService.getAll().catch(() => ({ data: { data: [] } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setTasks(tasksRes.data?.data || [])
      setDocuments(docsRes.data?.data || [])
      setCompanies(compRes.data?.data || [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const { data: resData } = await signTaskService.update(editTarget._id, data)
        setTasks(ts => ts.map(t => t._id === editTarget._id ? (resData.data || { ...t, ...data }) : t))
      } else {
        const { data: resData } = await signTaskService.create(data)
        setTasks(ts => [resData.data || { _id: Date.now().toString(), ...data, status: 'pending' }, ...ts])
      }
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await signTaskService.delete(editTarget._id)
      setTasks(ts => ts.filter(t => t._id !== editTarget._id))
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSignNow = async () => {
    if (!detailTarget) return
    setSaving(true)
    try {
      const { data: resData } = await signTaskService.sign(detailTarget._id, detailTarget.signers?.[0]?._id)
      setTasks(ts => ts.map(t => t._id === detailTarget._id ? (resData.data || t) : t))
      setDetailTarget(resData.data || detailTarget)
      fetchAll()
    } catch (e) {
      toast.error(e.response?.data?.message || '签署失败')
    } finally {
      setSaving(false)
    }
  }

  const getSignedCount = (task) => task.signers?.filter(s => s.status === 'signed').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="电子签署"
        subtitle="管理文件签署任务与签署状态"
        icon={PenLine}
        actions={
          <>
            <button onClick={fetchAll} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => { setEditTarget(null); setError(''); setModal('new') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={15} /> 新建签署任务
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索签署任务..." />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部状态</option>
            {SIGN_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={PenLine} title="暂无签署任务" action={
          <button onClick={() => { setEditTarget(null); setError(''); setModal('new') }} className="mt-4 text-primary-600 hover:underline text-sm">+ 新建签署任务</button>
        } />
      ) : (
        <div className="space-y-4">
          {filtered.map(task => {
            const signed = getSignedCount(task)
            const total = task.signers?.length || 0
            const progress = total > 0 ? Math.round((signed / total) * 100) : 0
            return (
              <div key={task._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                      {(task.document || task.relatedMeeting || task.template) && (
                        <span className="flex items-center gap-1">
                          <FileText size={12} /> {task.template?.name || task.document?.title || task.relatedMeeting?.title || '-'}
                        </span>
                      )}
                      {task.relatedCompany || task.company ? (
                        <span className="flex items-center gap-1">
                          <Building2 size={12} /> {task.relatedCompany?.name || task.company?.name || '-'}
                        </span>
                      ) : null}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> 截止：{fmtDateShort(task.dueDate)}
                        </span>
                      )}
                    </div>

                    {/* 签署进度 */}
                    {total > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>签署进度</span>
                          <span>{signed} / {total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${task.status === 'completed' ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {task.signers.slice(0, 3).map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              {s.status === 'signed'
                                ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                : <Clock size={16} className="text-gray-400 shrink-0" />}
                              <span className="text-gray-700">{s.name || s.email || '待填写'}</span>
                              {s.role && <span className="text-xs text-gray-400">({s.role})</span>}
                              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${s.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {s.status === 'signed' ? '已签' : '待签'}
                              </span>
                            </div>
                          ))}
                          {task.signers.length > 3 && (
                            <button onClick={() => { setDetailTarget(task); setModal('detail') }}
                              className="text-xs text-primary-600 hover:underline">
                              查看全部 {task.signers.length} 位签署人
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setDetailTarget(task); setModal('detail') }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="查看详情">
                      <User size={15} />
                    </button>
                    <button onClick={() => { setEditTarget(task); setError(''); setModal('edit') }}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { setEditTarget(task); setModal('delete') }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新增/编辑 Modal */}
      <Modal isOpen={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? '编辑签署任务' : '新建签署任务'} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <SignTaskForm
          initial={editTarget || {}}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          loading={saving}
          documents={documents}
          companies={companies}
        />
      </Modal>

      {/* 详情 Modal */}
      <Modal isOpen={modal === 'detail'} onClose={() => setModal(null)} title={`签署详情：${detailTarget?.title}`} size="md">
        {detailTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">状态：</span>
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[detailTarget.status]}`}>
                  {STATUS_LABELS[detailTarget.status]}
                </span>
              </div>
              {detailTarget.dueDate && <div className="text-gray-600">截止：{fmtDateShort(detailTarget.dueDate)}</div>}
            </div>
            {detailTarget.description && <p className="text-sm text-gray-600">{detailTarget.description}</p>}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">签署人列表：</p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {detailTarget.signers?.map((s, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      {s.status === 'signed'
                        ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        : <Clock size={16} className="text-gray-400 shrink-0" />}
                      <span className="text-gray-700">{s.name || s.email || '待填写'}</span>
                      {s.role && <span className="text-xs text-gray-400">({s.role})</span>}
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${s.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.status === 'signed' ? '已签' : '待签'}
                      </span>
                    </div>
                    {s.signedAt && <p className="text-xs text-gray-400 ml-6 mt-0.5">签署于 {fmtDateTimeShort(s.signedAt)}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">关闭</button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认 Modal */}
      <DeleteConfirmModal
        isOpen={modal === 'delete'}
        name={editTarget?.title}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
        loading={saving}
      />
    </div>
  )
}

export default SignTasks
