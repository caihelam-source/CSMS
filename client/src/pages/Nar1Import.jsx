import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  FileUp, AlertTriangle, CheckCircle2, XCircle, Loader2, Building2,
  FileText, RefreshCw, ShieldAlert, ScanLine,
} from 'lucide-react'
import { nar1ImportService } from '../services/index.js'
import { PageHeader, LoadingSpinner } from '../components/UIHelpers'
import { useAuth } from '../contexts/AuthContext.jsx'

const MODE_OPTIONS = [
  { value: 'skip', label: '跳过（不录入）' },
  { value: 'create', label: '仅补缺失' },
  { value: 'overwrite', label: '覆盖已有' },
]

/** 默认模式：失败件与纯扫描件一律跳过；有冲突的也默认跳过，需用户显式选择覆盖 */
const defaultMode = (it) => {
  if (!it.ok || it.needsMultimodal) return 'skip'
  return it.hasConflict ? 'skip' : 'create'
}

export default function Nar1ImportPage() {
  const { canEdit } = useAuth()
  const [engine, setEngine] = useState(null)     // null = 探测中
  const [engineLoading, setEngineLoading] = useState(true)
  const [files, setFiles] = useState([])
  const [phase, setPhase] = useState('idle')     // idle | parsing | review | committing | done
  const [items, setItems] = useState([])
  const [commitResult, setCommitResult] = useState(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  // ── 引擎可用性探测 ──
  const checkEngine = useCallback(async () => {
    setEngineLoading(true)
    try {
      const res = await nar1ImportService.capability()
      setEngine(res?.engine || { ok: false, reason: '未返回引擎状态' })
    } catch (err) {
      setEngine({ ok: false, reason: err?.response?.data?.message || err?.message || '探测失败' })
    } finally {
      setEngineLoading(false)
    }
  }, [])

  useEffect(() => { checkEngine() }, [checkEngine])

  // ── 文件选择 ──
  const addFiles = (list) => {
    const pdfs = Array.from(list || []).filter((f) => /\.pdf$/i.test(f.name))
    if (pdfs.length !== (list ? list.length : 0)) {
      toast('已忽略非 PDF 文件', { icon: '⚠️' })
    }
    if (!pdfs.length) return
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`))
      const merged = [...prev]
      pdfs.forEach((f) => {
        const k = `${f.name}-${f.size}`
        if (!seen.has(k)) { seen.add(k); merged.push(f) }
      })
      return merged
    })
    setPhase('idle')
    setItems([])
    setCommitResult(null)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer?.files)
  }

  // ── 批量解析 ──
  const runParse = async () => {
    if (!files.length) return
    setPhase('parsing')
    setUploadPct(0)
    try {
      const res = await nar1ImportService.parse(files, setUploadPct)
      const list = Array.isArray(res?.results) ? res.results : []
      setItems(list.map((it) => ({ ...it, mode: defaultMode(it) })))
      setPhase('review')
      const okCount = list.filter((i) => i.ok).length
      if (okCount < list.length) {
        toast.error(`${list.length - okCount} 份未能识别，详见列表`)
      } else {
        toast.success(`已识别 ${okCount} 份 NAR1`)
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || '解析失败'
      toast.error(msg)
      setPhase('idle')
    }
  }

  // ── 落库 ──
  const runCommit = async () => {
    const payload = items
      .filter((it) => it.mode !== 'skip' && it.ok)
      .map((it) => ({ id: it.id, fileName: it.fileName, mode: it.mode, result: it.result, storage: it.storage }))
    if (!payload.length) { toast('没有需要导入的项目'); return }
    setPhase('committing')
    try {
      const res = await nar1ImportService.commit(payload)
      setCommitResult(res)
      setPhase('done')
      const s = res?.summary || {}
      toast.success(`导入完成：成功 ${s.imported || 0}，失败 ${s.failed || 0}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || '导入失败')
      setPhase('review')
    }
  }

  const setMode = (id, mode) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, mode } : it)))
  const setAllMode = (mode) => setItems((prev) => prev.map((it) => {
    if (!it.ok) return it
    if (mode === 'overwrite' && it.needsMultimodal) return it // 扫描件无数据，不覆盖
    return { ...it, mode }
  }))

  const reset = () => {
    setFiles([])
    setItems([])
    setCommitResult(null)
    setPhase('idle')
    setUploadPct(0)
  }

  const pendingCount = items.filter((it) => it.ok && it.mode !== 'skip').length
  const conflictCount = items.filter((it) => it.ok && it.hasConflict).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="NAR1 导入"
        subtitle="上传香港公司周年申报表，自动建档公司、董事、秘书与股东"
        icon={FileUp}
        actions={
          phase !== 'idle' && (
            <button onClick={reset} className="btn-secondary flex items-center gap-1.5">
              <RefreshCw size={15} /> 重新开始
            </button>
          )
        }
      />

      {/* 引擎状态 */}
      <div className={`card flex items-start gap-3 ${
        engineLoading ? '' : engine?.ok ? 'border-l-4 border-l-success' : 'border-l-4 border-l-warning'
      }`}>
        {engineLoading ? <Loader2 size={18} className="animate-spin text-ink-3 mt-0.5" />
          : engine?.ok
            ? <CheckCircle2 size={18} className="text-success mt-0.5" />
            : <AlertTriangle size={18} className="text-warning mt-0.5" />}
        <div className="text-sm">
          {engineLoading ? (
            <p className="text-ink-2">正在检测 PDF 解析引擎…</p>
          ) : engine?.ok ? (
            <p className="text-ink-2">
              解析引擎就绪（<span className="font-mono text-xs">{engine.python || 'python3'}</span> + pdfplumber）。
              支持批量上传多份 NAR1。
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-ink-1">PDF 自动解析不可用</p>
              <p className="text-ink-2">{engine?.reason}</p>
              <p className="text-ink-3 text-xs">
                服务端需要 python3 与 pdfplumber。Render 部署请在 buildCommand 中加入依赖安装；
                或联系管理员在本机完成识别后再导入。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 上传区 */}
      {phase === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`card border-2 border-dashed text-center py-10 transition-colors cursor-pointer ${
            dragging ? 'border-primary-500 bg-primary-50/40' : 'border-border'
          }`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        >
          <FileUp size={34} className="mx-auto text-ink-3 mb-3" />
          <p className="font-medium text-ink-1">拖拽 NAR1 文件到这里，或点击选择</p>
          <p className="text-sm text-ink-3 mt-1">支持一次选择多份 PDF（单次最多 20 份，每份 ≤ 30MB）</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
        </div>
      )}

      {files.length > 0 && phase === 'idle' && (
        <div className="card space-y-3">
          <p className="text-sm font-medium text-ink-1">已选择 {files.length} 份文件</p>
          <ul className="text-sm text-ink-2 space-y-1 max-h-48 overflow-auto">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <FileText size={14} className="text-ink-3 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-ink-3 text-xs shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={runParse}
              disabled={!engine?.ok || !canEdit}
              className="btn-primary flex items-center gap-2"
            >
              <ScanLine size={16} /> 开始识别
            </button>
            {!canEdit && <span className="text-xs text-ink-3 self-center">当前角色无编辑权限</span>}
          </div>
        </div>
      )}

      {phase === 'parsing' && (
        <div className="card flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-primary-600" />
          <div className="text-sm">
            <p className="font-medium text-ink-1">正在识别 {files.length} 份 NAR1…</p>
            <p className="text-ink-3 text-xs">每份约需 3-8 秒{uploadPct ? `，上传 ${uploadPct}%` : ''}</p>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {(phase === 'review' || phase === 'committing') && items.length > 0 && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium text-ink-1">识别完成：{items.filter((i) => i.ok).length} / {items.length}</span>
              {conflictCount > 0 && (
                <span className="ml-2 text-warning inline-flex items-center gap-1">
                  <ShieldAlert size={14} /> {conflictCount} 份与现有记录冲突
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {MODE_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => setAllMode(o.value)} className="btn-secondary text-xs px-2 py-1">
                  全部：{o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-3 border-b border-border">
                  <th className="py-2 pr-3 font-medium">公司</th>
                  <th className="py-2 pr-3 font-medium">注册号</th>
                  <th className="py-2 pr-3 font-medium">秘书 / 董事 / 股东</th>
                  <th className="py-2 pr-3 font-medium">状态</th>
                  <th className="py-2 font-medium w-44">导入方式</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-3">
                      {it.ok ? (
                        <>
                          <p className="font-medium text-ink-1">{it.plan?.company?.name}</p>
                          {it.plan?.company?.nameChinese && (
                            <p className="text-xs text-ink-3">{it.plan.company.nameChinese}</p>
                          )}
                          <p className="text-xs text-ink-3 truncate max-w-[240px]">{it.fileName}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-ink-1">{it.fileName}</p>
                          <p className="text-xs text-danger">{it.error}</p>
                        </>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-2">
                      {it.ok ? (it.plan?.company?.registrationNumber || '—') : '—'}
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink-2">
                      {it.ok ? (
                        <div className="space-y-0.5">
                          <p>秘书 {countByRole(it.plan, 'secretary')} · 董事 {countByRole(it.plan, 'director')} · 股东 {countByRole(it.plan, 'shareholder')}</p>
                          <p className="text-ink-3 truncate max-w-[220px]">
                            {[
                              ...it.plan.people.map((p) => p.name || p.nameChinese),
                              ...it.plan.entities.map((e) => e.name),
                            ].filter(Boolean).join('、') || '未识别到人员'}
                          </p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {!it.ok ? (
                        <span className="inline-flex items-center gap-1 text-xs text-danger">
                          <XCircle size={13} /> 识别失败
                        </span>
                      ) : it.needsMultimodal ? (
                        <span className="inline-flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle size={13} /> 纯扫描件
                        </span>
                      ) : it.hasConflict ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-warning">
                            <ShieldAlert size={13} /> 存在冲突
                          </span>
                          <ConflictNotes conflicts={it.conflicts} />
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 size={13} /> 全新记录
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <select
                        className="input-field text-xs py-1"
                        value={it.mode}
                        disabled={!it.ok || it.needsMultimodal}
                        onChange={(e) => setMode(it.id, e.target.value)}
                      >
                        {MODE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-sm text-ink-2">
              将导入 <span className="font-semibold text-ink-1">{pendingCount}</span> 份
              <span className="text-ink-3 text-xs ml-2">
                「仅补缺失」= 已存在的公司/人员不改动，只补关联；「覆盖」= 用 NAR1 数据重写已有字段
              </span>
            </p>
            <button
              onClick={runCommit}
              disabled={phase === 'committing' || pendingCount === 0}
              className="btn-primary flex items-center gap-2"
            >
              {phase === 'committing' ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
              确认导入 {pendingCount} 份
            </button>
          </div>
        </div>
      )}

      {/* 导入结果 */}
      {phase === 'done' && commitResult && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-success" />
            <p className="font-medium text-ink-1">导入完成</p>
          </div>
          <p className="text-sm text-ink-2">
            成功 {commitResult.summary?.imported || 0} · 跳过 {commitResult.summary?.skipped || 0} · 失败 {commitResult.summary?.failed || 0}
          </p>
          <ul className="text-sm space-y-1">
            {(commitResult.results || []).map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                {r.ok
                  ? <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                  : <XCircle size={14} className="text-danger mt-0.5 shrink-0" />}
                <span className="text-ink-2">
                  {r.fileName || r.id}
                  {r.ok && r.status === 'ok' && r.stats?.company && (
                    <span className="text-ink-3 text-xs ml-2">
                      公司 {r.stats.company.action === 'created' ? '新建' : r.stats.company.action === 'updated' ? '更新' : '已存在'}
                      {r.stats.document?.docNumber ? ` · 文档 ${r.stats.document.docNumber}` : ''}
                      {r.stats.links ? ` · 关联 ${r.stats.links}` : ''}
                    </span>
                  )}
                  {r.ok && r.status === 'skipped' && <span className="text-ink-3 text-xs ml-2">已跳过</span>}
                  {!r.ok && <span className="text-danger text-xs ml-2">{r.error}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <button onClick={reset} className="btn-secondary">再导入一批</button>
            <a href="#/companies" className="btn-primary">查看公司列表</a>
          </div>
        </div>
      )}

      {engineLoading && phase === 'idle' && (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      )}
    </div>
  )
}

function countByRole(plan, role) {
  if (!plan) return 0
  return (plan.people || []).filter((p) => p.role === role).length +
    (plan.entities || []).filter((e) => e.role === role).length
}

function ConflictNotes({ conflicts }) {
  if (!conflicts) return null
  const notes = []
  if (conflicts.company) notes.push(`公司已存在：${conflicts.company.name}`)
  if (conflicts.document) notes.push(`NAR1 文档已存在：${conflicts.document.docNumber}`)
  if (conflicts.people?.length) notes.push(`人员重复 ${conflicts.people.length} 人：${conflicts.people.map((p) => p.name).join('、')}`)
  if (conflicts.entities?.length) notes.push(`法人重复 ${conflicts.entities.length} 个`)
  if (conflicts.companyError) notes.push(conflicts.companyError)
  return (
    <div className="text-xs text-ink-3 space-y-0.5">
      {notes.map((n, i) => <p key={i}>{n}</p>)}
    </div>
  )
}
