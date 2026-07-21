import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FileCode, Plus, RefreshCw, Zap,
  Pencil, Trash2, Play, Copy
} from 'lucide-react'
import { templateService, companyService } from '../services/index.js'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, SearchBar, DeleteConfirmModal, FormField } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { extractVars } from '../utils/helpers'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'

const CATEGORIES = ['board_resolution', 'agm_resolution', 'director_change', 'shareholder_notice', 'annual_report', 'other']
const CATEGORY_LABELS = {
  board_resolution: '董事会决议',
  agm_resolution: '股东大会决议',
  director_change: '董事变更',
  shareholder_notice: '股东通知',
  annual_report: '年度报告',
  other: '其他',
}


const TEMPLATE_FORM_RULES = {
  name: [required('模板名称为必填')],
}

const TemplateForm = ({ initial = {}, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    category: initial.category || 'other',
    content: initial.content || '',
    variables: initial.variables || [],
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const vars = extractVars(form.content)

  const handleSubmit = (e) => {
    e.preventDefault()
    const { valid, errors: vErrors } = validate(form, TEMPLATE_FORM_RULES)
    if (!valid) { setErrors(vErrors); return }
    setErrors({})
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="模板名称" required error={errors.name}>
          <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} placeholder="董事会决议模板" />
        </FormField>
        <div>
          <label className={labelClass}>类别</label>
          <select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>描述</label>
        <input className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} placeholder="简短描述模板用途" />
      </div>
      <div>
        <label className={labelClass}>
          模板内容
          <span className="ml-2 text-xs text-ink-3 font-normal">使用 {'{{变量名}}'} 标记变量，如 {'{{公司名称}}'}</span>
        </label>
        <textarea
          rows={12}
          className={inputClass + ' font-mono text-xs'}
          value={form.content}
          onChange={e => set('content', e.target.value)}
          placeholder={'<h2>{{公司名称}}</h2>\n<p>决议日期：{{会议日期}}</p>\n<p>{{决议内容}}</p>'}
        />
      </div>
      {vars.length > 0 && (
        <div className="bg-info/10 border border-info/20 rounded-lg p-3">
          <p className="text-xs font-medium text-primary-700 mb-1.5">检测到变量（{vars.length} 个）：</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map(v => (
              <span key={v} className="text-xs bg-info/10 text-primary-700 px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-ink border border-hairline rounded-lg hover:bg-canvas">取消</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '保存中...' : '保存模板'}
        </button>
      </div>
    </form>
  )
}

// 变量名 → 公司数据字段的映射表（选公司时自动填充）
// key = 模板里的变量名（中文或英文），value = 公司对象取值路径
const COMPANY_VAR_MAP = {
  // 中文名
  '公司名称':         (c) => c.name || '',
  '公司中文名':       (c) => c.nameChinese || '',
  '注册号':          (c) => c.registrationNumber || '',
  '股票代码':        (c) => c.stockCode || '',
  '成立日期':        (c) => c.incorporationDate || '',
  '注册地址':        (c) => c.registeredAddress || (c.address?.street ? [c.address.street, c.address.city, c.address.country].filter(Boolean).join(', ') : ''),
  // 英文名（模板也可能用英文变量）
  'companyName':     (c) => c.name || '',
  'companyNameEn':   (c) => c.name || '',
  'companyNameCN':   (c) => c.nameChinese || '',
  'registrationNumber': (c) => c.registrationNumber || '',
  'registrationNo': (c) => c.registrationNumber || '',
  'companyNumber':   (c) => c.registrationNumber || '',
  'stockCode':       (c) => c.stockCode || '',
  'incorporationDate': (c) => c.incorporationDate || '',
  'registeredAddress': (c) => c.registeredAddress || '',
  'jurisdiction':    (c) => c.jurisdiction || '',
}

// 判断一个变量是否能从公司数据中自动获取
function canAutoFill(varName) {
  return !!COMPANY_VAR_MAP[varName]
}

const RenderModal = ({ template, companies, onClose }) => {
  const [selectedCompany, setSelectedCompany] = useState('')
  const [manualVars, setManualVars] = useState({})
  const [autoFilledVars, setAutoFilledVars] = useState({})   // 自动填充的值（只读展示）
  const [rendered, setRendered] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const vars = template ? extractVars(template.content) : []

  // 选公司时：自动解析可填充变量 + 重置手动区
  useEffect(() => {
    if (!selectedCompany) {
      setAutoFilledVars({})
      return
    }
    const co = companies.find(c => c._id === selectedCompany)
    if (!co) return

    const auto = {}
    // 遍历模板所有变量，能自动填充的归到 autoFilled
    for (const v of vars) {
      if (canAutoFill(v)) {
        const val = COMPANY_VAR_MAP[v](co)
        if (val) auto[v] = val
      }
    }
    setAutoFilledVars(auto)

    // 同时清掉已被自动填充的手动输入残留（防止旧值冲突）
    setManualVars(prev => {
      const next = { ...prev }
      for (const k of Object.keys(auto)) delete next[k]
      return next
    })
  }, [selectedCompany])

  // 分离变量：autoVars = 可自动填充, manualOnlyVars = 必须手动填写
  const autoVarNames = vars.filter(v => canAutoFill(v))
  const manualOnlyVarNames = vars.filter(v => !canAutoFill(v))

  const handleRender = async () => {
    setLoading(true); setError('')
    try {
      const co = companies.find(c => c._id === selectedCompany)
      const companyVars = {}
      if (co) {
        // 用同一套映射表生成公司变量
        for (const v of vars) {
          if (canAutoFill(v)) {
            companyVars[v] = COMPANY_VAR_MAP[v](co) || ''
          }
        }
      }
      const { data } = await templateService.render(template._id, { data: { ...companyVars, ...manualVars } })
      setRendered(data.data?.rendered || data.rendered || '')
    } catch (e) {
      setError(e.response?.data?.message || '渲染失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>关联公司（自动填充公司信息）</label>
        <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
          <option value="">-- 不关联 --</option>
          {companies.map(c => <option key={c._id} value={c._id}>{c.name}{c.nameChinese ? ` (${c.nameChinese})` : ''}</option>)}
        </select>
      </div>

      {/* 已自动填充的变量（只读展示） */}
      {Object.keys(autoFilledVars).length > 0 && (
        <div className="border border-success/20 bg-success/10 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-success flex items-center gap-1.5">
            ✓ 已自动填充（{Object.keys(autoFilledVars).length} 个字段来自中央数据库）
          </p>
          {Object.entries(autoFilledVars).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs font-medium text-ink-2 w-32 flex-shrink-0">{key}</label>
              <span className="flex-1 text-sm text-ink bg-surface border border-success/20 rounded px-3 py-1.5 min-h-[34px] leading-[22px]">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* 可自动填充但尚未选择公司的提示 */}
      {autoVarNames.length > 0 && !selectedCompany && (
        <div className="bg-yellow-50 border border-warning/20 rounded-lg p-3">
          <p className="text-xs text-warning">
            💡 选择关联公司后可自动填充：{autoVarNames.join('、')}
          </p>
        </div>
      )}

      {/* 手动填写变量 */}
      {manualOnlyVarNames.length > 0 && (
        <div className="border border-hairline rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-ink">手动填写变量：</p>
          {manualOnlyVarNames.map(v => (
            <div key={v}>
              <label className="block text-xs font-medium text-ink-2 mb-1">{v}</label>
              <input className={inputClass} value={manualVars[v] || ''} onChange={e => setManualVars(m => ({ ...m, [v]: e.target.value }))} placeholder={`填写 ${v}`} />
            </div>
          ))}
        </div>
      )}

      {/* 无变量的提示 */}
      {vars.length === 0 && (
        <div className="text-center py-6 text-sm text-ink-3">此模板无变量，将直接渲染原始内容</div>
      )}

      {error && <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg">{error}</div>}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">关闭</button>
        <button onClick={handleRender} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          <Play size={14} /> {loading ? '渲染中...' : '渲染预览'}
        </button>
      </div>
      {rendered && (
        <div className="border border-hairline rounded-lg overflow-hidden">
          <div className="bg-canvas border-b border-hairline px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">渲染结果预览</span>
            <button onClick={() => navigator.clipboard?.writeText(rendered)}
              className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
              <Copy size={12} /> 复制 HTML
            </button>
          </div>
          <div className="p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: rendered }} />
        </div>
      )}
    </div>
  )
}

const categoryColor = (c) => ({
  board_resolution: 'bg-canvas text-ink-2',
  agm_resolution: 'bg-success/10 text-success',
  director_change: 'bg-info/10 text-primary-700',
  shareholder_notice: 'bg-canvas text-ink-2',
  annual_report: 'bg-warning/10 text-warning',
}[c] || 'bg-canvas text-ink-2')

const Templates = () => {
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [templates, setTemplates] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [renderTarget, setRenderTarget] = useState(null)
  const [error, setError] = useState('')

  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    templates,
    (t, q, f) => {
      const matchSearch = !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      const matchCategory = !f.category || t.category === f.category
      return matchSearch && matchCategory
    },
    { category: '' }
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tmplRes, compRes] = await Promise.all([
        templateService.getAll().catch(() => ({ data: { data: [] } })),
        companyService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setTemplates(tmplRes.data?.data || [])
      setCompanies(compRes.data?.data || [])
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleInitialize = async () => {
    const ok = await confirm({ title: '初始化预设模板', message: '初始化将加载预设文档模板，确定继续？', confirmLabel: '确认初始化', variant: 'warning' })
    if (!ok) return
    setSaving(true)
    try {
      await templateService.initPresets()
      toast.success('预设模板初始化完成！')
      fetchAll()
    } catch (e) {
      toast.error(e.response?.data?.message || '初始化失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (data) => {
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const { data: resData } = await templateService.update(editTarget._id, data)
        setTemplates(ts => ts.map(t => t._id === editTarget._id ? (resData.data || { ...t, ...data }) : t))
      } else {
        const { data: resData } = await templateService.create(data)
        setTemplates(ts => [resData.data || { _id: Date.now().toString(), ...data }, ...ts])
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
      await templateService.delete(editTarget._id)
      setTemplates(ts => ts.filter(t => t._id !== editTarget._id))
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
        title="文档模板"
        subtitle="管理文档模板并渲染生成文件"
        icon={FileCode}
        actions={
          <>
            <button onClick={handleInitialize} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium">
              <Zap size={15} /> 初始化预设模板
            </button>
            <button onClick={() => { setEditTarget(null); setError(''); setModal('new') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus size={15} /> 新建模板
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-surface rounded-xl border border-hairline p-4">
        <div className="flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索模板名称..." />
          <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
            className="px-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部类别</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <button onClick={fetchAll} className="px-3 py-2 border border-hairline rounded-lg hover:bg-canvas">
            <RefreshCw size={15} className="text-ink-2" />
          </button>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileCode} title="暂无模板" action={
          <button onClick={handleInitialize} className="mt-4 text-primary-600 hover:underline text-sm">点击初始化预设模板</button>
        } />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(t => {
            const vars = extractVars(t.content || '')
            return (
              <div key={t._id} className="bg-surface rounded-xl border border-hairline shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColor(t.category)}`}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                  {t.isPreset && <span className="text-xs bg-info/10 text-primary-600 px-1.5 py-0.5 rounded">预设</span>}
                </div>
                <h3 className="font-semibold text-ink mb-1">{t.name}</h3>
                {t.description && <p className="text-xs text-ink-2 mb-3 line-clamp-2">{t.description}</p>}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {vars.slice(0, 4).map(v => <span key={v} className="text-xs bg-canvas text-ink-2 px-1.5 py-0.5 rounded font-mono">{v}</span>)}
                    {vars.length > 4 && <span className="text-xs bg-canvas text-ink-2 px-1.5 py-0.5 rounded">+{vars.length - 4}</span>}
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-hairline mt-auto">
                  <button onClick={() => { setRenderTarget(t); setModal('render') }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 font-medium">
                    <Play size={13} /> 渲染预览
                  </button>
                  <button onClick={() => { setEditTarget(t); setError(''); setModal('edit') }}
                    className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <Pencil size={15} />
                  </button>
                  {!t.isPreset && (
                    <button onClick={() => { setEditTarget(t); setModal('delete') }}
                      className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新增/编辑 Modal */}
      <Modal isOpen={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? '编辑模板' : '新建文档模板'} size="xl">
        {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg">{error}</div>}
        <TemplateForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* 渲染预览 Modal */}
      <Modal isOpen={modal === 'render'} onClose={() => setModal(null)}
        title={`渲染模板：${renderTarget?.name}`} size="xl">
        {renderTarget && <RenderModal template={renderTarget} companies={companies} onClose={() => setModal(null)} />}
      </Modal>

      {/* 删除确认 Modal */}
      <DeleteConfirmModal
        isOpen={modal === 'delete'}
        name={editTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
        loading={saving}
      />

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  )
}

export default Templates
