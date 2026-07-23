import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { companyService, personnelService, documentService, taskService } from '../services/index.js'
import { buildCtcDocName } from '../utils/helpers'
import { generateCtcPdf } from '../utils/ctcPdf'
import { FormField, inputClass } from './UIHelpers'
import api from '../services/api.js'

const OWNER_TYPES = [
  { key: 'company', label: '公司' },
  { key: 'personnel', label: '人员' },
]

function firstId(ref) {
  if (!ref) return ''
  if (typeof ref === 'string') return ref
  return ref._id || ''
}

export default function SignTaskForm({
  initialDocument = null,
  initialCompanyId = '',
  initialPersonnelId = '',
  sourceLabel = '来自 [签署任务]',
  onSuccess,
  onCancel,
}) {
  const [companies, setCompanies] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [documents, setDocuments] = useState([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [ctcDownload, setCtcDownload] = useState(null)

  const inferOwnerType = () => {
    if (initialCompanyId) return 'company'
    if (initialPersonnelId) return 'personnel'
    if (initialDocument?.company) return 'company'
    if (initialDocument?.personnel) return 'personnel'
    return 'company'
  }

  const [form, setForm] = useState({
    ownerType: inferOwnerType(),
    companyId: initialCompanyId || firstId(initialDocument?.company) || '',
    personnelId: initialPersonnelId || firstId(initialDocument?.personnel) || '',
    documentId: initialDocument?._id || '',
    responsiblePerson: '',
    dueDate: '',
    isCTC: false,
    ctcFullName: '',
    ctcTitle: '',
    ctcMembershipNo: '',
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [coRes, peRes, docRes] = await Promise.all([
          companyService.getAll().catch(() => ({ data: { data: [] } })),
          personnelService.getAll().catch(() => ({ data: { data: [] } })),
          documentService.getAll().catch(() => ({ data: { data: [] } })),
        ])
        if (cancelled) return
        setCompanies(coRes.data?.data || [])
        setPersonnel(peRes.data?.data || [])
        setDocuments(docRes.data?.data || [])
      } catch {
        toast.error('加载选项失败')
      } finally {
        if (!cancelled) setLoadingRefs(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const set = useCallback((k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
  }, [])

  const visibleDocuments = documents.filter(d => {
    if (form.ownerType === 'company') return firstId(d.company) === form.companyId
    return firstId(d.personnel) === form.personnelId
  })

  const selectedDoc = documents.find(d => d._id === form.documentId)

  const handleSubmit = async () => {
    const errs = {}
    if (!form.companyId && !form.personnelId) errs.owner = '请选择关联公司或关联人员'
    if (form.ownerType === 'company' && !form.companyId) errs.companyId = '请选择关联公司'
    if (form.ownerType === 'personnel' && !form.personnelId) errs.personnelId = '请选择关联人员'
    if (!form.documentId) errs.documentId = '请选择要签署的文件'
    if (form.isCTC) {
      if (!form.ctcFullName.trim()) errs.ctcFullName = '请填写 Full Name'
      if (!form.ctcTitle.trim()) errs.ctcTitle = '请填写 Professional Title'
      if (!form.ctcMembershipNo.trim()) errs.ctcMembershipNo = '请填写 Membership No.'
    } else {
      if (!form.responsiblePerson.trim()) errs.responsiblePerson = '请填写签署人'
    }
    if (!form.dueDate) errs.dueDate = '请选择截止日期'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const company = companies.find(c => c._id === form.companyId)
      const person = personnel.find(p => p._id === form.personnelId)
      const coRef = company ? { _id: company._id, name: company.name, registrationNumber: company.registrationNumber } : undefined
      const peRef = person ? { _id: person._id, name: person.name } : undefined
      const ownerName = company?.name || person?.name || '未关联'

      // 1) 源文档置为待签状态（不再新建"假签"文档，避免闭环出现 3 份文件）
      if (selectedDoc?._id) {
        await documentService.update(selectedDoc._id, {
          signStatus: form.isCTC ? 'pending_ctc' : 'pending_sign',
        }).catch(() => {})
      }

      // 2) 创建签署 Task，关联源文档（签署闭环的单一真源）
      const { data: tRes } = await taskService.create({
        title: `${form.isCTC ? '[CTC] ' : ''}签署：${ownerName}`,
        type: 'signing',
        priority: 'high',
        status: 'pending',
        taskSource: 'dashboard',
        isCTC: form.isCTC,
        dueDate: form.dueDate,
        responsiblePerson: form.isCTC ? form.ctcFullName.trim() : form.responsiblePerson.trim(),
        company: coRef,
        personnel: peRef,
        sourceDocumentId: selectedDoc?._id || undefined,
        ctcFullName: form.isCTC ? form.ctcFullName.trim() : undefined,
        ctcTitle: form.isCTC ? form.ctcTitle.trim() : undefined,
        ctcMembershipNo: form.isCTC ? form.ctcMembershipNo.trim() : undefined,
        hasAttachment: false,
        description: form.isCTC
          ? `由 ${sourceLabel} 发起的 CTC 签署任务。已生成带 CTC 章的 PDF，请下载后由专业人士签字并扫描上传完成。`
          : `由 ${sourceLabel} 发起的签署任务，源文件已置为待签；完成上传签署件后归档。`,
      }).catch(() => ({ data: { data: null } }))

      if (!tRes?.data?._id) throw new Error('创建签署任务失败')

      // 3) CTC：前端生成带章 PDF 供下载（不入库）；保留弹窗内下载链接
      if (form.isCTC && selectedDoc) {
        // 真实模式走鉴权 view 路由取字节（跨域/私有桶均可）；演示模式回退 fileUrl
        let pdfBytes
        const isMockEnv = import.meta.env.VITE_USE_MOCK !== 'false'
        if (isMockEnv && selectedDoc.fileUrl) {
          const res = await fetch(selectedDoc.fileUrl)
          if (!res.ok) throw new Error('下载原文件失败')
          pdfBytes = await res.arrayBuffer()
        } else {
          const res = await api.get(`/api/documents/${selectedDoc._id}/view`, { responseType: 'arraybuffer' })
          pdfBytes = res.data
        }
        const ctcBytes = await generateCtcPdf(pdfBytes, {
          fullName: form.ctcFullName.trim(),
          professionalTitle: form.ctcTitle.trim(),
          membershipNo: form.ctcMembershipNo.trim(),
        })
        const blob = new Blob([ctcBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setCtcDownload({ url, name: buildCtcDocName(selectedDoc.name || 'document.pdf', true) })
        toast.success('CTC 盖章件已生成，请下载后签字再上传完成')
        return
      }

      toast.success('签署任务已创建，源文件已置为待签')
      onSuccess?.()
    } catch (err) {
      toast.error(err?.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormField label="关联对象" error={errors.owner}>
        <div className="flex gap-4">
          {OWNER_TYPES.map(t => (
            <label key={t.key} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={form.ownerType === t.key}
                onChange={() => set('ownerType', t.key)}
                disabled={loadingRefs}
              /> {t.label}
            </label>
          ))}
        </div>
      </FormField>

      {form.ownerType === 'company' && (
        <FormField label="关联公司" error={errors.companyId}>
          <select className={inputClass} value={form.companyId} onChange={e => { set('companyId', e.target.value); set('documentId', '') }} disabled={loadingRefs}>
            <option value="">请选择公司</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </FormField>
      )}

      {form.ownerType === 'personnel' && (
        <FormField label="关联人员" error={errors.personnelId}>
          <select className={inputClass} value={form.personnelId} onChange={e => { set('personnelId', e.target.value); set('documentId', '') }} disabled={loadingRefs}>
            <option value="">请选择人员</option>
            {personnel.map(p => <option key={p._id} value={p._id}>{p.name || p.englishName || p._id}</option>)}
          </select>
        </FormField>
      )}

      <FormField label="选择要签署的文件" error={errors.documentId}>
        <select className={inputClass} value={form.documentId} onChange={e => set('documentId', e.target.value)} disabled={loadingRefs || (!form.companyId && !form.personnelId)}>
          <option value="">{form.companyId || form.personnelId ? '请选择文件' : '请先选择公司或人员'}</option>
          {visibleDocuments.map(d => <option key={d._id} value={d._id}>{d.name} {d.docNumber ? `(${d.docNumber})` : ''}</option>)}
        </select>
      </FormField>

      <FormField label="是否为 CTC 文件？">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={!form.isCTC} onChange={() => set('isCTC', false)} /> 否（普通签署）
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={form.isCTC} onChange={() => set('isCTC', true)} /> 是（CTC）
          </label>
        </div>
      </FormField>

      {!form.isCTC && (
        <FormField label="签署人" error={errors.responsiblePerson}>
          <input className={inputClass} value={form.responsiblePerson} onChange={e => set('responsiblePerson', e.target.value)} placeholder="例如：张三" />
        </FormField>
      )}

      {form.isCTC && (
        <div className="space-y-3 border border-hairline rounded-lg p-3 bg-canvas">
          <p className="text-sm font-medium text-ink-2">CTC 声明信息</p>
          <FormField label="Full Name in Block Letters" required error={errors.ctcFullName}>
            <input className={inputClass} value={form.ctcFullName} onChange={e => set('ctcFullName', e.target.value)} placeholder="CHAN TAI MAN" />
          </FormField>
          <FormField label="Professional Title" required error={errors.ctcTitle}>
            <input className={inputClass} value={form.ctcTitle} onChange={e => set('ctcTitle', e.target.value)} placeholder="Solicitor / CPA" />
          </FormField>
          <FormField label="Membership No. / Practising Certificate No." required error={errors.ctcMembershipNo}>
            <input className={inputClass} value={form.ctcMembershipNo} onChange={e => set('ctcMembershipNo', e.target.value)} placeholder="M123456" />
          </FormField>
        </div>
      )}

      <FormField label="截止日期" error={errors.dueDate}>
        <input type="date" className={inputClass} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
      </FormField>

      {form.documentId && (
        <p className="text-xs text-ink-3">
          {form.isCTC
            ? '将生成 CTC 盖章件供下载签字，源文件保持待签；完成后上传签字件即归档 (ctc) 文档。'
            : '源文件将置为待签；完成后上传签署件即就地更新该文件（最终仅 1 份）。'}
        </p>
      )}

      {ctcDownload && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
          <p className="mb-2 text-ink">CTC 盖章件已生成，请下载后由专业人士签字，再到该任务的「完成」页上传签字件：</p>
          <a href={ctcDownload.url} download={ctcDownload.name} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Download size={14} /> 下载 CTC 盖章件（{ctcDownload.name}）
          </a>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={ctcDownload ? onSuccess : onCancel} className="px-4 py-2 text-sm text-ink border border-hairline rounded-lg hover:bg-canvas">
          {ctcDownload ? '完成并关闭' : '取消'}
        </button>
        {!ctcDownload && (
          <button type="button" onClick={handleSubmit} disabled={saving || loadingRefs} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
            {saving ? '提交中...' : '创建签署任务'}
          </button>
        )}
      </div>
    </div>
  )
}
