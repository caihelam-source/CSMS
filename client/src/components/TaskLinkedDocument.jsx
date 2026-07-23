import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FileText, Eye, Download, Pencil, Building2, User, Paperclip } from 'lucide-react'
import { documentService, companyService, personnelService } from '../services/index.js'
import { fetchDocBlobUrl, downloadDoc, isPdfDoc, isImageDoc } from '../utils/fileAccess'
import { formatDate } from '../utils/helpers'
import { LoadingSpinner, FormField, inputClass } from './UIHelpers'
import Modal from './Modal'

const DOC_TYPE_LABELS = {
  minutes: '会议纪要', resolution: '决议书', agreement: '协议书',
  form: '表单', certificate: '证明书', return: '申报表', notice: '通知书',
  annual_report: '周年申报', financial_statement: '财务报表',
  id_document: '身份证件', passport: '护照', proof_of_address: '地址证明',
  board_resolution: '董事会决议', incorporation_doc: '注册成立书', ctc: 'CTC', other: '其他',
}

const DOC_CATEGORIES = [
  { key: 'establishment', label: '设立文件' },
  { key: 'government', label: '政府往来' },
  { key: 'financial', label: '财务税务' },
  { key: 'banking', label: '银行文件' },
  { key: 'meeting', label: '会议文件' },
  { key: 'other', label: '其他' },
]

export default function TaskLinkedDocument({ documentId, task }) {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [personnel, setPersonnel] = useState([])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editMeta, setEditMeta] = useState({
    name: '', type: 'other', category: 'other', companyId: '', personnelId: '', documentYear: new Date().getFullYear(),
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!documentId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: res } = await documentService.getOne(documentId).catch(() => ({ data: { data: null } }))
      setDoc(res?.data || null)
    } catch {
      toast.error('加载关联文档失败')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    const loadRefs = async () => {
      try {
        const [co, pe] = await Promise.all([
          companyService.getAll().catch(() => ({ data: { data: [] } })),
          personnelService.getAll().catch(() => ({ data: { data: [] } })),
        ])
        if (cancelled) return
        setCompanies(co.data?.data || [])
        setPersonnel(pe.data?.data || [])
      } catch { /* silent */ }
    }
    loadRefs()
    return () => { cancelled = true }
  }, [])

  const openPreview = useCallback(async () => {
    if (!doc) return
    setPreviewOpen(true)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      const url = await fetchDocBlobUrl(doc._id)
      setPreviewUrl(url)
    } catch (e) {
      console.error('预览加载失败:', e)
      setPreviewUrl(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [doc])

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewOpen(false)
    setPreviewLoading(false)
  }, [previewUrl])

  const openEdit = useCallback(() => {
    if (!doc) return
    setEditMeta({
      name: doc.name,
      type: doc.type || 'other',
      category: doc.category || 'other',
      companyId: doc.company?._id || doc.company || '',
      personnelId: doc.personnel?._id || doc.personnel || '',
      documentYear: doc.documentYear || new Date().getFullYear(),
    })
    setEditOpen(true)
  }, [doc])

  const handleEditSave = async () => {
    if (!doc) return
    setSaving(true)
    try {
      await documentService.update(doc._id, {
        name: editMeta.name,
        type: editMeta.type,
        category: editMeta.category,
        company: editMeta.companyId || undefined,
        personnel: editMeta.personnelId || undefined,
        documentYear: editMeta.documentYear,
      })
      toast.success('关联文档已更新（编号已按需重算）')
      setEditOpen(false)
      load()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card"><LoadingSpinner text="加载关联文档..." /></div>
  if (!doc) return null

  const fileSize = doc.fileSize ?? doc.size

  return (
    <>
      <div className="card border border-info/20 bg-info/[0.02]">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-canvas rounded-lg shrink-0"><FileText size={20} className="text-primary-600" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2 flex-wrap">
              关联文档
              {task?.isCTC && <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-danger/10 text-danger">CTC</span>}
              {doc.signStatus && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700">
                  {doc.signStatus}
                </span>
              )}
            </h3>
            <p className="text-sm font-medium mt-1 truncate">{doc.name}</p>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-ink-3">
              {doc.docNumber && <span className="font-mono">{doc.docNumber}</span>}
              <span>{DOC_TYPE_LABELS[doc.type] || doc.type || '-'}</span>
              {fileSize > 0 && <span>{(fileSize / 1024).toFixed(0)} KB</span>}
              <span>{formatDate(doc.createdAt)}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {doc.company && (
                <Link to={`/companies/${doc.company._id || doc.company}`} className="flex items-center gap-0.5 text-primary-600 hover:underline">
                  <Building2 size={11} /> {doc.company.name || doc.company}
                </Link>
              )}
              {doc.personnel && (
                <Link to={`/personnel/${doc.personnel._id || doc.personnel}`} className="flex items-center gap-0.5 text-primary-600 hover:underline">
                  <User size={11} /> {doc.personnel.name || doc.personnel}
                </Link>
              )}
            </div>
            <p className="text-xs text-ink-3 mt-2">
              此文件与任务共享同一文档实体，在此处的预览 / 下载 / 修改与「文档管理」完全同步。
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={openPreview} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="预览">
              <Eye size={16} />
            </button>
            <button onClick={() => downloadDoc(doc)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="下载">
              <Download size={16} />
            </button>
            <button onClick={openEdit} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-info/10 rounded-lg" title="编辑">
              <Pencil size={16} />
            </button>
            <Link to={`/documents`} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="在文档管理中打开">
              <Paperclip size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* 预览 Modal */}
      <Modal isOpen={previewOpen} onClose={closePreview} title={doc.name} size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-ink-3 flex-wrap">
            <span className="font-mono">{doc.docNumber}</span>
            <span>{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
            {fileSize > 0 && <span>{(fileSize / 1024).toFixed(0)} KB</span>}
          </div>
          {previewLoading ? (
            <div className="flex items-center justify-center h-[60vh] text-ink-3">
              <LoadingSpinner /> <span className="ml-2">加载中…</span>
            </div>
          ) : previewUrl && isPdfDoc(doc) ? (
            <iframe src={previewUrl} title="preview" className="w-full h-[60vh] rounded-lg border border-hairline" />
          ) : previewUrl && isImageDoc(doc) ? (
            <img src={previewUrl} alt={doc.name} className="max-h-[60vh] mx-auto rounded-lg" />
          ) : (
            <div className="text-center py-8">
              <p className="text-ink-3 text-sm">此文件类型不支持内联预览，或加载失败。</p>
              <button onClick={() => downloadDoc(doc)} className="btn-secondary text-sm mt-3 inline-flex items-center gap-1">
                <Download size={14} /> 下载 / 打开
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={closePreview} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">关闭</button>
          </div>
        </div>
      </Modal>

      {/* 编辑 Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="编辑关联文档" size="md">
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
              <input type="number" className={inputClass} value={editMeta.documentYear} onChange={(e) => setEditMeta({ ...editMeta, documentYear: Number(e.target.value) })} />
            </FormField>
            <FormField label="关联公司">
              <select className={inputClass} value={editMeta.companyId} onChange={(e) => setEditMeta({ ...editMeta, companyId: e.target.value, personnelId: '' })}>
                <option value="">无</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="关联人员">
              <select className={inputClass} value={editMeta.personnelId} onChange={(e) => setEditMeta({ ...editMeta, personnelId: e.target.value, companyId: '' })}>
                <option value="">无</option>
                {personnel.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="bg-canvas rounded-lg p-3 text-xs text-ink-3">
            当前编号：<span className="font-mono">{doc.docNumber}</span>
            <br />保存后，若改动「归属公司 / 人员 / 类型 / 年份」，编号将自动重算。
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
            <button onClick={handleEditSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
