import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import {
  FileText, Download, Building2, User, Upload, CheckSquare, Square,
  Pencil, Trash2, Eye, FileSpreadsheet, FileArchive,
} from 'lucide-react'
import { documentService, companyService, personnelService } from '../services/index.js'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, EmptyState, SearchBar, FormField, inputClass, labelClass } from '../components/UIHelpers'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext.jsx'

// ── 类型 / 分类标签 ──
export const DOC_TYPE_LABELS = {
  minutes: '会议纪要', resolution: '决议书', agreement: '协议书',
  form: '表单', certificate: '证明书', return: '申报表', notice: '通知书',
  annual_report: '周年申报', financial_statement: '财务报表',
  id_document: '身份证件', passport: '护照', proof_of_address: '地址证明',
  board_resolution: '董事会决议', incorporation_doc: '注册成立书', other: '其他',
}

export const DOC_CATEGORY_LABELS = {
  establishment: '设立文件', government: '政府往来', financial: '财务税务',
  banking: '银行文件', meeting: '会议文件', other: '其他',
}

const DOC_CATEGORIES = [
  { key: 'establishment', label: '设立文件' },
  { key: 'government', label: '政府往来' },
  { key: 'financial', label: '财务税务' },
  { key: 'banking', label: '银行文件' },
  { key: 'meeting', label: '会议文件' },
  { key: 'other', label: '其他' },
]

const SCOPE_LABELS = { company: '公司文件', person: '个人文件' }
const SCOPE_CLS = { company: 'bg-info/10 text-primary-700', person: 'bg-purple-50 text-purple-700' }

// 到期状态徽章（内联，避免跨页依赖）
function docExpiryStatus(d) {
  const exp = d.expiresAt || d.renewalDueDate
  if (!exp) return null
  const days = Math.ceil((new Date(exp) - new Date()) / 86400000)
  if (days < 0) return { label: '已过期', cls: 'bg-danger/10 text-danger' }
  if (days <= 30) return { label: `${days}天到期`, cls: 'bg-warning/10 text-warning' }
  return { label: `${days}天`, cls: 'bg-success/10 text-success' }
}

// 来源链接（会议纪要 / 任务 / 合规）
function SourceBadge({ doc }) {
  if (!doc.source?.label) return null
  const kind = doc.source.kind || ''
  const href = doc.source.refId
    ? (['compliance_complete', 'task_complete', 'signing_scan', 'meeting_task', 'dashboard_sign'].includes(kind)
        ? `/tasks/${doc.source.refId}`
        : `/meetings/${doc.source.refId}`)
    : '#'
  const colorClass = kind === 'compliance_complete'
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : 'bg-info/10 text-primary-700'
  return (
    <Link to={href} className={`text-[10px] px-1.5 py-0.5 rounded-full ${colorClass} hover:underline flex items-center gap-0.5`}>
      <ExternalLinkIcon /> {doc.source.label}
    </Link>
  )
}
function ExternalLinkIcon() { return <span className="text-[8px]">↗</span> }

export default function DocumentManager({ companyId, personnelId, embedded = false, showExport = true }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterScope, setFilterScope] = useState('all')

  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploadMeta, setUploadMeta] = useState({
    name: '', type: 'other', category: 'other',
    companyId: companyId || '', personnelId: personnelId || '',
    documentYear: new Date().getFullYear(),
  })

  const [previewDoc, setPreviewDoc] = useState(null)
  const [editDoc, setEditDoc] = useState(null)
  const [editMeta, setEditMeta] = useState({ name: '', type: 'other', category: 'other', companyId: '', personnelId: '', documentYear: new Date().getFullYear() })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [companies, setCompanies] = useState([])
  const [personnel, setPersonnel] = useState([])
  const { isDemo } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let res
      if (companyId) res = await documentService.getByCompany(companyId)
      else if (personnelId) res = await documentService.getByPersonnel(personnelId)
      else res = await documentService.getAll()
      const list = (res.data.data || []).map((d) => ({
        ...d,
        category: d.category || 'other',
        scope: d.scope || (d.company ? 'company' : (d.personnel ? 'person' : 'company')),
      }))
      setDocuments(list)
    } catch {
      toast.error('加载文档失败')
    } finally {
      setLoading(false)
    }
  }, [companyId, personnelId])

  const loadRefs = useCallback(async () => {
    try {
      const [co, pe] = await Promise.all([
        companyService.getAll().catch(() => ({ data: { data: [] } })),
        personnelService.getAll().catch(() => ({ data: { data: [] } })),
      ])
      setCompanies(co.data.data || [])
      setPersonnel(pe.data.data || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    load()
    // 全局视图才需要加载公司/人员下拉；公司/人员专属视图若 props 已定也可加载
    if (!companyId || !personnelId) loadRefs()
  }, [load, loadRefs, companyId, personnelId])

  const filtered = useMemo(() => documents.filter((d) => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.name?.toLowerCase().includes(q) || d.docNumber?.toLowerCase().includes(q)
    const matchType = !filterType || d.type === filterType
    const matchCat = filterCategory === 'all' || d.category === filterCategory
    const matchScope = filterScope === 'all' || d.scope === filterScope
    return matchSearch && matchType && matchCat && matchScope
  }), [documents, search, filterType, filterCategory, filterScope])

  // ── 选择 ──
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((d) => d._id))))
  }, [filtered])

  // ── 上传（支持批量多文件）──
  const handleUpload = async () => {
    if (uploadFiles.length === 0 && !uploadMeta.name) { toast.error('请选择文件或填写文档名称'); return }
    setUploading(true)
    try {
      if (uploadFiles.length === 0) {
        await documentService.create({
          name: uploadMeta.name, type: uploadMeta.type, category: uploadMeta.category,
          company: uploadMeta.companyId || undefined, personnel: uploadMeta.personnelId || undefined,
          documentYear: uploadMeta.documentYear,
        })
      } else {
        for (const f of uploadFiles) {
          const fd = new FormData()
          fd.append('file', f)
          fd.append('name', uploadMeta.name || f.name)
          fd.append('type', uploadMeta.type)
          fd.append('category', uploadMeta.category)
          fd.append('documentYear', String(uploadMeta.documentYear))
          if (uploadMeta.companyId) fd.append('company', uploadMeta.companyId)
          if (uploadMeta.personnelId) fd.append('personnel', uploadMeta.personnelId)
          await documentService.upload(fd)
        }
      }
      toast.success(`已上传 ${uploadFiles.length || 1} 个文档`)
      setShowUpload(false)
      setUploadFiles([])
      setUploadMeta({ name: '', type: 'other', category: 'other', companyId: companyId || '', personnelId: personnelId || '', documentYear: new Date().getFullYear() })
      load()
    } catch {
      toast.error('上传失败')
    } finally {
      setUploading(false)
    }
  }

  // ── 编辑保存（v6.x 修复：调 update 而非 create，避免建重复文档；后端按归属/年份/类型重算编号）
  const openEdit = (doc) => {
    setEditDoc(doc)
    setEditMeta({
      name: doc.name, type: doc.type, category: doc.category || 'other',
      companyId: doc.company?._id || doc.company || '', personnelId: doc.personnel?._id || doc.personnel || '',
      documentYear: doc.documentYear || new Date().getFullYear(),
    })
  }
  const handleEditSave = async () => {
    try {
      await documentService.update(editDoc._id, {
        name: editMeta.name, type: editMeta.type, category: editMeta.category,
        company: editMeta.companyId || undefined, personnel: editMeta.personnelId || undefined,
        documentYear: editMeta.documentYear,
      })
      toast.success('已保存（编号已按归属/年份/类型自动更新）')
      setEditDoc(null)
      load()
    } catch {
      toast.error('保存失败')
    }
  }

  // ── 删除 ──
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await documentService.delete(deleteTarget._id)
      setDocuments((ds) => ds.filter((d) => d._id !== deleteTarget._id))
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget._id); return n })
      toast.success('文档已删除')
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }
  const handleBulkDelete = async () => {
    if (selected.size === 0) { toast.error('请先选择文档'); return }
    if (!window.confirm(`确定删除选中的 ${selected.size} 个文档？此操作不可撤销。`)) return
    const ids = [...selected]
    setDeleting(true)
    try {
      await Promise.all(ids.map((id) => documentService.delete(id).catch(() => {})))
      setDocuments((ds) => ds.filter((d) => !selected.has(d._id)))
      setSelected(new Set())
      toast.success(`已删除 ${ids.length} 个文档`)
    } catch {
      toast.error('批量删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // ── 导出 ──
  const handleExportCsv = () => {
    const headers = ['编号', '名称', '类型', '分类', '归属', '关联公司', '关联人员', '年份', '创建日期', '到期日', '来源', '文件URL']
    const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const rows = filtered.map((d) => [
      d.docNumber, d.name, d.type, d.category, d.scope,
      d.company?.name || '', d.personnel?.name || '', d.documentYear || '',
      d.createdAt ? (d.createdAt.split ? d.createdAt.split('T')[0] : d.createdAt) : '',
      d.expiresAt ? (d.expiresAt.split ? d.expiresAt.split('T')[0] : d.expiresAt) : '',
      d.source?.label || '', d.fileUrl || '',
    ].map(esc).join(','))
    const csv = '﻿' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `FILE_MANIFEST_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('清单已导出 (Excel 可打开)')
  }
  const handleExportZip = async () => {
    const toExport = selected.size > 0 ? documents.filter((d) => selected.has(d._id)) : filtered
    const withFiles = toExport.filter((d) => d.fileUrl)
    if (withFiles.length === 0) { toast.error('没有可导出的文件'); return }

    const isMockEnv = import.meta.env.VITE_USE_MOCK !== 'false'
    if (isMockEnv || isDemo) {
      try {
        const zip = new JSZip()
        const failed = []
        await Promise.all(withFiles.map(async (d) => {
          try {
            const resp = await fetch(d.fileUrl)
            if (!resp.ok) throw new Error(`${resp.status}`)
            const blob = await resp.blob()
            zip.file(d.fileName || d.name || 'file', blob)
          } catch (e) {
            failed.push(d.name)
            zip.file(`${d.fileName || d.name || 'file'}.txt`, `[演示模式] 无法获取文件：${d.fileUrl} (错误: ${e.message})`)
          }
        }))
        const content = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(content)
        const a = document.createElement('a')
        a.href = url
        a.download = `documents_${Date.now()}.zip`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        if (failed.length) {
          toast.success(`已打包 ${withFiles.length - failed.length} 个文件（${failed.length} 个无法获取）`)
        } else {
          toast.success(`已打包 ${withFiles.length} 个文件`)
        }
      } catch (err) {
        toast.error(`ZIP 生成失败: ${err.message}`)
      }
      return
    }

    try {
      const ids = withFiles.map((d) => d._id)
      const qs = ids.length ? `ids=${ids.join(',')}` : new URLSearchParams({ company: companyId || '', personnelId: personnelId || '' }).toString()
      const res = await documentService.exportZip?.(qs)
      if (!res) { toast.error('导出接口不可用'); return }
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `documents_${Date.now()}.zip`; a.click()
      URL.revokeObjectURL(url)
      toast.success('ZIP 已导出')
    } catch {
      toast.error('ZIP 导出失败（需真实后端）')
    }
  }

  const Title = embedded ? 'h3' : 'h2'

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {/* 头部 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={embedded ? 16 : 20} className="text-primary-600" />
          <Title className={embedded ? 'text-sm font-semibold text-ink-2' : 'text-lg font-semibold text-ink'}>
            文档管理{companyId ? '' : personnelId ? '（人员）' : '（全部）'}
          </Title>
          <span className="text-xs text-ink-3">{documents.length} 个</span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button onClick={handleBulkDelete} disabled={deleting} className="flex items-center gap-1 px-3 py-1.5 text-danger hover:bg-danger/10 rounded-lg text-sm">
                <Trash2 size={14} /> 删除({selected.size})
              </button>
              <button onClick={handleExportZip} className="flex items-center gap-1 px-3 py-1.5 text-ink-2 hover:bg-canvas rounded-lg text-sm">
                <FileArchive size={14} /> ZIP({selected.size})
              </button>
            </>
          )}
          {showExport && (
            <button onClick={handleExportCsv} className="flex items-center gap-1 px-3 py-1.5 text-ink-2 hover:bg-canvas rounded-lg text-sm">
              <FileSpreadsheet size={14} /> 导出清单
            </button>
          )}
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Upload size={14} /> 上传
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="搜索名称、编号..." />
        <select className="px-3 py-2 border border-hairline rounded-lg text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">所有类型</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="px-3 py-2 border border-hairline rounded-lg text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">全部分类</option>
          {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {!companyId && !personnelId && (
          <select className="px-3 py-2 border border-hairline rounded-lg text-sm" value={filterScope} onChange={(e) => setFilterScope(e.target.value)}>
            <option value="all">全部归属</option>
            <option value="company">仅公司文件</option>
            <option value="person">仅个人文件</option>
          </select>
        )}
      </div>

      {/* 列表 */}
      {loading ? <LoadingSpinner />
        : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="暂无文档"
            action={<button onClick={() => setShowUpload(true)} className="mt-3 text-primary-600 hover:underline text-sm">+ 上传文档</button>} />
        ) : (
          <div className="space-y-2">
            {/* 表头行 */}
            <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-ink-3 uppercase tracking-wide">
              <div className="col-span-1 text-center">
                {selected.size === filtered.length && filtered.length > 0
                  ? <CheckSquare size={16} className="mx-auto text-primary-600 cursor-pointer" onClick={toggleAll} />
                  : <Square size={16} className="mx-auto text-ink-3 cursor-pointer" onClick={toggleAll} />}
              </div>
              <div className="col-span-2">编号</div>
              <div className="col-span-3">名称</div>
              <div className="col-span-2">分类</div>
              <div className="col-span-1">类型</div>
              <div className="col-span-2">关联 / 归属</div>
              <div className="col-span-1 text-right">日期</div>
            </div>

            {filtered.map((doc) => {
              const cat = DOC_CATEGORY_LABELS[doc.category] || '其他'
              const isSelected = selected.has(doc._id)
              const exp = docExpiryStatus(doc)
              return (
                <div key={doc._id}
                  className={`group bg-surface rounded-xl border shadow-sm p-4 hover:shadow-md transition-all ${isSelected ? 'border-primary-400 bg-primary-50' : 'border-hairline'}`}>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 no-nav" onClick={(e) => e.stopPropagation()}>
                      {isSelected
                        ? <CheckSquare size={18} className="text-primary-600 cursor-pointer" onClick={() => toggleSelect(doc._id)} />
                        : <Square size={18} className="text-ink-3 cursor-pointer" onClick={() => toggleSelect(doc._id)} />}
                    </div>
                    <div className="p-2 bg-canvas rounded-lg shrink-0"><FileText size={18} className="text-ink-3" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-ink-3">{doc.docNumber || '-'}</span>
                        <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SCOPE_CLS[doc.scope] || SCOPE_CLS.company}`}>{SCOPE_LABELS[doc.scope] || '公司文件'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 items-center text-xs text-ink-3">
                        <span className="px-2 py-0.5 rounded-full border bg-canvas">{cat}</span>
                        <span>{DOC_TYPE_LABELS[doc.type] || doc.type || '-'}</span>
                        {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                        {exp && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${exp.cls}`}>{exp.label}</span>}
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
                        <SourceBadge doc={doc} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs text-ink-3 hidden sm:block">{formatDate(doc.createdAt)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-nav">
                        {doc.fileUrl && (
                          <button onClick={() => setPreviewDoc(doc)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="预览">
                            <Eye size={14} />
                          </button>
                        )}
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="下载">
                            <Download size={14} />
                          </a>
                        )}
                        <button onClick={() => openEdit(doc)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-info/10 rounded-lg" title="编辑">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(doc)} className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {(!doc.fileUrl) && (
                    <p className="text-[11px] text-ink-3 mt-1 ml-12">无实体文件（仅元数据）</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* 上传 Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="上传文档" size="md">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>选择文件（可多选批量上传）</label>
            <input type="file" multiple className={inputClass} onChange={(e) => setUploadFiles([...e.target.files])} />
            {uploadFiles.length > 0 && <p className="text-xs text-ink-3 mt-1">已选 {uploadFiles.length} 个文件</p>}
          </div>
          <FormField label="文档名称" hint={uploadFiles.length > 1 ? '留空则使用各文件原名' : ''}>
            <input className={inputClass} value={uploadMeta.name} onChange={(e) => setUploadMeta({ ...uploadMeta, name: e.target.value })} placeholder="例如：周年申报表" />
          </FormField>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="分类">
              <select className={inputClass} value={uploadMeta.category} onChange={(e) => setUploadMeta({ ...uploadMeta, category: e.target.value })}>
                {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </FormField>
            <FormField label="类型">
              <select className={inputClass} value={uploadMeta.type} onChange={(e) => setUploadMeta({ ...uploadMeta, type: e.target.value })}>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="年份">
              <input type="number" className={inputClass} value={uploadMeta.documentYear}
                onChange={(e) => setUploadMeta({ ...uploadMeta, documentYear: Number(e.target.value) })} />
            </FormField>
            <FormField label="关联公司">
              <select className={inputClass} value={uploadMeta.companyId}
                onChange={(e) => setUploadMeta({ ...uploadMeta, companyId: e.target.value, personnelId: '' })}>
                <option value="">无</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="关联人员" hint="一人可兼职多公司">
              <select className={inputClass} value={uploadMeta.personnelId}
                onChange={(e) => setUploadMeta({ ...uploadMeta, personnelId: e.target.value, companyId: '' })}>
                <option value="">无</option>
                {personnel.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <p className="text-[11px] text-ink-3">编号将按「归属码-年份-类型码-序号」自动生成；编辑归属/年份/类型会触发重算。</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 编辑 Modal */}
      <Modal isOpen={!!editDoc} onClose={() => setEditDoc(null)} title="编辑文档" size="md">
        {editDoc && (
          <div className="space-y-4">
            <FormField label="文档名称">
              <input className={inputClass} value={editMeta.name} onChange={(e) => setEditMeta({ ...editMeta, name: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField label="分类">
                <select className={inputClass} value={editMeta.category} onChange={(e) => setEditMeta({ ...editMeta, category: e.target.value })}>
                  {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </FormField>
              <FormField label="类型">
                <select className={inputClass} value={editMeta.type} onChange={(e) => setEditMeta({ ...editMeta, type: e.target.value })}>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="年份">
                <input type="number" className={inputClass} value={editMeta.documentYear}
                  onChange={(e) => setEditMeta({ ...editMeta, documentYear: Number(e.target.value) })} />
              </FormField>
              <FormField label="关联公司">
                <select className={inputClass} value={editMeta.companyId}
                  onChange={(e) => setEditMeta({ ...editMeta, companyId: e.target.value, personnelId: '' })}>
                  <option value="">无</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="关联人员" hint="一人可兼职多公司">
                <select className={inputClass} value={editMeta.personnelId}
                  onChange={(e) => setEditMeta({ ...editMeta, personnelId: e.target.value, companyId: '' })}>
                  <option value="">无</option>
                  {personnel.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </FormField>
            </div>
            <div className="bg-canvas rounded-lg p-3 text-xs text-ink-3">
              当前编号：<span className="font-mono">{editDoc.docNumber}</span>
              <br />保存后，若改动「归属公司 / 人员 / 类型 / 年份」，编号将自动重算。
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditDoc(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
              <button onClick={handleEditSave} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">保存</button>
            </div>
          </div>
        )}
      </Modal>

      {/* 预览 Modal */}
      <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name || '预览'} size="lg">
        {previewDoc && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-ink-3 flex-wrap">
              <span className="font-mono">{previewDoc.docNumber}</span>
              <span>{DOC_TYPE_LABELS[previewDoc.type] || previewDoc.type}</span>
              {previewDoc.fileSize && <span>{(previewDoc.fileSize / 1024).toFixed(0)} KB</span>}
            </div>
            {/\.pdf$/i.test(previewDoc.fileUrl || '') ? (
              <iframe src={previewDoc.fileUrl} title="preview" className="w-full h-[60vh] rounded-lg border border-hairline" />
            ) : /\.(png|jpe?g|gif|webp)$/i.test(previewDoc.fileUrl || '') ? (
              <img src={previewDoc.fileUrl} alt={previewDoc.name} className="max-h-[60vh] mx-auto rounded-lg" />
            ) : (
              <div className="text-center py-8">
                <p className="text-ink-3 text-sm">此文件类型不支持内联预览。</p>
                <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm mt-3 inline-flex items-center gap-1">
                  <Download size={14} /> 下载 / 打开
                </a>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">关闭</button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="删除文档" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">确定删除「{deleteTarget?.name}」？此操作不可撤销。</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50">删除</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
