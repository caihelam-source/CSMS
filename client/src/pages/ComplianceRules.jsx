import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Plus, RefreshCw, Zap,
  Pencil, Trash2
} from 'lucide-react'
import { complianceRuleService, companyService } from '../services/index.js'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'

const JURISDICTIONS = ['香港', 'BVI', '开曼', '新加坡', '其他']
const CATEGORIES = ['周年申报', '税务申报', '合规报告', '董事变更', '股份变更', '会议召开', '其他']
const FREQ = ['一次性', '每月', '每季度', '每半年', '每年']


const RULE_FORM_RULES = {
  ruleName: [required('规则名称为必填')],
}

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
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, RULE_FORM_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="规则名称" required error={errors.ruleName}>
          <input className={inputClass} value={form.ruleName} onChange={e => set('ruleName', e.target.value)} placeholder="年度申报规则" />
        </FormField>
        <div>
          <label className={labelClass}>规则编号</label>
          <input className={inputClass} value={form.ruleId} onChange={e => set('ruleId', e.target.value)} placeholder="HK-001" />
        </div>
        <div>
          <label className={labelClass}>注册地</label>
          <select className={inputClass} value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)}>
            {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>类别</label>
          <select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>频率</label>
          <select className={inputClass} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQ.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>提前提醒天数</label>
          <input type="number" min={1} max={365} className={inputClass} value={form.daysBefore} onChange={e => set('daysBefore', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>状态</label>
          <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
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
        <label className={labelClass}>规则描述</label>
        <textarea rows={3} className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} placeholder="详细说明此合规规则的要求..." />
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
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [rules, setRules] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [genResult, setGenResult] = useState(null)

  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    rules,
    (r, q, f) => {
      const matchSearch = !q || r.ruleName?.toLowerCase().includes(q) || r.ruleId?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
      const matchJurisdiction = !f.jurisdiction || r.jurisdiction === f.jurisdiction
      const matchStatus = !f.status || r.status === f.status
      return matchSearch && matchJurisdiction && matchStatus
    },
    { jurisdiction: '', status: '' }
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesRes, compRes] = await Promise.all([
        complianceRuleService.getAll(),
        companyService.getAll(),
      ])
      setRules(rulesRes.data?.data || rulesRes.data || [])
      setCompanies(compRes.data?.data || compRes.data || [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleInitialize = async () => {
    const ok = await confirm({ title: '初始化预设规则', message: '初始化将加载预设合规规则，确定继续？', confirmLabel: '确认初始化', variant: 'warning' })
    if (!ok) return
    setSaving(true)
    try {
      await complianceRuleService.initPresets()
      toast.success('预设规则初始化完成！')
      fetchAll()
    } catch (e) {
      toast.error(e.response?.data?.message || '初始化失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (editTarget) {
        const { data: res } = await complianceRuleService.update(editTarget._id, data)
        setRules(rs => rs.map(r => r._id === editTarget._id ? res : r))
        toast.success('更新成功')
      } else {
        const { data: res } = await complianceRuleService.create(data)
        setRules(rs => [res, ...rs])
        toast.success('创建成功')
      }
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async (companyIds) => {
    if (!editTarget) return
    setSaving(true)
    try {
      const { data: res } = await complianceRuleService.generateReminders(editTarget._id, { companyIds })
      setGenResult({ success: true, message: `成功生成 ${res.remindersGenerated || 0} 条提醒，跳过 ${res.skipped || 0} 条` })
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
      await complianceRuleService.delete(editTarget._id)
      setRules(rs => rs.filter(r => r._id !== editTarget._id))
      toast.success('删除成功')
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="合规规则"
        subtitle="管理合规规则并生成自动提醒"
        icon={ShieldCheck}
        actions={
          <>
            <button onClick={handleInitialize} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Zap size={15} /> 初始化预设规则
            </button>
            <button onClick={() => { setEditTarget(null); setModal('new') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={15} /> 新建规则
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索规则名称、编号..." />
          <select value={filters.jurisdiction} onChange={e => setFilter('jurisdiction', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部注册地</option>
            {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
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
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="暂无合规规则" action={
          <button onClick={handleInitialize} className="mt-4 text-primary-600 hover:underline text-sm">点击初始化预设规则</button>
        } />
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
                      {rule.name || rule.ruleName}
                      {(rule.isPreset || rule.isPredefined) && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-normal">预设</span>}
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
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{rule.dueDaysBefore ?? rule.daysBefore ? `${rule.dueDaysBefore ?? rule.daysBefore} 天` : '—'}</td>
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
                      <button onClick={() => { setEditTarget(rule); setModal('edit') }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Pencil size={15} />
                      </button>
                      {!rule.isPreset && !rule.isPredefined && (
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
      <DeleteConfirmModal
        isOpen={modal === 'delete'}
        name={editTarget?.name || editTarget?.ruleName}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
        loading={saving}
      />

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}

export default ComplianceRules
