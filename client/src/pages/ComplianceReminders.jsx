import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import api from '../services/api'
import Modal from '../components/Modal'
import {
  Bell, Plus, Search, Filter, CheckCircle2, Clock,
  AlertTriangle, Trash2, Pencil, RefreshCw, X, ChevronDown
} from 'lucide-react'

const STATUSES = ['待办', '处理中', '已完成', '已忽略']
const PRIORITIES = ['低', '中', '高', '紧急']
const CATEGORIES = ['周年申报', '税务申报', '合规报告', '董事变更', '股份变更', '会议召开', '其他']

const priorityColor = (p) => ({
  '紧急': 'bg-red-100 text-red-700 border-red-200',
  '高': 'bg-orange-100 text-orange-700 border-orange-200',
  '中': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '低': 'bg-gray-100 text-gray-600 border-gray-200',
}[p] || 'bg-gray-100 text-gray-600 border-gray-200')

const statusColor = (s) => ({
  '待办': 'bg-blue-100 text-blue-700',
  '处理中': 'bg-yellow-100 text-yellow-700',
  '已完成': 'bg-green-100 text-green-700',
  '已忽略': 'bg-gray-100 text-gray-500',
}[s] || 'bg-gray-100 text-gray-600')

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const lbl = 'block text-sm font-medium text-gray-700 mb-1'

const ReminderForm = ({ initial = {}, onSave, onCancel, loading, companies }) => {
  const [form, setForm] = useState({
    title: initial.title || '',
    category: initial.category || '其他',
    priority: initial.priority || '中',
    status: initial.status || '待办',
    dueDate: initial.dueDate ? format(new Date(initial.dueDate), 'yyyy-MM-dd') : '',
    company: initial.company?._id || initial.company || '',
    notes: initial.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className={lbl}>提醒标题 <span className="text-red-500">*</span></label>
        <input required className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="年度申报提醒" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>类别</label>
          <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>优先级</label>
          <select className={inp} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>状态</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>截止日期 <span className="text-red-500">*</span></label>
          <input required type="date" className={inp} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>关联公司</label>
          <select className={inp} value={form.company} onChange={e => set('company', e.target.value)}>
            <option value="">-- 不关联公司 --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}{c.nameChinese ? ` / ${c.nameChinese}` : ''}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>备注</label>
        <textarea rows={3} className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="其他说明..." />
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

const CompleteModal = ({ reminder, onConfirm, onCancel, loading }) => {
  const [notes, setNotes] = useState('')
  return (
    <div className="space-y-4">
      <p className="text-gray-600">确认将 <strong>{reminder?.title}</strong> 标记为已完成？</p>
      <div>
        <label className={lbl}>完成备注（可选）</label>
        <textarea rows={3} className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="填写完成情况..." />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
        <button onClick={() => onConfirm(notes)} disabled={loading} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
          {loading ? '处理中...' : '确认完成'}
        </button>
      </div>
    </div>
  )
}

const ComplianceReminders = () => {
  const [reminders, setReminders] = useState([])
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [modal, setModal] = useState(null) // null | 'new' | 'edit' | 'delete' | 'complete'
  const [editTarget, setEditTarget] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [filterStatus, filterPriority, filterOverdue])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterPriority) params.priority = filterPriority
      if (filterOverdue) params.overdue = 'true'
      const [remRes, statsRes, compRes] = await Promise.all([
        api.get('/compliance-reminders', { params }),
        api.get('/compliance-reminders/stats/summary').catch(() => null),
        api.get('/companies').catch(() => ({ companies: [] })),
      ])
      setReminders(remRes.reminders || [])
      if (statsRes) setStats(statsRes.stats)
      setCompanies(compRes.companies || [])
    } catch {
      setReminders(DEMO_REMINDERS)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => { setEditTarget(null); setError(''); setModal('new') }
  const openEdit = (r) => { setEditTarget(r); setError(''); setModal('edit') }

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const res = await api.put(`/compliance-reminders/${editTarget._id}`, data)
        setReminders(rs => rs.map(r => r._id === editTarget._id ? (res.reminder || { ...r, ...data }) : r))
      } else {
        const res = await api.post('/compliance-reminders', data)
        setReminders(rs => [res.reminder || { _id: Date.now().toString(), ...data }, ...rs])
      }
      setModal(null)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async (notes) => {
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await api.post(`/compliance-reminders/${editTarget._id}/complete`, { notes })
      setReminders(rs => rs.map(r => r._id === editTarget._id ? (res.reminder || { ...r, status: '已完成' }) : r))
      setModal(null)
      fetchAll()
    } catch (e) {
      alert(e.response?.data?.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await api.delete(`/compliance-reminders/${editTarget._id}`)
      setReminders(rs => rs.filter(r => r._id !== editTarget._id))
      setModal(null)
      fetchAll()
    } catch (e) {
      alert(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const filtered = reminders.filter(r => {
    const q = search.toLowerCase()
    return !q || r.title?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
  })

  const getDaysRemaining = (dueDate) => Math.ceil((new Date(dueDate) - new Date()) / 86400000)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="text-primary-600" size={26} />
            合规提醒
          </h1>
          <p className="text-gray-500 text-sm mt-1">跟踪所有合规截止日期与待办事项</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus size={15} /> 新增提醒
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '全部', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: '待办', value: stats.pending, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: '已逾期', value: stats.overdue, color: 'text-red-700', bg: 'bg-red-50' },
            { label: '紧急', value: stats.urgent, color: 'text-orange-700', bg: 'bg-orange-50' },
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
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索提醒标题、类别..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部状态</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部优先级</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={filterOverdue} onChange={e => setFilterOverdue(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600" />
            仅显示逾期
          </label>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无合规提醒</p>
          <button onClick={openNew} className="mt-4 text-primary-600 hover:underline text-sm">+ 新增提醒</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const days = r.dueDate ? getDaysRemaining(r.dueDate) : null
            const isOverdue = r.status !== '已完成' && r.status !== '已忽略' && days !== null && days < 0
            return (
              <div key={r._id} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className={`font-semibold ${isOverdue ? 'text-red-700' : r.status === '已完成' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {r.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${priorityColor(r.priority)}`}>{r.priority}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                      {r.category && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.category}</span>}
                      {r.company && <span className="text-gray-600">{r.company.name || r.company}</span>}
                      {r.dueDate && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : days <= 7 ? 'text-orange-600' : ''}`}>
                          <Clock size={13} />
                          截止：{format(new Date(r.dueDate), 'yyyy-MM-dd')}
                          {days !== null && ` (${isOverdue ? `逾期${Math.abs(days)}天` : days === 0 ? '今天到期' : `剩余${days}天`})`}
                        </span>
                      )}
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-1">{r.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.status !== '已完成' && r.status !== '已忽略' && (
                      <button onClick={() => { setEditTarget(r); setModal('complete') }}
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

      {/* 标记完成 Modal */}
      <Modal isOpen={modal === 'complete'} onClose={() => setModal(null)} title="标记为已完成" size="sm">
        <CompleteModal reminder={editTarget} onConfirm={handleComplete} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* 删除确认 Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="确认删除" size="sm">
        <p className="text-gray-600 mb-6">确定删除提醒 <strong>{editTarget?.title}</strong>？此操作不可撤销。</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
          <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
            {saving ? '删除中...' : '确认删除'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

const DEMO_REMINDERS = [
  { _id: 'r1', title: 'Acme Holdings 年度申报', category: '周年申报', priority: '高', status: '待办', dueDate: '2026-07-15', company: { name: 'Acme Holdings Limited' }, notes: '需提前准备财务报表' },
  { _id: 'r2', title: 'Pacific Trading 税务申报', category: '税务申报', priority: '紧急', status: '待办', dueDate: '2026-06-30', company: { name: 'Pacific Trading Corp' } },
  { _id: 'r3', title: 'Global Ventures 董事变更通知', category: '董事变更', priority: '中', status: '处理中', dueDate: '2026-08-01', company: { name: 'Global Ventures Ltd' } },
  { _id: 'r4', title: 'Acme Holdings 周年大会召开', category: '会议召开', priority: '高', status: '已完成', dueDate: '2026-05-10', company: { name: 'Acme Holdings Limited' } },
]

export default ComplianceReminders
