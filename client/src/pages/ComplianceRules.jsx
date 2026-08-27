import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Plus, RefreshCw, Zap, Download, AlertTriangle,
  Pencil, Trash2
} from 'lucide-react'
import { complianceRuleService, companyService } from '../services/index.js'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField, jurisdictionLabel, JURISDICTION_OPTIONS } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { toArray } from '../utils/responseNormalize.js'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'

const JURISDICTIONS = ['HK', 'BVI', 'Cayman', 'SG', 'OTHER']
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
    jurisdiction: initial.jurisdiction || 'HK',
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
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
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
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-ink border border-hairline rounded-lg hover:bg-canvas">取消</button>
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
      <p className="text-sm text-ink-2">为 <strong>{rule?.ruleName}</strong> 选择要生成提醒的公司：</p>
      <div className="max-h-64 overflow-y-auto border border-hairline rounded-lg divide-y divide-gray-100">
        {companies.length === 0 ? (
          <p className="text-center py-6 text-ink-3 text-sm">暂无公司数据</p>
        ) : companies.map(c => (
          <label key={c._id} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas cursor-pointer">
            <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggle(c._id)} className="w-4 h-4 rounded text-primary-600" />
            <span className="text-sm text-ink">{c.name}</span>
            {c.nameChinese && <span className="text-xs text-ink-3">{c.nameChinese}</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
        <button onClick={() => onConfirm(selected)} disabled={loading || selected.length === 0} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '生成中...' : `生成提醒（已选 ${selected.length} 家）`}
        </button>
      </div>
    </div>
  )
}

const FIELD_LABELS = {
  incorporationDate: '注册成立日期',
  financialYearEnd: '财政年度结算日',
  brExpiryDate: '商业登记到期日',
}

const exportGapsCSV = (diagnosis) => {
  if (!diagnosis) return
  const rows = (diagnosis.companies || [])
    .filter((c) => c.missingFields && c.missingFields.length)
    .map((c) => [
      c.name || '',
      c.nameChinese || '',
      c.jurisdiction || '',
      c.isListed ? '是' : '否',
      (c.missingFields || []).map((f) => FIELD_LABELS[f] || f).join(';'),
    ])
  const header = ['公司名称', '中文名', '注册地', '是否上市', '缺失字段']
  const esc = (v) => '"' + String(v == null ? '' : v).replace(new RegExp('"', 'g'), '""') + '"'
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '合规数据缺口_' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const GapsView = ({ diagnosis, loading, onExport }) => {
  if (loading) return <LoadingSpinner />
  if (!diagnosis) return <EmptyState icon={AlertTriangle} title="尚未加载诊断" />
  const { companies, companiesWithGaps, totalCompanies, summary } = diagnosis
  const gapCompanies = companies.filter((c) => c.missingFields && c.missingFields.length)
  if (!companiesWithGaps) return <EmptyState icon={ShieldCheck} title="所有公司合规字段完整" action={<span className="text-sm text-ink-3">暂无数据缺口</span>} />
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-hairline p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-ink-2">合规数据缺口概览</p>
            <p className="text-2xl font-semibold text-ink mt-1">{companiesWithGaps} <span className="text-base font-normal text-ink-3">/ {totalCompanies} 家公司</span></p>
            <p className="text-sm text-ink-3 mt-1">共 <strong className="text-warning">{summary.totalMissing}</strong> 处字段缺失，导致对应合规提醒无法生成</p>
          </div>
          <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 border border-hairline rounded-lg text-sm font-medium hover:bg-canvas">
            <Download size={15} /> 导出 CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {Object.entries(summary.byField).map(([f, n]) => (
            <span key={f} className="px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">缺{FIELD_LABELS[f] || f}：{n}</span>
          ))}
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas border-b border-hairline">
            <tr>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">公司</th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium hidden md:table-cell">注册地</th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium hidden md:table-cell">上市</th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">缺失字段</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gapCompanies.map((c) => (
              <tr key={c._id} className="hover:bg-canvas">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{c.name}</div>
                  {c.nameChinese && <div className="text-xs text-ink-3 mt-0.5">{c.nameChinese}</div>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${jurisdictionColor(c.jurisdiction)}`}>{jurisdictionLabel(c.jurisdiction) || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-ink-2">{c.isListed ? '是' : '否'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.missingFields.map((f) => (
                      <span key={f} className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium">{FIELD_LABELS[f] || f}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const jurisdictionColor = (j) => ({
  'HK': 'bg-info/10 text-primary-700',
  'BVI': 'bg-canvas text-ink-2',
  'Cayman': 'bg-canvas text-ink-2',
  'SG': 'bg-canvas text-ink-2',
  'OTHER': 'bg-canvas text-ink-2',
}[j] || 'bg-canvas text-ink-2')

const ComplianceRules = () => {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [rules, setRules] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [genResult, setGenResult] = useState(null)
  const [view, setView] = useState('rules')
  const [diagnosis, setDiagnosis] = useState(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('')  // '' = 全部

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

  // 分组显示：选中某注册地时只显示该 jurisdiction（含 'ALL' 规则），否则显示全部
  const displayRules = activeTab
    ? filtered.filter(r => r.jurisdiction === activeTab || r.jurisdiction === 'ALL')
    : filtered

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesRes, compRes] = await Promise.all([
        complianceRuleService.getAll(),
        companyService.getAll(),
      ])
      // 防御：normalize 兜底可能返回非数组（如 { success, count, rules }），
      // 直接 setState 会让 useSearchFilter / displayRules 的 .filter 抛错白屏
      setRules(toArray(rulesRes?.data?.data, 'rules'))
      setCompanies(toArray(compRes?.data?.data, 'companies'))
    } catch {
      setRules([])
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchDiagnosis = useCallback(async () => {
    setDiagLoading(true)
    try {
      const { data: res } = await complianceRuleService.diagnose()
      setDiagnosis(res?.data || res || null)
    } catch {
      setDiagnosis({ companies: [], companiesWithGaps: 0, totalCompanies: 0, summary: { byField: {}, totalMissing: 0 } })
    } finally {
      setDiagLoading(false)
    }
  }, [])

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
        // service 统一返回 { data: { data: entity } }，此处 res 已是内层 { data: entity }
        const updated = res?.data || res
        setRules(rs => rs.map(r => r._id === editTarget._id ? updated : r))
        toast.success('更新成功')
      } else {
        const { data: res } = await complianceRuleService.create(data)
        const created = res?.data || res
        setRules(rs => [created, ...rs])
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
      // Mock 返回 remindersGenerated，真实后端返回 created/blocked，两者都兼容
      const payload = res?.data || res || {}
      const generated = payload.remindersGenerated ?? payload.created ?? 0
      setGenResult({
        success: true,
        message: `成功生成 ${generated} 条提醒，跳过 ${payload.skipped || 0} 条`,
        blocked: payload.blocked || 0,
        blockedByField: payload.blockedByField || {},
        blockedByReason: payload.blockedByReason || {},
        blockedDetails: payload.blockedDetails || [],
      })
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
              className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium">
              <Zap size={15} /> 初始化预设规则
            </button>
            <button onClick={() => { setEditTarget(null); setModal('new') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={15} /> 新建规则
            </button>
          </>
        }
      />

      {/* 视图切换 */}
      <div className="flex gap-1 border-b border-hairline">
        <button onClick={() => setView('rules')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === 'rules' ? 'border-primary-600 text-primary-700' : 'border-transparent text-ink-2 hover:text-ink'}`}>合规规则</button>
        <button onClick={() => { setView('gaps'); if (!diagnosis && !diagLoading) fetchDiagnosis() }} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === 'gaps' ? 'border-primary-600 text-primary-700' : 'border-transparent text-ink-2 hover:text-ink'}`}>数据缺口</button>
      </div>

      {view === 'rules' && (
      <>
      <div className="bg-surface rounded-xl border border-hairline p-4 space-y-3">
        {/* jurisdiction 分组 tabs */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${activeTab === '' ? 'bg-primary-600 text-white border-primary-600' : 'border-hairline text-ink-2 hover:bg-canvas'}`}>全部</button>
          {JURISDICTION_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setActiveTab(o.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${activeTab === o.value ? 'bg-primary-600 text-white border-primary-600' : 'border-hairline text-ink-2 hover:bg-canvas'}`}>{o.label}</button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索规则名称、编号..." className="w-full sm:flex-1" />
          <div className="flex flex-wrap gap-3 flex-1 sm:flex-initial">
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
              className="flex-1 sm:flex-none sm:w-40 px-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
            <button onClick={fetchAll} className="px-3 py-2 border border-hairline rounded-lg hover:bg-canvas tap-target">
              <RefreshCw size={15} className="text-ink-2" />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : displayRules.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="暂无合规规则" action={
          <button onClick={handleInitialize} className="mt-4 text-primary-600 hover:underline text-sm">点击初始化预设规则</button>
        } />
      ) : (
        <div className="space-y-4">
          {activeTab && (
            <div className="text-sm font-medium text-ink-2">
              {jurisdictionLabel(activeTab)} Rules ({displayRules.length})
              <span className="ml-2 text-xs text-ink-3 font-normal">含全局（ALL）规则</span>
            </div>
          )}
          <div className="bg-surface rounded-xl border border-hairline overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-canvas border-b border-hairline">
              <tr>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">规则</th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium hidden md:table-cell">注册地</th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium hidden lg:table-cell">频率</th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium hidden lg:table-cell">提前天数</th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">状态</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRules.map(rule => (
                <tr key={rule._id} className="hover:bg-canvas">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink flex items-center gap-1.5">
                      {rule.name || rule.ruleName}
                      {(rule.isPreset || rule.isPredefined) && <span className="text-xs bg-info/10 text-primary-600 px-1.5 py-0.5 rounded font-normal">预设</span>}
                      {rule.isListedOnly && <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-normal">上市</span>}
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5 flex gap-2">
                      {rule.ruleId && <span className="font-mono">{rule.ruleId}</span>}
                      {rule.category && <span>{rule.category}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${jurisdictionColor(rule.jurisdiction)}`}>
                      {jurisdictionLabel(rule.jurisdiction) || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-2">{rule.frequency || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-2">{rule.dueDaysBefore ?? rule.daysBefore ? `${rule.dueDaysBefore ?? rule.daysBefore} 天` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.status === 'active' ? 'bg-success/10 text-success' : 'bg-canvas text-ink-2'}`}>
                      {rule.status === 'active' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditTarget(rule); setGenResult(null); setModal('generate') }}
                        className="p-1.5 text-ink-3 hover:text-info hover:bg-info/10 rounded-lg transition-colors" title="生成提醒">
                        <Zap size={15} />
                      </button>
                      <button onClick={() => { setEditTarget(rule); setModal('edit') }}
                        className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Pencil size={15} />
                      </button>
                      {!rule.isPreset && !rule.isPredefined && (
                        <button onClick={() => { setEditTarget(rule); setModal('delete') }}
                          className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
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
        </div>
      )}
      </>)}

      {view === 'gaps' && (
        <GapsView diagnosis={diagnosis} loading={diagLoading} onExport={() => exportGapsCSV(diagnosis)} />
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
          <div className={`p-4 rounded-lg text-sm ${genResult.success ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
            <p className="font-medium">{genResult.success ? '✓ 生成成功' : '✗ 生成失败'}</p>
            <p>{genResult.message}</p>
            {genResult.blocked > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20 space-y-1">
                <p className="font-medium">⚠️ {genResult.blocked} 条因以下原因未生成：</p>
                {Object.keys(genResult.blockedByField || {}).map((f) => (
                  <p key={f}>• 缺 <code className="font-mono">{f}</code>：{(genResult.blockedByField || {})[f]} 条</p>
                ))}
                {genResult.blockedByReason?.not_listed ? <p>• 仅上市公司适用（所选公司均非上市）：{genResult.blockedByReason.not_listed} 条</p> : null}
                {genResult.blockedByReason?.jurisdiction_mismatch ? <p>• 司法管辖不匹配：{genResult.blockedByReason.jurisdiction_mismatch} 条</p> : null}
                {genResult.blockedByReason?.listing_location_mismatch ? <p>• 上市地不匹配：{genResult.blockedByReason.listing_location_mismatch} 条</p> : null}
              </div>
            )}
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
