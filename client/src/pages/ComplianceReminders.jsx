import React, { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Bell, Plus, RefreshCw,
  CheckCircle2, Clock,
  Pencil, Trash2
} from 'lucide-react'
import { complianceReminderService, companyService, documentService } from '../services/index.js'
import { fmtDateShort } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField, compliancePriorityColor, complianceStatusColor, CompleteWithAttachmentModal } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import Modal from '../components/Modal'

const STATUSES_API = [
  { value: 'upcoming', label: '即将到期' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'expired', label: '已过期' },
]

const PRIORITIES_API = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
]

const STATUS_DISPLAY = { upcoming: '即将到期', active: '进行中', completed: '已完成', expired: '已过期' }
const PRIORITY_DISPLAY = { low: '低', medium: '中', high: '高', critical: '紧急' }


const ReminderForm = ({ initial = {}, onSave, onCancel, loading, companies }) => {
  const [form, setForm] = useState({
    title: initial.title || '',
    category: initial.category || '周年申报',
    priority: initial.priority || 'medium',
    status: initial.status || 'upcoming',
    dueDate: initial.dueDate ? (typeof initial.dueDate === 'string' ? initial.dueDate.slice(0, 10) : fmtDateShort(initial.dueDate)) : '',
    companyId: initial.company?._id || initial.company || '',
    notes: initial.notes || '',
    completed: initial.completed || false,
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, {
      title: [required('请输入提醒标题')],
      dueDate: [required('请选择截止日期')],
    })
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    const payload = {
      title: form.title,
      category: form.category,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate,
      completed: form.completed,
      notes: form.notes,
    }
    if (form.companyId) {
      const co = companies.find(c => c._id === form.companyId)
      if (co) {
        payload.company = { _id: co._id, name: co.name, registrationNumber: co.registrationNumber }
      }
    }
    onSave(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="提醒标题" required error={errors.title}>
        <input className={inputClass} value={form.title} onChange={e => { set('title', e.target.value); setErrors(e => ({ ...e, title: '' })) }} placeholder="年度申报提醒" />
      </FormField>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>类别</label>
          <select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)}>
            <option>周年申报</option>
            <option>税务申报</option>
            <option>合规报告</option>
            <option>董事变更</option>
            <option>股份变更</option>
            <option>会议召开</option>
            <option>其他</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>优先级</label>
          <select className={inputClass} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES_API.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>状态</label>
          <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES_API.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <FormField label="截止日期" required error={errors.dueDate}>
          <input type="date" className={inputClass} value={form.dueDate} onChange={e => { set('dueDate', e.target.value); setErrors(e => ({ ...e, dueDate: '' })) }} />
        </FormField>
        <div className="md:col-span-2">
          <label className={labelClass}>关联公司</label>
          <select className={inputClass} value={form.companyId} onChange={e => set('companyId', e.target.value)}>
            <option value="">-- 不关联 --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}{c.nameChinese ? ` / ${c.nameChinese}` : ''}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>备注</label>
        <textarea rows={3} className={inputClass} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="其他说明..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}

const ComplianceReminders = () => {
  const [reminders, setReminders] = useState([])
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [completeModal, setCompleteModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const fileInputRef = React.useRef(null)
  const [error, setError] = useState('')

  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    reminders,
    (r, q, f) => {
      const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
      const matchStatus = !f.status || r.status === f.status
      const matchPriority = !f.priority || r.priority === f.priority
      return matchSearch && matchStatus && matchPriority
    },
    { status: '', priority: '' }
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [remRes, statsRes] = await Promise.all([
        complianceReminderService.getAll().catch(() => ({ data: { data: [] } })),
        complianceReminderService.getStatistics().catch(() => null),
      ])
      const { data: remData } = remRes
      setReminders(remData?.data || [])

      if (statsRes?.data?.data) {
        const s = statsRes.data.data
        setStats({
          total: s.total || 0,
          pending: s.upcoming || 0,
          overdue: s.overdue || s.expired || 0,
          completed: s.completed || 0,
        })
      }

      try {
        const { data: coRes } = await companyService.getAll()
        setCompanies(coRes.data || [])
      } catch { /* silent */ }
    } catch {
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openNew = () => { setEditTarget(null); setError(''); setModal('new') }
  const openEdit = (r) => { setEditTarget(r); setError(''); setModal('edit') }

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const { data: resData } = await complianceReminderService.update(editTarget._id, data)
        setReminders(rs => rs.map(r => r._id === editTarget._id ? (resData.data || { ...r, ...data }) : r))
      } else {
        const { data: resData } = await complianceReminderService.create(data)
        setReminders(rs => [resData.data || { _id: Date.now().toString(), ...data }, ...rs])
      }
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      // 1. 如果有附件，先上传归档到公司文档
      if (uploadFile) {
        const companyId = editTarget.company?._id || editTarget.company || ''
        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('name', `[完成] ${editTarget.title} - ${uploadFile.name}`)
        formData.append('type', 'other')
        formData.append('category', '合规归档')
        formData.append('description', noteText.trim() || `${editTarget.title} 完成归档`)
        if (companyId) formData.append('company', companyId)
        try {
          await documentService.upload(formData)
          toast.success('附件已归档到公司文档')
        } catch (uploadErr) {
          console.error('文件上传失败:', uploadErr)
          toast.error('附件上传失败，但任务已完成')
        }
      }

      // 2. 更新提醒状态为已完成
      const notes = Array.isArray(editTarget.notes) ? editTarget.notes : []
      const payload = { notes: [...notes, { content: noteText, createdAt: new Date().toISOString() }], status: 'completed', completed: true }
      const { data: resData } = await complianceReminderService.update(editTarget._id, payload)
      setReminders(rs => rs.map(r => r._id === editTarget._id ? (resData.data || { ...r, ...payload }) : r))
      toast.success('已标记为完成')
    } catch (e) {
      toast.error(e.response?.data?.message || '操作失败')
    } finally {
      setSaving(false)
      setCompleteModal(false)
      setNoteText('')
      setUploadFile(null)
    }
  }

  const handleQuickComplete = async (r) => {
    setEditTarget(r)
    setNoteText('')
    setCompleteModal(true)
  }

  const handleDelete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await complianceReminderService.delete(editTarget._id)
      setReminders(rs => rs.filter(r => r._id !== editTarget._id))
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const getDaysRemaining = useCallback((dueDate) => Math.ceil((new Date(dueDate) - new Date()) / 86400000), [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="合规提醒"
        subtitle="跟踪所有合规截止日期与待办事项"
        icon={Bell}
        actions={
          <>
            <button onClick={fetchAll} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
              <RefreshCw size={15} />
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={15} /> 新增提醒
            </button>
          </>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '全部', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: '即将到期', value: stats.pending, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: '已逾期', value: stats.overdue, color: 'text-red-700', bg: 'bg-red-50' },
            { label: '已完成', value: stats.completed, color: 'text-green-700', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索提醒标题、类别..." />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部状态</option>
            {STATUSES_API.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部优先级</option>
            {PRIORITIES_API.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Bell} title="暂无合规提醒" action={<button onClick={openNew} className="mt-4 text-primary-600 hover:underline text-sm">+ 新增提醒</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const days = r.dueDate ? getDaysRemaining(r.dueDate) : null
            const isOverdue = r.status !== 'completed' && days !== null && days < 0
            return (
              <div key={r._id} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className={`font-semibold ${isOverdue ? 'text-red-700' : r.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {r.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${compliancePriorityColor(r.priority)}`}>{PRIORITY_DISPLAY[r.priority] || r.priority}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${complianceStatusColor(r.status)}`}>{STATUS_DISPLAY[r.status] || r.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                      {r.category && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.category}</span>}
                      {r.company && <span className="text-gray-600">{r.company.name || r.company}</span>}
                      {r.dueDate && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : days <= 7 ? 'text-orange-600' : ''}`}>
                          <Clock size={13} />
                          截止：{fmtDateShort(r.dueDate)}
                          {days !== null && ` (${isOverdue ? `逾期${Math.abs(days)}天` : days === 0 ? '今天到期' : `剩余${days}天`})`}
                        </span>
                      )}
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-1">{r.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.status !== 'completed' && r.status !== 'expired' && (
                      <button onClick={() => handleQuickComplete(r)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="标记完成">
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { setEditTarget(r); setModal('delete') }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
        title={modal === 'edit' ? '编辑提醒' : '新增合规提醒'} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <ReminderForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} companies={companies} />
      </Modal>

      {/* 标记完成 Modal — 备注或附件二选一 */}
      <CompleteWithAttachmentModal
        isOpen={completeModal}
        onClose={() => { setCompleteModal(false); setUploadFile(null) }}
        title="标记为已完成"
        warningText="合规提醒必须填写备注或上传附件才能标记完成"
        noteText={noteText}
        onNoteChange={setNoteText}
        uploadFile={uploadFile}
        onFileChange={(f) => setUploadFile(f)}
        onFileRemove={() => setUploadFile(null)}
        onConfirm={handleComplete}
        saving={saving}
        fileInputRef={fileInputRef}
      />

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

export default ComplianceReminders
