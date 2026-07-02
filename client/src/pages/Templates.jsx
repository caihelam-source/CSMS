import { useEffect, useState } from 'react'
import api from '../services/api'
import Modal from '../components/Modal'
import {
  FileCode, Plus, Search, RefreshCw, Zap,
  Pencil, Trash2, Eye, Play, Copy
} from 'lucide-react'

const CATEGORIES = ['board_resolution', 'agm_resolution', 'director_change', 'shareholder_notice', 'annual_report', 'other']
const CATEGORY_LABELS = {
  board_resolution: '董事会决议',
  agm_resolution: '股东大会决议',
  director_change: '董事变更',
  shareholder_notice: '股东通知',
  annual_report: '年度报告',
  other: '其他',
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const lbl = 'block text-sm font-medium text-gray-700 mb-1'

// 从模板内容中提取 {{变量}}
const extractVars = (content) => {
  const matches = [...new Set((content.match(/\{\{([^}]+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, '').trim()))]
  return matches
}

const TemplateForm = ({ initial = {}, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    category: initial.category || 'other',
    content: initial.content || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const vars = extractVars(form.content)

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>模板名称 <span className="text-red-500">*</span></label>
          <input required className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="董事会决议模板" />
        </div>
        <div>
          <label className={lbl}>类别</label>
          <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>描述</label>
        <input className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="简短描述模板用途" />
      </div>
      <div>
        <label className={lbl}>
          模板内容
          <span className="ml-2 text-xs text-gray-400 font-normal">使用 {'{{变量名}}'} 标记变量，如 {'{{公司名称}}'}</span>
        </label>
        <textarea
          rows={12}
          className={inp + ' font-mono text-xs'}
          value={form.content}
          onChange={e => set('content', e.target.value)}
          placeholder={'<h2>{{公司名称}}</h2>\n<p>决议日期：{{会议日期}}</p>\n<p>{{决议内容}}</p>'}
        />
      </div>
      {vars.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-700 mb-1.5">检测到变量（{vars.length} 个）：</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map(v => (
              <span key={v} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          {loading ? '保存中...' : '保存模板'}
        </button>
      </div>
    </form>
  )
}

const RenderModal = ({ template, companies, onClose }) => {
  const [companyId, setCompanyId] = useState('')
  const [manualVars, setManualVars] = useState({})
  const [rendered, setRendered] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const vars = template ? extractVars(template.content) : []

  const autoCompanyVars = ['公司名称', '公司中文名', '注册地址', '成立日期', '注册号', '股票代码']

  const handleRender = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post(`/templates/${template._id}/render`, {
        companyId: companyId || undefined,
        manualVars,
      })
      setRendered(res.html || '')
    } catch (e) {
      setError(e.response?.data?.message || '渲染失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>关联公司（自动填充公司信息）</label>
          <select className={inp} value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">-- 不关联 --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {vars.filter(v => !autoCompanyVars.includes(v)).length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">手动填写变量：</p>
          {vars.filter(v => !autoCompanyVars.includes(v)).map(v => (
            <div key={v}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{v}</label>
              <input className={inp} value={manualVars[v] || ''} onChange={e => setManualVars(m => ({ ...m, [v]: e.target.value }))} placeholder={`填写 ${v}`} />
            </div>
          ))}
        </div>
      )}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">关闭</button>
        <button onClick={handleRender} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
          <Play size={14} /> {loading ? '渲染中...' : '渲染预览'}
        </button>
      </div>
      {rendered && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">渲染结果预览</span>
            <button onClick={() => navigator.clipboard?.writeText(rendered)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
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
  board_resolution: 'bg-purple-100 text-purple-700',
  agm_resolution: 'bg-green-100 text-green-700',
  director_change: 'bg-blue-100 text-blue-700',
  shareholder_notice: 'bg-teal-100 text-teal-700',
  annual_report: 'bg-orange-100 text-orange-700',
}[c] || 'bg-gray-100 text-gray-600')

const Templates = () => {
  const [templates, setTemplates] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [renderTarget, setRenderTarget] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [filterCategory])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterCategory) params.category = filterCategory
      const [tmplRes, compRes] = await Promise.all([
        api.get('/templates', { params }),
        api.get('/companies').catch(() => ({ companies: [] })),
      ])
      setTemplates(tmplRes.templates || [])
      setCompanies(compRes.companies || [])
    } catch {
      setTemplates(DEMO_TEMPLATES)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    if (!confirm('初始化将加载预设文档模板，确定继续？')) return
    setSaving(true)
    try {
      await api.post('/templates/initialize')
      alert('预设模板初始化完成！')
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
        const res = await api.put(`/templates/${editTarget._id}`, data)
        setTemplates(ts => ts.map(t => t._id === editTarget._id ? (res.template || { ...t, ...data }) : t))
      } else {
        const res = await api.post('/templates', data)
        setTemplates(ts => [res.template || { _id: Date.now().toString(), ...data }, ...ts])
      }
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await api.delete(`/templates/${editTarget._id}`)
      setTemplates(ts => ts.filter(t => t._id !== editTarget._id))
      setModal(null)
    } catch (e) {
      alert(e.response?.data?.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const filtered = templates.filter(t => {
    const q = search.toLowerCase()
    return !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCode className="text-primary-600" size={26} />
            文档模板
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理文档模板并渲染生成文件</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleInitialize} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Zap size={15} /> 初始化预设模板
          </button>
          <button onClick={() => { setEditTarget(null); setError(''); setModal('new') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus size={15} /> 新建模板
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索模板名称..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">全部类别</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <button onClick={fetchAll} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileCode size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无模板</p>
          <button onClick={handleInitialize} className="mt-4 text-primary-600 hover:underline text-sm">点击初始化预设模板</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(t => {
            const vars = extractVars(t.content || '')
            return (
              <div key={t._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColor(t.category)}`}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                  {t.isPreset && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">预设</span>}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
                {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {vars.slice(0, 4).map(v => <span key={v} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{v}</span>)}
                    {vars.length > 4 && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">+{vars.length - 4}</span>}
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                  <button onClick={() => { setRenderTarget(t); setModal('render') }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 font-medium">
                    <Play size={13} /> 渲染预览
                  </button>
                  <button onClick={() => { setEditTarget(t); setError(''); setModal('edit') }}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <Pencil size={15} />
                  </button>
                  {!t.isPreset && (
                    <button onClick={() => { setEditTarget(t); setModal('delete') }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <TemplateForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* 渲染预览 Modal */}
      <Modal isOpen={modal === 'render'} onClose={() => setModal(null)}
        title={`渲染模板：${renderTarget?.name}`} size="xl">
        {renderTarget && <RenderModal template={renderTarget} companies={companies} onClose={() => setModal(null)} />}
      </Modal>

      {/* 删除确认 Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="确认删除" size="sm">
        <p className="text-gray-600 mb-6">确定删除模板 <strong>{editTarget?.name}</strong>？此操作不可撤销。</p>
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

const DEMO_TEMPLATES = [
  { _id: 't1', name: '董事会决议（通用）', category: 'board_resolution', description: '标准董事会决议模板，适用于一般事项审批', isPreset: true, content: '<h2>{{公司名称}}</h2><p>决议日期：{{会议日期}}</p><p>出席董事：{{董事列表}}</p><p>{{决议内容}}</p>' },
  { _id: 't2', name: '股东大会通知', category: 'agm_resolution', description: '年度股东大会召开通知', isPreset: true, content: '<h2>{{公司名称}}</h2><p>会议日期：{{会议日期}}</p><p>会议地点：{{会议地点}}</p>' },
  { _id: 't3', name: '董事任命通知', category: 'director_change', description: '委任新董事的正式通知', isPreset: true, content: '<h2>{{公司名称}} 董事任命通知</h2><p>任命日期：{{任命日期}}</p><p>新董事姓名：{{新董事姓名}}</p>' },
]

export default Templates
