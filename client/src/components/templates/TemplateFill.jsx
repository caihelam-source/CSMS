import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Printer, Download, ExternalLink, AlertTriangle, Building2, Sparkles, Copy } from 'lucide-react'
import { templateService, companyService, personnelService, meetingService } from '../../services/index.js'
import { LoadingSpinner, labelClass } from '../UIHelpers'
import SchemaDocRenderer from '../../schemaDoc/SchemaDocRenderer'
import {
  createInitialData,
  isFieldVisible,
  validateSchemaData,
  resolveFileName,
} from '../../schemaDoc/schemaUtils'
import { exportDocxFromElement, buildDocxFileName, revokeBlobUrl } from '../../utils/docxFromDom'
import { serializePreviewToHtml, copyHtmlToClipboard } from '../../utils/copyPreviewHtml'
import FieldEditor from './fieldEditors'

/**
 * 从归一化响应中提取对象载荷（兼容多种包裹形状）。
 * @param {*} res 服务层返回
 * @param {string} key 期望的键名
 * @returns {object|null}
 */
function pickObject(res, key) {
  const payload = res?.data ?? res
  if (!payload || typeof payload !== 'object') return null
  if (payload[key] && typeof payload[key] === 'object') return payload[key]
  const inner = payload.data
  if (inner && typeof inner === 'object') {
    if (inner[key] && typeof inner[key] === 'object') return inner[key]
    return inner
  }
  return payload
}

/**
 * 从归一化响应中提取数组列表（companies / personnel / meetings 通用）。
 * @param {*} res 服务层返回
 * @returns {Array<object>}
 */
function pickList(res) {
  const payload = res?.data ?? res
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.data)) return payload.data.data
  return []
}

/** 提取后端错误消息。 */
function errMsg(e, fallback) {
  return e?.response?.data?.message || e?.message || fallback
}

/** 确保文件名带 .docx 后缀。 */
function ensureDocxExt(name) {
  const base = String(name || '').trim()
  if (!base) return ''
  return /\.docx$/i.test(base) ? base : `${base}.docx`
}

/**
 * TemplateFill — 模板填写视图（左表单 / 右 A4 预览），支持打印、Word 导出与复制 HTML。
 *
 * @param {object} props
 * @param {object} props.template 列表传入的模板对象（至少含 _id）
 * @param {()=>void} props.onBack 返回列表回调（保留给上层，用于工具条外的返回入口）
 * @returns {JSX.Element}
 */
const TemplateFill = ({ template }) => {
  const [full, setFull] = useState(template && template.docSchema ? template : null)
  const [loading, setLoading] = useState(!(template && template.docSchema))
  const [loadError, setLoadError] = useState('')

  const [companies, setCompanies] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [resolving, setResolving] = useState(false)

  // 董事 / 会议 选择器数据
  const [directors, setDirectors] = useState([])
  const [meetings, setMeetings] = useState([])
  const [directorIds, setDirectorIds] = useState([])
  const [meetingId, setMeetingId] = useState('')

  const [data, setData] = useState({})
  const [prefilledKeys, setPrefilledKeys] = useState(() => new Set())

  const [exporting, setExporting] = useState(false)
  const [downloadInfo, setDownloadInfo] = useState(null) // { fileName, blobUrl }

  const previewRef = useRef(null)
  const blobUrlRef = useRef('')

  /* ---------------- 数据加载 ---------------- */

  useEffect(() => {
    let alive = true
    const id = template?._id
    if (!id) {
      setLoading(false)
      setLoadError('缺少模板标识，无法加载。')
      return () => { alive = false }
    }
    setLoading(true)
    templateService
      .getOne(id)
      .then((res) => {
        if (!alive) return
        const detail = pickObject(res, 'template')
        const merged = detail && detail.docSchema ? detail : (template?.docSchema ? template : detail)
        if (!merged || !merged.docSchema) {
          setLoadError('该模板尚未配置 docSchema，无法填写。')
          setFull(merged || template || null)
        } else {
          setLoadError('')
          setFull(merged)
        }
      })
      .catch((e) => {
        if (!alive) return
        if (template?.docSchema) {
          setFull(template)
          setLoadError('')
        } else {
          setLoadError(errMsg(e, '加载模板详情失败'))
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [template])

  useEffect(() => {
    let alive = true
    // 服务层历史上同时存在 list / getAll 两种命名，做一次兼容取用
    const listFn = typeof companyService.getAll === 'function'
      ? companyService.getAll.bind(companyService)
      : companyService.list?.bind(companyService)
    if (!listFn) return () => { alive = false }
    Promise.resolve(listFn({ limit: 500 }))
      .then((res) => { if (alive) setCompanies(pickList(res)) })
      .catch(() => { if (alive) setCompanies([]) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.resolve(personnelService.getAll({ limit: 500 }))
      .then((res) => { if (alive) setDirectors(pickList(res)) })
      .catch(() => { if (alive) setDirectors([]) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.resolve(meetingService.getAll({ limit: 500 }))
      .then((res) => { if (alive) setMeetings(pickList(res)) })
      .catch(() => { if (alive) setMeetings([]) })
    return () => { alive = false }
  }, [])

  const docSchema = full?.docSchema || null

  // docSchema 就绪后生成初值
  useEffect(() => {
    if (!docSchema) return
    setData(createInitialData(docSchema))
    setPrefilledKeys(new Set())
  }, [docSchema])

  // 卸载时释放 blob
  useEffect(() => () => { if (blobUrlRef.current) revokeBlobUrl(blobUrlRef.current) }, [])

  /* ---------------- 交互 ---------------- */

  const setFieldValue = useCallback((key, value) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setPrefilledKeys((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  /**
   * 调用后端 resolve 取预填值并合并进表单。
   * 合并当前 公司 / 董事 / 会议 选择，一并透传给后端。
   * @param {{companyId?:string, directorIds?:string[], meetingId?:string}} opts 解析参数
   */
  const runResolve = useCallback(async (opts) => {
    const id = full?._id
    if (!id) return
    setResolving(true)
    try {
      const res = await templateService.resolve(id, opts)
      const payload = pickObject(res, 'values') || {}
      const values = payload.values && typeof payload.values === 'object' ? payload.values : payload
      const keys = Object.keys(values || {}).filter((k) => values[k] !== undefined && values[k] !== null && values[k] !== '')
      if (keys.length === 0) {
        toast('未获取到可自动预填的字段', { icon: 'ℹ️' })
        return
      }
      setData((prev) => {
        const next = { ...prev }
        keys.forEach((k) => { next[k] = values[k] })
        return next
      })
      setPrefilledKeys(new Set(keys))
      toast.success(`已自动预填 ${keys.length} 个字段`)
    } catch (e) {
      toast.error(errMsg(e, '自动预填失败'))
    } finally {
      setResolving(false)
    }
  }, [full])

  /**
   * 选择公司 → 重新解析预填值。
   * @param {string} nextId 公司 _id
   */
  const handleCompanyChange = (nextId) => {
    setCompanyId(nextId)
    runResolve({ companyId: nextId, directorIds, meetingId })
  }

  /**
   * 选择董事（多选）→ 重新解析预填值。
   * @param {string[]} nextIds 董事 _id 数组
   */
  const handleDirectorsChange = (nextIds) => {
    setDirectorIds(nextIds)
    runResolve({ companyId, directorIds: nextIds, meetingId })
  }

  /**
   * 选择会议 → 重新解析预填值。
   * @param {string} nextId 会议 _id
   */
  const handleMeetingChange = (nextId) => {
    setMeetingId(nextId)
    runResolve({ companyId, directorIds, meetingId: nextId })
  }

  /** 复制预览区 HTML 到剪贴板（任何可填写角色均可，不受 canEdit 限制）。 */
  const handleCopyHtml = async () => {
    if (!previewRef.current) {
      toast.error('预览尚未就绪')
      return
    }
    const html = serializePreviewToHtml(previewRef.current)
    if (!html) {
      toast.error('无法生成预览 HTML')
      return
    }
    const ok = await copyHtmlToClipboard(html)
    if (ok) toast.success('已复制预览 HTML，可粘贴到 Word')
    else toast.error('复制失败，请手动选择复制')
  }

  const visibleFields = useMemo(() => {
    const fields = Array.isArray(docSchema?.fields) ? docSchema.fields : []
    return fields.filter((f) => f && f.key != null && isFieldVisible(f, data))
  }, [docSchema, data])

  const errors = useMemo(() => {
    if (!docSchema) return []
    const result = validateSchemaData(docSchema, data)
    return Array.isArray(result) ? result.filter(Boolean) : []
  }, [docSchema, data])

  const hasErrors = errors.length > 0

  // 仅当模板 variables 含对应 source 时显示董事 / 会议选择器
  const vars = useMemo(() => Array.isArray(full?.variables) ? full.variables : [], [full])
  const hasDirectorVar = vars.some((v) => v && v.source === 'director')
  const hasMeetingVar = vars.some((v) => v && v.source === 'meeting')

  const selectedCompanyName = useMemo(() => {
    const co = companies.find((c) => c._id === companyId)
    return co ? (co.name || co.nameChinese || '') : ''
  }, [companies, companyId])

  /** 计算导出文件名。 */
  const computeFileName = useCallback(() => {
    const pattern = docSchema?.meta?.fileNamePattern
    const resolved = ensureDocxExt(resolveFileName(pattern, data))
    if (resolved) return resolved
    return buildDocxFileName(
      selectedCompanyName || full?.name || '文档',
      full?.presetKey || full?._id || 'template',
    )
  }, [docSchema, data, selectedCompanyName, full])

  /** 导出 Word：生成 blob → 自动下载 + 保留可见下载入口。 */
  const handleExport = async () => {
    if (!previewRef.current) {
      toast.error('预览尚未就绪')
      return
    }
    setExporting(true)
    try {
      const fileName = computeFileName()
      const result = await exportDocxFromElement(previewRef.current, fileName)
      const url = result?.blobUrl || ''
      const finalName = result?.fileName || fileName

      if (blobUrlRef.current && blobUrlRef.current !== url) revokeBlobUrl(blobUrlRef.current)
      blobUrlRef.current = url

      // ① 自动触发下载（部分预览面板会拦截，故还有 ②③ 两条兜底通道）
      if (url && typeof document !== 'undefined') {
        const a = document.createElement('a')
        a.href = url
        a.download = finalName
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      setDownloadInfo({ fileName: finalName, blobUrl: url })
      toast.success('Word 已生成')
    } catch (e) {
      toast.error(errMsg(e, '导出失败'))
    } finally {
      setExporting(false)
    }
  }

  /* ---------------- 渲染 ---------------- */

  if (loading) return <LoadingSpinner text="加载模板中..." />

  if (loadError || !docSchema) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-8 text-center">
        <AlertTriangle size={28} className="mx-auto mb-3 text-warning" />
        <p className="text-sm text-ink-2">{loadError || '该模板缺少 docSchema，无法填写。'}</p>
      </div>
    )
  }

  const exportDisabled = exporting || hasErrors
  const exportTitle = hasErrors ? '请先修正下方校验错误后再导出' : '导出为 Word 文档'

  return (
    <div className="space-y-4">
      {/* 顶部工具条 */}
      <div className="bg-surface border border-hairline rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{full.name}</p>
          {full.description && <p className="text-xs text-ink-3 truncate">{full.description}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium"
          >
            <Printer size={15} /> 打印
          </button>
          <button
            type="button"
            onClick={handleCopyHtml}
            className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium"
          >
            <Copy size={15} /> 复制 HTML
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exportDisabled}
            title={exportTitle}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> {exporting ? '导出中...' : '导出 Word'}
          </button>
        </div>

        {/* 导出后的三条下载通道（②可见链接 ③新标签打开） */}
        {downloadInfo?.blobUrl && (
          <div className="w-full flex flex-wrap items-center gap-3 pt-2 border-t border-hairline">
            <a
              href={downloadInfo.blobUrl}
              download={downloadInfo.fileName}
              className="text-sm text-primary-600 underline hover:text-primary-700 break-all"
            >
              点此下载 {downloadInfo.fileName}
            </a>
            <button
              type="button"
              onClick={() => window.open(downloadInfo.blobUrl, '_blank', 'noopener')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-hairline rounded-lg text-xs text-ink-2 hover:bg-canvas"
            >
              <ExternalLink size={13} /> 新标签打开
            </button>
          </div>
        )}
      </div>

      {/* 左表单 / 右预览 */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* 左栏 45% */}
        <div className="w-full lg:w-[45%] shrink-0 space-y-4">
          <div className="bg-surface border border-hairline rounded-xl p-4 space-y-4">
            {/* 公司选择器 */}
            <div>
              <label className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><Building2 size={14} /> 关联公司（自动预填）</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                disabled={resolving}
              >
                <option value="">-- 不关联，手动填写 --</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}{c.nameChinese ? `（${c.nameChinese}）` : ''}
                  </option>
                ))}
              </select>
              {resolving && <p className="mt-1 text-xs text-ink-3">正在获取公司数据…</p>}
              {!resolving && prefilledKeys.size > 0 && (
                <p className="mt-1 text-xs text-green-700 inline-flex items-center gap-1">
                  <Sparkles size={12} /> 已自动预填 {prefilledKeys.size} 个字段（绿色输入框）
                </p>
              )}
            </div>

            {/* 董事选择器（仅当模板 variables 含 source:'director'） */}
            {hasDirectorVar && (
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> 选择董事（自动预填董事信息）</span>
                </label>
                <select
                  multiple
                  className="w-full px-3 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={directorIds}
                  onChange={(e) => handleDirectorsChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  disabled={resolving}
                >
                  {directors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}{d.nameChinese ? `（${d.nameChinese}）` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-3">按住 Ctrl / ⌘ 可多选</p>
              </div>
            )}

            {/* 会议选择器（仅当模板 variables 含 source:'meeting'） */}
            {hasMeetingVar && (
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> 选择会议（自动预填会议信息）</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={meetingId}
                  onChange={(e) => handleMeetingChange(e.target.value)}
                  disabled={resolving}
                >
                  <option value="">-- 不关联，手动填写 --</option>
                  {meetings.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 字段编辑区 */}
            <div className="space-y-4 pt-2 border-t border-hairline">
              {visibleFields.length === 0 && (
                <p className="text-sm text-ink-3 text-center py-4">该模板未定义可填写字段。</p>
              )}
              {visibleFields.map((field) => {
                const highlight = prefilledKeys.has(field.key)
                return (
                  <div key={field.key}>
                    <label className={labelClass}>
                      {field.label || field.key}
                      {field.required && <span className="text-danger ml-0.5">*</span>}
                      {highlight && (
                        <span className="ml-2 text-xs font-normal text-green-700">已自动预填</span>
                      )}
                    </label>
                    <FieldEditor
                      field={field}
                      value={data[field.key]}
                      onChange={(next) => setFieldValue(field.key, next)}
                      highlight={highlight}
                    />
                    {field.hint && <p className="mt-1 text-xs text-ink-3">{field.hint}</p>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 校验提示区 */}
          {hasErrors ? (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <p className="text-sm font-medium text-danger mb-2 inline-flex items-center gap-1.5">
                <AlertTriangle size={15} /> 校验未通过（{errors.length} 项）
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((msg, i) => (
                  <li key={i} className="text-xs text-danger">{msg}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3">
              <p className="text-sm text-success">✓ 校验通过，可导出 Word。</p>
            </div>
          )}
        </div>

        {/* 右栏 55% —— A4 预览 */}
        <div className="w-full lg:w-[55%] lg:sticky lg:top-4">
          <div className="bg-white border border-hairline rounded-xl overflow-auto max-h-[calc(100vh-160px)] p-4">
            <div ref={previewRef} className="bg-white">
              <SchemaDocRenderer docSchema={docSchema} data={data} mode="preview" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateFill
