import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText, Download, Building2, User, Upload,
  CheckSquare, Square, ClipboardCheck, Pencil, Trash2
} from 'lucide-react'
import { documentService, companyService, personnelService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, EmptyState, PageHeader, SearchBar, DeleteConfirmModal, FormField, inputClass, labelClass } from '../components/UIHelpers'
import { useSearchFilter } from '../hooks/useSearchFilter'
import { validate, required } from '../utils/validators'
import { VirtualList } from '../components/VirtualList'
import Modal from '../components/Modal'

// ── 分类定义 ──
const DOC_CATEGORIES = [
  { key: 'establishment', label: '设立文件', color: 'bg-purple-50 text-purple-700 border-purple-200', icons: ['incorporation_doc', 'certificate', 'form'] },
  { key: 'government', label: '政府往来', color: 'bg-blue-50 text-blue-700 border-blue-200', icons: ['annual_report', 'return', 'form'] },
  { key: 'financial', label: '财务税务', color: 'bg-green-50 text-green-700 border-green-200', icons: ['financial_statement', 'annual_report'] },
  { key: 'banking', label: '银行文件', color: 'bg-amber-50 text-amber-700 border-amber-200', icons: ['agreement', 'form', 'certificate'] },
  { key: 'meeting', label: '会议文件', color: 'bg-gray-50 text-gray-700 border-gray-200', icons: ['minutes', 'resolution', 'board_resolution', 'notice'] },
  { key: 'other', label: '其他', color: 'bg-slate-50 text-slate-700 border-slate-200', icons: [] },
]

const DOC_TYPE_LABELS = {
  minutes: '会议纪要', resolution: '决议书', agreement: '协议书',
  form: '表单', certificate: '证明书', return: '申报表', notice: '通知书',
  annual_report: '周年申报', financial_statement: '财务报表',
  id_document: '身份证件', passport: '护照', proof_of_address: '地址证明',
  board_resolution: '董事会决议', incorporation_doc: '注册成立书', other: '其他',
}

const CATEGORY_MAP = (type) => {
  if (!type) return 'other'
  for (const cat of DOC_CATEGORIES) {
    if (cat.icons.includes(type)) return cat.key
  }
  return 'other'
}

const UPLOAD_FORM_RULES = {
  name: [required('文档名称为必填')],
}

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [companies, setCompanies] = useState([])
  const [personnel, setPersonnel] = useState([])

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    name: '', type: 'other', companyId: '', personnelId: '',
    category: 'other', docNumber: '', file: null,
  })
  const [uploadErrors, setUploadErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Search + filter via useSearchFilter
  const { search, setSearch, filters, setFilter, filtered } = useSearchFilter(
    documents,
    (d, q, f) => {
      const matchSearch = !q || d.name?.toLowerCase().includes(q) || d.docNumber?.toLowerCase().includes(q)
      const matchCategory = f.category === 'all' || !f.category || d.category === f.category
      const matchType = !f.type || d.type === f.type
      return matchSearch && matchCategory && matchType
    },
    { category: 'all', type: '' }
  )

  // Auto generate doc number if missing
  const generateDocNumber = useCallback((doc) => {
    const prefix = (DOC_TYPE_LABELS[doc.type] || 'DOC').slice(0, 3).toUpperCase()
    const seq = String(documents.length + 1).padStart(4, '0')
    return `${prefix}-${seq}`
  }, [documents.length])

  const loadReferences = useCallback(async () => {
    try {
      const [coRes, peRes] = await Promise.all([
        companyService.getAll().catch(() => ({ data: { data: [] } })),
        personnelService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setCompanies(coRes.data.data || [])
      setPersonnel(peRes.data.data || [])
    } catch { /* silent */ }
  }, [])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await documentService.getAll()
      const enriched = (data.data || []).map(d => ({
        ...d,
        category: d.category || CATEGORY_MAP(d.type),
        docNumber: d.docNumber || generateDocNumber(d),
      }))
      setDocuments(enriched)
    } catch {
      toast.error('加载文档失败')
    } finally {
      setLoading(false)
    }
  }, [generateDocNumber])

  useEffect(() => { loadDocuments(); loadReferences() }, [loadDocuments, loadReferences])

  // Categorised documents for sidebar display
  const categorisedDocs = useMemo(() => {
    const cats = {}
    DOC_CATEGORIES.forEach(cat => { cats[cat.key] = filtered.filter(d => d.category === cat.key) })
    return cats
  }, [filtered])

  // Selection
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === filtered.length) return new Set()
      return new Set(filtered.map(d => d._id))
    })
  }, [filtered])

  // Bulk download
  const handleBulkDownload = useCallback(async () => {
    if (selected.size === 0) { toast.error('请先选择文档'); return }
    const chosen = documents.filter(d => selected.has(d._id))
    const withUrl = chosen.filter(d => d.fileUrl)
    if (withUrl.length === 0) {
      toast('所选文档暂无可下载文件（演示数据未包含实体文件）', { icon: 'ℹ️' })
    } else {
      withUrl.forEach(d => window.open(d.fileUrl, '_blank', 'noopener'))
      toast.success(`已开始下载 ${withUrl.length} 个文件`)
    }
    setSelected(new Set())
  }, [selected, documents])

  // Delete document
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await documentService.delete(deleteTarget._id)
      setDocuments(ds => ds.filter(d => d._id !== deleteTarget._id))
      toast.success('文档已删除')
    } catch (err) {
      toast.error(err.response?.data?.message || '删除失败')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget])

  // Single upload
  const handleUpload = useCallback(async () => {
    const { valid, errors } = validate(uploadForm, UPLOAD_FORM_RULES)
    if (!valid) { setUploadErrors(errors); return }
    setUploadErrors({})
    setUploading(true)
    try {
      const { data: resData } = await documentService.create({
        name: uploadForm.name,
        type: uploadForm.type,
        company: uploadForm.companyId || undefined,
        personnel: uploadForm.personnelId || undefined,
        category: uploadForm.category,
        docNumber: uploadForm.docNumber,
      })
      setDocuments(ds => [{ _id: resData.data?._id || Date.now().toString(), ...uploadForm, ...resData.data, category: uploadForm.category, docNumber: uploadForm.docNumber || generateDocNumber({}) }, ...ds])
      setShowUploadModal(false)
      setUploadForm({ name: '', type: 'other', companyId: '', personnelId: '', category: 'other', docNumber: '', file: null })
      toast.success('文档已上传')
    } catch (err) {
      toast.error(err.response?.data?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }, [uploadForm, generateDocNumber])

  return (
    <div className="flex gap-6">
      {/* ── Sidebar: Categories ── */}
      <aside className="w-52 shrink-0 space-y-2">
        <h3 className="text-sm font-semibold text-gray-500 px-2 pb-2">文档分类</h3>

        {/* All */}
        <button onClick={() => setFilter('category', 'all')}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
            filters.category === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
          }`}>
          <span className="flex items-center gap-2"><FileText size={16} /> 全部</span>
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{documents.length}</span>
        </button>

        {DOC_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setFilter('category', cat.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
              filters.category === cat.key ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
            }`}>
            <span className="flex items-center gap-2"><ClipboardCheck size={16} /> {cat.label}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 ${cat.color}`}>{categorisedDocs[cat.key]?.length || 0}</span>
          </button>
        ))}

        {/* Divider */}
        <hr className="my-4 border-gray-200" />

        {/* Quick links */}
        <h4 className="text-xs font-medium text-gray-400 px-2">快速关联</h4>
        <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
          value=""
          onChange={e => {
            if (!e.target.value) return
            setFilter('category', 'all')
            setSearch(e.target.value.split(':')[1] || '')
          }}>
          <option value="">按公司筛选...</option>
          {companies.map(c => <option key={c._id} value={`company:${c.name}`}>{c.name}</option>)}
        </select>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <PageHeader
          title="文档管理"
          subtitle={`${documents.length} 个文档`}
          icon={FileText}
          actions={
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button onClick={handleBulkDownload} className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                  <Download size={14} />
                  下载 ({selected.size})
                </button>
              )}
              <button onClick={() => { setShowUploadModal(true); setUploadForm({ name: '', type: 'other', companyId: '', personnelId: '', category: 'other', docNumber: '', file: null }) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                <Upload size={14} /> 上传文档
              </button>
            </div>
          }
        />

        {/* Search + Type filter */}
        <div className="flex flex-wrap gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索文档名称、编号..." />
          <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={filters.type} onChange={e => setFilter('type', e.target.value)}>
            <option value="">所有类型</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Document List */}
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="暂无文档"
            action={
              <button onClick={() => setShowUploadModal(true)} className="mt-3 text-primary-600 hover:underline text-sm">+ 上传文档</button>
            }
          />
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
              <div className="col-span-1 text-center">
                {selected.size === filtered.length && filtered.length > 0 ? (
                  <CheckSquare size={16} className="mx-auto text-primary-600 cursor-pointer" onClick={toggleAll} />
                ) : (
                  <Square size={16} className="mx-auto text-gray-300 cursor-pointer" onClick={toggleAll} />
                )}
              </div>
              <div className="col-span-2">编号</div>
              <div className="col-span-3">名称</div>
              <div className="col-span-2">分类</div>
              <div className="col-span-1">类型</div>
              <div className="col-span-2">关联</div>
              <div className="col-span-1 text-right">日期</div>
            </div>

            {filtered.length > 100 ? (
              <VirtualList
                items={filtered}
                itemHeight={80}
                maxHeight={600}
                renderItem={(doc, _idx, style) => {
                  const cat = DOC_CATEGORIES.find(c => c.key === doc.category) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1]
                  const isSelected = selected.has(doc._id)
                  return (
                    <div key={doc._id} style={style} className="px-1 py-1">
                      <div className={`group bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${
                        isSelected ? 'border-primary-400 bg-primary-50' : 'border-gray-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 no-nav" onClick={e => e.stopPropagation()}>
                            {isSelected ? (
                              <CheckSquare size={18} className="text-primary-600 cursor-pointer" onClick={() => toggleSelect(doc._id)} />
                            ) : (
                              <Square size={18} className="text-gray-300 cursor-pointer" onClick={() => toggleSelect(doc._id)} />
                            )}
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                            <FileText size={18} className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-gray-400">{doc.docNumber || '-'}</span>
                              <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                              <span className={`px-2 py-0.5 rounded-full border text-xs ${cat.color}`}>{cat.label}</span>
                              <span>{DOC_TYPE_LABELS[doc.type] || doc.type || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
            ) : filtered.map(doc => {
              const cat = DOC_CATEGORIES.find(c => c.key === doc.category) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1]
              const isSelected = selected.has(doc._id)
              return (
                <div key={doc._id}
                  className={`group bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? 'border-primary-400 bg-primary-50' : 'border-gray-200'
                  }`}
                  onClick={(e) => {
                    if (e.target.closest('.no-nav')) return
                  }}
                  onDoubleClick={() => {
                    if (doc.fileUrl) window.open(doc.fileUrl, '_blank')
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div className="shrink-0 no-nav" onClick={e => e.stopPropagation()}>
                      {isSelected ? (
                        <CheckSquare size={18} className="text-primary-600 cursor-pointer" onClick={() => toggleSelect(doc._id)} />
                      ) : (
                        <Square size={18} className="text-gray-300 cursor-pointer" onClick={() => toggleSelect(doc._id)} />
                      )}
                    </div>

                    {/* Doc icon */}
                    <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                      <FileText size={18} className="text-gray-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{doc.docNumber || '-'}</span>
                        <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full border text-xs ${cat.color}`}>{cat.label}</span>
                        <span>{DOC_TYPE_LABELS[doc.type] || doc.type || '-'}</span>
                        {doc.company && (
                          <Link to={`/companies/${doc.company._id || doc.company}`} className="text-primary-500 hover:underline flex items-center gap-0.5 no-nav">
                            <Building2 size={11} /> {doc.company.name || doc.company}
                          </Link>
                        )}
                        {doc.personnel && (
                          <Link to={`/personnel/${doc.personnel._id || doc.personnel}`} className="text-primary-500 hover:underline flex items-center gap-0.5 no-nav">
                            <User size={11} /> {doc.personnel.name || doc.personnel}
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Date + Actions */}
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs text-gray-400 hidden sm:block">{formatDate(doc.createdAt)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-nav">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="下载">
                            <Download size={14} />
                          </a>
                        )}
                        <button onClick={() => {
                          setUploadForm({ ...uploadForm, name: doc.name, type: doc.type, companyId: doc.company?._id || doc.company || '', personnelId: doc.personnel?._id || doc.personnel || '', category: doc.category || 'other' })
                          setShowUploadModal(true)
                        }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="编辑">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(doc)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="上传文档" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="文档名称" required error={uploadErrors.name}>
              <input className={inputClass}
                value={uploadForm.name} onChange={e => { setUploadForm({ ...uploadForm, name: e.target.value }); setUploadErrors(ue => ({ ...ue, name: '' })) }} placeholder="例如：周年申报表" />
            </FormField>
            <FormField label="文档编号">
              <input className={inputClass} style={{ fontFamily: 'monospace' }}
                value={uploadForm.docNumber} onChange={e => setUploadForm({ ...uploadForm, docNumber: e.target.value })} placeholder="自动生成" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="分类">
              <select className={inputClass}
                value={uploadForm.category} onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}>
                {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </FormField>
            <FormField label="类型">
              <select className={inputClass}
                value={uploadForm.type} onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="关联公司">
              <select className={inputClass}
                value={uploadForm.companyId} onChange={e => setUploadForm({ ...uploadForm, companyId: e.target.value, personnelId: '' })}>
                <option value="">无</option>
                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="关联人员">
              <select className={inputClass}
                value={uploadForm.personnelId} onChange={e => setUploadForm({ ...uploadForm, personnelId: e.target.value, companyId: '' })}>
                <option value="">无</option>
                {personnel.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div>
            <label className={labelClass}>上传文件</label>
            <input type="file" className={inputClass}
              onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
