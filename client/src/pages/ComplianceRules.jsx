import { useEffect, useState } from 'react'
import api from '../services/api'
import Modal from '../components/Modal'
import {
  ShieldCheck, Plus, Search, RefreshCw, Zap,
  Pencil, Trash2, ChevronRight, CheckCircle2, Building2, AlertCircle
} from 'lucide-react'

const JURISDICTIONS = ['香港', 'BVI', '开曼', '新加坡', '其他']
const CATEGORIES = ['周年申报', '税务申报', '合规报告', '董事变更', '股份变更', '会议召开', '其他']
const FREQ = ['一次性', '每月', '每季度', '每半年', '每年']

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const lbl = 'block text-sm font-medium text-gray-700 mb-1'

const RuleForm = ({ initial = {}, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    ruleName: initial.ruleName || '',
    ruleId: initial.ruleId || '',
    category: initial.category || '其他',
    jurisdiction: initial.jurisdiction || '香港',
    isListedOnly: initial.isListedOnly || false,
    frequency: initial.frequency || '每年',
    daysBefore: initial.daysBefore || 30,
    description: initial.description || '',
    status: initial.status || 'active',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>规则名称 <span className="text-red-500">*</span></label>
          <input required className={inp} value={form.ruleName} onChange={e => set('ruleName', e.target.value)} placeholder="年度申报规则" />
        </div>
        <div>
          <label className={lbl}>规则编号</label>
          <input className={inp} value={form.ruleId} onChange={e => set('ruleId', e.target.value)} placeholder="HK-001" />
        </div>
        <div>
          <label className={lbl}>注册地</label>
          <select className={inp} value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)}>
            {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>类别</label>
          <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>频率</label>
          <select className={inp} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQ.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>提前提醒天数</label>
          <input type="number" min={1} max={365} className={inp} value={form.daysBefore} onChange={e => set('daysBefore', Number(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>状态</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isListedOnly} onChange={e => set('isListedOnly', e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
            仅适用于上市公司
          </label>
        </div>
      </div>
      <div>
        <label className={lbl}>规则描述</label>
        <textarea rows={3} className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="详细说明此合规规则的要求..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '保存中...' : '保存规则'}
        </button>
      </div>
    </form>
  )
}

const GenerateModal = ({ rule, companies, onConfirm, onCancel, loading }) => {
  const [selected, setSelected] = useState([])
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">为 <strong>{rule?.ruleName}</strong> 选择要生成提醒的公司：</p>
      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {companies.length === 0 ? (
          <p className="text-center py-6 text-gray-400 text-sm">暂无公司数据</p>
        ) : companies.map(c => (
          <label key={c._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggle(c._id)} className="w-4 h-4 rounded text-primary-600" />
            <span className="text-sm text-gray-900">{c.name}</span>
            {c.nameChinese && <span className="text-xs text-gray-400">{c.nameChinese}</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
        <button onClick={() => onConfirm(selected)} disabled={loading || selected.length === 0} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '生成中...' : `生成提醒（已选 ${selected.length} 家）`}
        </button>
      </div>
    </div>
  )
}

const jurisdictionColor = (j) => ({
  '香港': 'bg-blue-100 text-blue-700',
  'BVI': 'bg-purple-100 text-purple-700',
  '开曼': 'bg-indigo-100 text-indigo-700',
  '新加坡': 'bg-teal-100 text-teal-700',
}[j] || 'bg-gray-100 text-gray-600')

const ComplianceRules = () => {
  const [rules, setRules] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterJurisdiction, setFilterJurisdiction] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [error, setError] = useState('')
  const [genResult, setGenResult] = useState(null)

  useEffect(() => { fetchAll() }, [filterJurisdiction, filterStatus])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterJurisdiction) params.jurisdiction = filterJurisdiction
      if (filterStatus) params.status = filterStatus
      const [rulesRes, compRes] = await Promise.all([
        api.get('/compliance-rules', { params }),
        api.get('/companies').catch(() => ({ companies: [] })),
      ])
      setRules(rulesRes.rules || [])
      setCompanies(compRes.companies || [])
    } catch {
      setRules(DEMO_RULES)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    if (!confirm('初始化将加载17条预设合规规则，确定继续？')) return
    setSaving(true)
    try {
      await api.post('/compliance-rules/initialize')
      alert('预设规则初始化完成！')
      fetchAll()
    } catch (e) {
      alert(e.response?.data?.message || '初始化失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const res = await api.put(`/compliance-rules/${editTarget._id}`, data)
        setRules(rs => rs.map(r => r._id === editTarget._id ? (res.rule || { ...r, ...data }) : r))
      } else {
        const res = await api.post('/compliance-rules', data)
        setRules(rs => [res.rule || { _id: Date.now().toString(), ...data }, ...rs])
      }
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async (companyIds) => {
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await api.post(`/compliance-rules/${editTarget._id}/generate`, { companyIds })
      setGenResult({ success: true, message: `成功生成 ${res.created || 0} 条提醒，跳过 ${res.skipped || 0} 条` })
      setTimeout(() => { setModal(null); setGenResult(null) }, 2500)
    } catch (e) {
      setGenResult({ success: false, message: e.response?.data?.message || '生成失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await api.delete(`/compliance-rules/${editTarget._id}`)
      setRules(rs => rs.filter(r => r._id !== editTarget._id))
      setModal(null)
    } catch (e) {
      alert(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const filtered = rules.filter(r => {
    const q = search.toLowerCase()
    return !q || r.ruleName?.toLowerCase().includes(q) || r.ruleId?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-primary-600" size={26} />
            合规规则
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理合规规则并生成自动提醒</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleInitialize} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Zap size={15} /> 初始化预设规则
          </button>
          <button onClick={() => { setEditTarget(null); setError(''); setModal('new') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus size={15} /> 新建规则
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索规则名称、编号..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <select value={filterJurisdiction} onChange={e => setFilterJurisdiction(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部注册地</option>
            {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
          <button onClick={fetchAll} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheck size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无合规规则</p>
          <button onClick={handleInitialize} className="mt-4 text-primary-600 hover:underline text-sm">点击初始化预设规则</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">规则</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">注册地</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium hidden lg:table-cell">频率</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium hidden lg:table-cell">提前天数</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">状态</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(rule => (
                <tr key={rule._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {rule.ruleName}
                      {rule.isPreset && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-normal">预设</span>}
                      {rule.isListedOnly && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-normal">上市</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                      {rule.ruleId && <span className="font-mono">{rule.ruleId}</span>}
                      {rule.category && <span>{rule.category}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${jurisdictionColor(rule.jurisdiction)}`}>
                      {rule.jurisdiction || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{rule.frequency || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{rule.daysBefore ? `${rule.daysBefore} 天` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rule.status === 'active' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditTarget(rule); setGenResult(null); setModal('generate') }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="生成提醒">
                        <Zap size={15} />
                      </button>
                      <button onClick={() => { setEditTarget(rule); setError(''); setModal('edit') }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Pencil size={15} />
                      </button>
                      {!rule.isPreset && (
                        <button onClick={() => { setEditTarget(rule); setModal('delete') }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增/编辑 Modal */}
      <Modal isOpen={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? '编辑合规规则' : '新建合规规则'} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <RuleForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* 生成提醒 Modal */}
      <Modal isOpen={modal === 'generate'} onClose={() => { setModal(null); setGenResult(null) }}
        title="生成合规提醒" size="md">
        {genResult ? (
          <div className={`p-4 rounded-lg text-sm ${genResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <p className="font-medium">{genResult.success ? '✓ 生成成功' : '✗ 生成失败'}</p>
            <p>{genResult.message}</p>
          </div>
        ) : (
          <GenerateModal rule={editTarget} companies={companies} onConfirm={handleGenerate} onCancel={() => setModal(null)} loading={saving} />
        )}
      </Modal>

      {/* 删除确认 Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="确认删除" size="sm">
        <p className="text-gray-600 mb-6">确定删除规则 <strong>{editTarget?.ruleName}</strong>？此操作不可撤销。</p>
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

const DEMO_RULES = [
  { _id: 'cr1', ruleName: '年度申报（香港）', ruleId: 'HK-001', category: '周年申报', jurisdiction: '香港', frequency: '每年', daysBefore: 30, isPreset: true, status: 'active', isListedOnly: false },
  { _id: 'cr2', ruleName: '利得税申报', ruleId: 'HK-002', category: '税务申报', jurisdiction: '香港', frequency: '每年', daysBefore: 60, isPreset: true, status: 'active', isListedOnly: false },
  { _id: 'cr3', ruleName: 'BVI 年费缴纳', ruleId: 'BVI-001', category: '周年申报', jurisdiction: 'BVI', frequency: '每年', daysBefore: 45, isPreset: true, status: 'active', isListedOnly: false },
  { _id: 'cr4', ruleName: '上市公司季报披露', ruleId: 'HK-L01', category: '合规报告', jurisdiction: '香港', frequency: '每季度', daysBefore: 14, isPreset: true, status: 'active', isListedOnly: true },
]

export default ComplianceRules
