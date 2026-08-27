import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock, FileSpreadsheet, FileText, Plus, RefreshCw,
  History, Table as TableIcon, AlertCircle, ShieldCheck, Check, X, Library, Pencil,
} from 'lucide-react'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, VerticalAlign, AlignmentType, ShadingType,
} from 'docx'
import { scheduleService, companyService } from '../services/index.js'
import { complianceChecks } from '../services/timetableEngine.js'
import { fmtDateShort, fmtDateTimeShort, saveBlob } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, FormField, taskPriorityColor, taskStatusColor } from '../components/UIHelpers'
import { FONT, run, headerCell, dataCell } from '../utils/docxCommon'
import { useNavigate } from 'react-router-dom'

// ===== 锚点默认（演示预填；真实规则库由后端拥有）======
const ANCHOR_DEFAULTS = {
  interim: { T0: '2026-06-30', T1: '2026-08-20', T2: '2026-09-22' },
  annual: { T0: '2026-12-31', T1: '2027-03-26', T2: '2027-04-23', T3: '2027-06-04', T4: '2027-05-14' },
}

// 中文优先级/状态 → CSMS Task 英文枚举（与后端 PRI_MAP/STA_MAP 对应，仅用于取色）
const PRI_CN2EN = { '最高优': 'urgent', '高优': 'high', '中优': 'medium', '低优': 'low' }
const STA_CN2EN = { '未启动': 'pending', '进行中': 'in_progress', '部分完成': 'in_progress', '已完成': 'completed' }

const periodLabel = (p) => (p === 'annual' ? '年度' : '中期')

/** Date / ISO 串 → 'YYYY-MM-DD'（纯日期手动解析，避免 UTC 漂移）。 */
const toISO = (s) => {
  if (!s) return ''
  if (typeof s === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 任务日期列：时点=单日，区间='起 — 止'（复刻参考生成器）。 */
const dateCell = (start, end) => {
  const s = toISO(start)
  const e = toISO(end)
  if (s && e && s !== e) return `${s} — ${e}`
  return s || e || '-'
}

/** 从后端下发的偏移量列表按 id 取计算日期（前端不复算规则）。 */
const offsetDate = (offsets, id) => {
  const hit = (offsets || []).find((o) => o.id === id)
  return hit ? (hit.date || '') : ''
}

/**
 * 规则库快照的条目统计（展开面板用）。
 * 只做计数，不渲染规则全文——快照约百 KB，页面上铺开无实际阅读价值，
 * 需要全文时去 Admin Panel「业绩排期规则库」查看当前库。
 */
const snapshotCounts = (snap) => ([
  { label: '规则条目', value: Object.keys(snap.rules || {}).length },
  { label: '参与方', value: Object.keys(snap.parties || {}).length },
  { label: '中期偏移量', value: (snap.offsets_midyear || []).length },
  { label: '年度偏移量', value: (snap.offsets_annual || []).length },
  { label: '中期任务', value: (snap.tasks_midyear || []).length },
  { label: '年度任务', value: (snap.tasks_annual || []).length },
])

/**
 * 规则库版本水印条。
 *
 * 排期是给董事会/监管看的合规文件，必须能回答「这张表是按哪一版规则算出来的」。
 * 版本号与快照由后端在生成时钉进结果文档（mock 模式由 mock.js 用前端规则库副本构造）。
 */
function RuleSnapshotBar({ version, snapshot }) {
  const [open, setOpen] = useState(false)

  if (version == null && !snapshot) return null

  const rev = Number(version) || 0
  const stamp = snapshot && snapshot.generatedAt ? fmtDateTimeShort(snapshot.generatedAt) : ''
  const contentVersion = (snapshot && (snapshot.version || (snapshot.meta && snapshot.meta.version))) || ''

  return (
    <div className="bg-card rounded-xl border border-hairline px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Library size={16} className="text-primary-600" />
        <span className="text-sm font-medium text-ink">规则库版本 v{rev}</span>
        {rev === 0 && <span className="text-xs text-ink-3">（内置种子 · 规则库尚未落库）</span>}
        {stamp && <span className="text-xs text-ink-3">· 快照于 {stamp}</span>}
        {contentVersion && <span className="text-xs text-ink-3">· 内容版本 {contentVersion}</span>}
        <span className="text-xs text-ink-3">· 本表按此快照复现，规则库后续改动不影响</span>
        {snapshot && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto text-xs text-primary-600 hover:underline"
          >
            {open ? '收起当时规则' : '查看当时规则'}
          </button>
        )}
      </div>

      {open && snapshot && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
          {snapshotCounts(snapshot).map((c) => (
            <div key={c.label} className="rounded-lg border border-hairline bg-canvas px-3 py-2">
              <div className="text-xs text-ink-3">{c.label}</div>
              <div className="text-base font-semibold text-ink">{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResultsTimetable() {
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [period, setPeriod] = useState('interim')
  const [anchors, setAnchors] = useState({ ...ANCHOR_DEFAULTS.interim })
  const [fiscalYear, setFiscalYear] = useState('')
  const [code, setCode] = useState('1321')
  const [name, setName] = useState('中国新城市')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [wordLoading, setWordLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editItems, setEditItems] = useState([])

  const anchorKeys = useMemo(
    () => (period === 'annual' ? ['T0', 'T1', 'T2', 'T3', 'T4'] : ['T0', 'T1', 'T2']),
    [period],
  )

  const navigate = useNavigate()

  const handlePeriodChange = (p) => {
    setPeriod(p)
    setAnchors({ ...ANCHOR_DEFAULTS[p] })
  }

  const setAnchor = (k, v) => setAnchors((a) => ({ ...a, [k]: v }))

  // 编辑缓冲：result 变化时同步一份可改副本
  useEffect(() => {
    if (result) setEditItems(result.items.map((it) => ({ ...it })))
  }, [result])

  const updateItem = (idx, field, value) =>
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))

  const toggleEdit = () => {
    if (editing && result) {
      // 完成编辑：把缓冲写回结果，供导出/合规重算使用
      setResult((r) => (r ? { ...r, items: editItems } : r))
    }
    setEditing((e) => !e)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [coRes, histRes] = await Promise.all([
          companyService.getAll().catch(() => ({ data: { data: [] } })),
          scheduleService.list().catch(() => ({ data: { data: { results: [] } } })),
        ])
        if (!cancelled) {
          setCompanies(coRes.data?.data || [])
          setHistory(histRes.data?.data?.results || [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleGenerate = async () => {
    setError('')
    if (!selectedCompany) {
      setError('请先选择公司')
      return
    }
    setGenLoading(true)
    try {
      const payload = {
        companyId: selectedCompany,
        period,
        anchors: Object.fromEntries(anchorKeys.map((k) => [k, anchors[k]]).filter(([, v]) => v)),
        fiscalYear: fiscalYear || undefined,
        code: code || undefined,
        name: name || undefined,
      }
      const res = await scheduleService.generate(payload)
      const body = res.data || {}
      const data = body.data || {}
      setResult({
        id: data.id ?? body.id,
        period: data.period ?? body.period ?? period,
        anchors: data.anchors ?? body.anchors ?? {},
        items: data.items ?? body.items ?? [],
        compliance: data.compliance ?? body.compliance ?? [],
        offsets: data.offsets ?? body.offsets ?? [],
        tasksCreated: data.tasksCreated ?? body.tasksCreated ?? null,
        // 规则库水印：真实链路来自 POST /generate 响应，mock 链路来自 mock.js 构造的快照
        ruleLibraryVersion: data.ruleLibraryVersion ?? body.ruleLibraryVersion ?? null,
        ruleLibrarySnapshot: data.ruleLibrarySnapshot ?? body.ruleLibrarySnapshot ?? null,
      })
      const histRes = await scheduleService.list().catch(() => ({ data: { data: { results: [] } } }))
      setHistory(histRes.data?.data?.results || [])
    } catch (e) {
      setError(e?.message || '生成失败')
    } finally {
      setGenLoading(false)
    }
  }

  const handleOpenHistory = async (id) => {
    setError('')
    try {
      const res = await scheduleService.getOne(id)
      const body = res.data || {}
      const doc = body.data || {}
      setResult({
        id: doc._id || id,
        period: doc.period,
        anchors: doc.anchors || {},
        items: doc.items || [],
        compliance: body.compliance ?? doc.compliance ?? [],
        offsets: body.offsets ?? doc.offsets ?? [],
        tasksCreated: doc.items?.length || 0,
        // 历史排期打开时同样带出生成当时的规则库版本与快照（老数据无此字段则为 null）
        ruleLibraryVersion: doc.ruleLibraryVersion ?? null,
        ruleLibrarySnapshot: doc.ruleLibrarySnapshot ?? null,
      })
      if (doc.period) setPeriod(doc.period)
    } catch (e) {
      setError(e?.message || '打开失败')
    }
  }

  const handleExcel = async () => {
    if (!result?.id) return
    setError('')
    try {
      const r = await scheduleService.excelDownload(result.id)
      if (r && r.ok === false) {
        setError(r.message || 'Mock 模式不支持下载，请切换真实后端（VITE_USE_MOCK=false）')
      }
    } catch (e) {
      setError(e?.message || '下载 Excel 失败')
    }
  }

  // ===== 前端生成打印版 Word（镜像参考生成器 exportWord 布局）======
  const handleWord = async () => {
    if (!result?.items?.length) return
    setWordLoading(true)
    try {
      const companyName = companies.find((c) => c._id === selectedCompany)?.name || name || '公司'
      const doc = buildPrintDoc({
        companyName,
        period: result.period,
        anchors: result.anchors,
        offsets: result.offsets,
        items: result.items,
      })
      const blob = await Packer.toBlob(doc)
      saveBlob(blob, `${code || '1321'}_${periodLabel(result.period)}业绩排期_打印版.docx`)
    } catch (e) {
      setError(e?.message || '生成 Word 失败')
    } finally {
      setWordLoading(false)
    }
  }

  const viewItems = result?.items || []
  const complianceItems = editing ? editItems : (result?.items || [])

  // 合规自检随编辑实时重算：用引擎基于「当前锚点 + 编辑后任务日期」重新判定
  const liveCompliance = useMemo(() => {
    if (!result) return []
    const offsetsByKey = {}
    ;(result.offsets || []).forEach((o) => {
      offsetsByKey[o.id] = o.date
      const s = o.id.replace(/^(MY|AN)_/, '')
      if (s !== o.id) offsetsByKey[s] = o.date
    })
    try {
      return complianceChecks(
        result.period,
        result.anchors || anchors,
        { _byKey: offsetsByKey },
        complianceItems,
      )
    } catch {
      return result.compliance || []
    }
  }, [result, complianceItems, anchors])

  return (
    <div className="space-y-6">
      <PageHeader
        title="业绩公告排期"
        subtitle="港股中期 / 年度业绩披露全流程时间表生成器（锚点驱动 · 回写任务）"
        icon={CalendarClock}
        actions={<span className="text-xs text-ink-3">规则库由后端持有 · 前端只读渲染</span>}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger/10 text-danger border border-danger/20 px-4 py-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== 生成控制区 ===== */}
      <div className="bg-card rounded-xl border border-hairline p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="关联公司" required>
            <select className={inputClass} value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
              <option value="">— 选择公司 —</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}{c.code ? `（${c.code}）` : ''}</option>
              ))}
            </select>
          </FormField>

          <FormField label="业绩期间">
            <select className={inputClass} value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
              <option value="interim">中期业绩（Interim）</option>
              <option value="annual">年度业绩（Annual）</option>
            </select>
          </FormField>
        </div>

        <div className="mt-4">
          <label className={labelClass}>关键锚点日期（驱动全表推算）</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-1">
            {anchorKeys.map((k) => (
              <div key={k}>
                <div className="text-xs text-ink-3 mb-1">{k}</div>
                <input
                  type="date"
                  className={inputClass}
                  value={anchors[k] || ''}
                  onChange={(e) => setAnchor(k, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-2">
            T0 财年末 · T1 董事会/业绩公告日 · T2 报告上传 ESS · T3 股东会 · T4 股东会通告（年度）
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FormField label="股票代码">
            <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="1321" />
          </FormField>
          <FormField label="公司简称">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="中国新城市" />
          </FormField>
          <FormField label="财年（可选）">
            <input className={inputClass} value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} placeholder="如 2026" />
          </FormField>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={genLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {genLoading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            {genLoading ? '生成中…' : '生成排期'}
          </button>
          {result && (
            <>
              <button
                onClick={handleExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-hairline text-ink hover:bg-canvas text-sm font-medium"
              >
                <FileSpreadsheet size={16} /> 下载 Excel
              </button>
              <button
                onClick={handleWord}
                disabled={wordLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-hairline text-ink hover:bg-canvas text-sm font-medium disabled:opacity-50"
              >
                {wordLoading ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                {wordLoading ? '生成中…' : '下载打印版 Word'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===== 规则库版本水印 ===== */}
      {result && (
        <RuleSnapshotBar
          version={result.ruleLibraryVersion}
          snapshot={result.ruleLibrarySnapshot}
        />
      )}

      {/* ===== 合规自检面板 ===== */}
      {liveCompliance.length > 0 && (
        <div className="bg-card rounded-xl border border-hairline p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-primary-600" />
            <h2 className="text-base font-semibold text-ink">合规自检</h2>
            <span className="text-xs text-ink-3">
              {liveCompliance.filter((c) => c.passed).length} / {liveCompliance.length} 项通过
            </span>
          </div>
          <div className="space-y-2">
            {liveCompliance.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                  c.passed ? 'border-success/20 bg-success/5' : 'border-danger/20 bg-danger/5'
                }`}
              >
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    c.passed ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                  }`}
                >
                  {c.passed ? <Check size={13} /> : <X size={13} />}
                </span>
                <div className="min-w-0">
                  <div className="text-ink">{c.label}</div>
                  {c.detail && <div className="text-xs text-ink-3 mt-0.5">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 结果区 ===== */}
      {result && viewItems.length > 0 && (
        <div className="bg-card rounded-xl border border-hairline p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <TableIcon size={16} className="text-primary-600" />
              已生成 <span className="font-semibold text-ink">{viewItems.length}</span> 项任务
              {result.tasksCreated != null && (
                <span className="text-ink-3">· 回写 Task {result.tasksCreated} 条</span>
              )}
              <span className="text-ink-3">· {periodLabel(result.period)}业绩</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                title="开启后可直接修改每行的日期、任务、负责人、优先级、状态，合规自检将随改动实时重算"
              >
                <Pencil size={14} />
                {editing ? '完成编辑' : '编辑排期'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin?tab=rules')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-canvas transition-colors"
                title="跳转到「业绩排期规则库」，可编辑偏移量与任务定义后重新生成"
              >
                <Pencil size={14} />
                编辑规则库
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-hairline rounded-lg">
            <table className="min-w-full text-sm table-responsive">
              <thead className="bg-canvas text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left">日期</th>
                  <th className="px-3 py-2 text-left">大类</th>
                  <th className="px-3 py-2 text-left">任务名称</th>
                  <th className="px-3 py-2 text-left">规则</th>
                  <th className="px-3 py-2 text-left">负责人</th>
                  <th className="px-3 py-2 text-left">优先级</th>
                  <th className="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {viewItems.map((it, i) => (
                  <tr key={it.index} className="border-t border-hairline hover:bg-canvas/50 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-ink-2" data-label="日期">
                      {editing ? (
                        <div className="flex flex-col gap-1">
                          <input type="date" className={inputClass} value={toISO(it.startDate)} onChange={(e) => updateItem(i, 'startDate', e.target.value)} />
                          <input type="date" className={inputClass} value={toISO(it.endDate)} onChange={(e) => updateItem(i, 'endDate', e.target.value)} />
                        </div>
                      ) : (
                        dateCell(it.startDate, it.endDate)
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" data-label="大类">
                      {editing ? (
                        <input className={inputClass} value={it.category || ''} onChange={(e) => updateItem(i, 'category', e.target.value)} />
                      ) : (
                        it.category
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-ink max-w-md" data-label="任务名称">
                      {editing ? (
                        <div className="flex flex-col gap-1">
                          <input className={inputClass} value={it.title || ''} onChange={(e) => updateItem(i, 'title', e.target.value)} />
                          <textarea className={inputClass} rows={2} value={it.steps || ''} onChange={(e) => updateItem(i, 'steps', e.target.value)} />
                        </div>
                      ) : (
                        <>
                          {it.title}
                          {it.steps && (
                            <div className="text-xs text-ink-3 font-normal mt-0.5 whitespace-pre-line">{it.steps}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-2 max-w-xs text-xs" data-label="规则">{it.rule}</td>
                    <td className="px-3 py-2 whitespace-nowrap" data-label="负责人">
                      {editing ? (
                        <input className={inputClass} value={it.owner || ''} onChange={(e) => updateItem(i, 'owner', e.target.value)} />
                      ) : (
                        it.owner
                      )}
                    </td>
                    <td className="px-3 py-2" data-label="优先级">
                      {editing ? (
                        <select className={inputClass} value={it.priority || '中优'} onChange={(e) => updateItem(i, 'priority', e.target.value)}>
                          {['最高优', '高优', '中优', '低优'].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${taskPriorityColor(PRI_CN2EN[it.priority] || 'medium')}`}>
                          {it.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2" data-label="状态">
                      {editing ? (
                        <select className={inputClass} value={it.status || '未启动'} onChange={(e) => updateItem(i, 'status', e.target.value)}>
                          {['未启动', '进行中', '已完成'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${taskStatusColor(STA_CN2EN[it.status] || 'pending')}`}>
                          {it.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 历史排期 ===== */}
      <div className="bg-card rounded-xl border border-hairline p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-primary-600" />
          <h2 className="text-base font-semibold text-ink">历史排期</h2>
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : history.length === 0 ? (
          <EmptyState icon={CalendarClock} title="暂无历史排期" description="生成后将在此列出，可一键重新打开" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm table-responsive">
              <thead className="bg-canvas text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left">公司</th>
                  <th className="px-3 py-2 text-left">期间</th>
                  <th className="px-3 py-2 text-left">规则库</th>
                  <th className="px-3 py-2 text-left">生成时间</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} className="border-t border-hairline hover:bg-canvas/50">
                    <td data-label="公司" className="px-3 py-2">{h.company?.name || h.name || '—'}</td>
                    <td data-label="期间" className="px-3 py-2">{periodLabel(h.period)}</td>
                    <td data-label="规则库" className="px-3 py-2 text-ink-2 whitespace-nowrap">
                      {h.ruleLibraryVersion != null ? `v${h.ruleLibraryVersion}` : '—'}
                    </td>
                    <td data-label="生成时间" className="px-3 py-2 text-ink-2 whitespace-nowrap">{fmtDateShort(h.createdAt)}</td>
                    <td data-label="操作" className="px-3 py-2">
                      <button
                        onClick={() => handleOpenHistory(h._id)}
                        className="text-primary-600 hover:underline text-sm"
                      >
                        打开
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ===================== 打印版 Word 构建 =====================
// 布局镜像参考生成器 exportWord：标题 → 主要事项表 → 工作事项表（按大类分组）→ 备注

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const fullBorders = () => ({
  top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder,
  insideHorizontal: thinBorder, insideVertical: thinBorder,
})

/** 分组标题行（整行合并，浅底），对应 HTML 的 .cat-header。 */
function categoryRow(text, columnSpan, width) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan,
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        borders: { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: 'E8EAF6', color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 20, after: 20, line: 200 },
            children: [run(`[${text}]`, { bold: true, size: 15 })],
          }),
        ],
      }),
    ],
  })
}

/** 事项列：任务名称加粗 + 操作步骤小字（对应 HTML 的 <strong>name</strong><br>details）。 */
function taskDetailCell(title, steps, width) {
  const children = [
    new Paragraph({
      spacing: { before: 10, after: steps ? 0 : 10, line: 200 },
      children: [run(title || '', { bold: true, size: 14 })],
    }),
  ]
  if (steps) {
    String(steps).split('\n').filter(Boolean).forEach((line, i, arr) => {
      children.push(new Paragraph({
        spacing: { before: 0, after: i === arr.length - 1 ? 10 : 0, line: 200 },
        children: [run(line, { size: 13 })],
      }))
    })
  }
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder },
    verticalAlign: VerticalAlign.TOP,
    children,
  })
}

export function buildPrintDoc({ companyName, period, anchors, offsets, items }) {
  const isAnnual = period === 'annual'
  const label = periodLabel(period)
  const prefix = isAnnual ? 'AN_' : 'MY_'
  const off = (key) => offsetDate(offsets, prefix + key)

  const T0 = toISO(anchors?.T0)
  const T1 = toISO(anchors?.T1)
  const T2 = toISO(anchors?.T2)
  const T3 = toISO(anchors?.T3)
  const T4 = toISO(anchors?.T4)
  const year = T0 ? T0.slice(0, 4) : ''

  // ---- 主要事项表（复刻 exportWord 第一部分）----
  const blackout = off('blackout')
  // 与参考生成器一致：优先按实际计算日期反推禁售期天数，缺日期时回落到规则库默认（中期30/年度60）
  const gapFromDates = blackout && T1
    ? Math.abs(Math.round((new Date(T1) - new Date(blackout)) / 86400000))
    : null
  const blackoutGap = gapFromDates ?? (isAnnual ? 60 : 30)
  const keyRows = isAnnual
    ? [
      ['财政期间(T0)', T0],
      [`禁止买卖股份期(T1前${blackoutGap}天至T1)`, blackout && T1 ? `${blackout} 至 ${T1}` : ''],
      ['董事会会议/年度业绩公告(T1)', T1],
      ['年报上传ESS(T2)', T2],
      ['AGM通告(T4)', T4],
      ['AGM召开(T3)', T3],
    ]
    : [
      ['财政期间(T0)', T0],
      [`禁止买卖股份期(T1前${blackoutGap}天至T1)`, blackout && T1 ? `${blackout} 至 ${T1}` : ''],
      ['审核委员会会议(T1)', T1],
      ['董事会会议(T1)', T1],
      ['中期业绩公告', T1],
      ['大量付印中期报告(T2-5)', off('report_final')],
      ['分发中期报告', off('upload_ess') || off('despatch')],
    ]

  const keyColW = [5000, 4000]
  const keyTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: keyColW,
    borders: fullBorders(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headerCell('主要事项', { width: keyColW[0], size: 16 }), headerCell('主要日期', { width: keyColW[1], size: 16 })],
      }),
      ...keyRows.map(([k, v]) => new TableRow({
        children: [
          dataCell(k, { width: keyColW[0], size: 15 }),
          dataCell(v || '', { width: keyColW[1], align: AlignmentType.CENTER, size: 15 }),
        ],
      })),
    ],
  })

  // ---- 工作事项表（复刻 exportWord 第二部分，按大类分组）----
  const taskColW = [1900, 4400, 2600, 1300]
  const taskRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('日期', { width: taskColW[0], size: 15 }),
        headerCell('事项', { width: taskColW[1], size: 15 }),
        headerCell('规则依据', { width: taskColW[2], size: 15 }),
        headerCell('负责人士', { width: taskColW[3], size: 15 }),
      ],
    }),
  ]
  let lastCat = ''
  items.forEach((it) => {
    if (it.category !== lastCat) {
      taskRows.push(categoryRow(it.category || '', 4))
      lastCat = it.category
    }
    taskRows.push(new TableRow({
      children: [
        dataCell(dateCell(it.startDate, it.endDate), { width: taskColW[0], align: AlignmentType.CENTER, size: 14, bold: true }),
        taskDetailCell(it.title, it.steps, taskColW[1]),
        dataCell(it.rule || '', { width: taskColW[2], size: 13 }),
        dataCell(it.owner || '', { width: taskColW[3], align: AlignmentType.CENTER, size: 14 }),
      ],
    }))
  })

  const taskTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: taskColW,
    borders: fullBorders(),
    rows: taskRows,
  })

  // ---- 备注（参与方名称取自任务负责人；规则库由后端下发）----
  const ownerOf = (kw) => (items.find((it) => (it.owner || '').includes(kw))?.owner) || kw
  const remark = [
    `公司-${companyName}`,
    `核数师-${ownerOf('审计师')}`,
    `法律顾问-${ownerOf('法律顾问')}`,
    `股份过户处-${ownerOf('股份过户处')}`,
    `印刷商-${ownerOf('印刷商')}`,
  ].join('；')

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11907, height: 16838 },
          margin: { top: 900, bottom: 900, left: 900, right: 900 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({
            text: `${companyName}本公司${year}年${label}报告工作时间表`,
            bold: true, size: 28, font: FONT,
          })],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [run('主要事项', { bold: true, size: 20 })] }),
        keyTable,
        new Paragraph({ spacing: { before: 280, after: 120 }, children: [run('工作事项表', { bold: true, size: 20 })] }),
        taskTable,
        new Paragraph({ spacing: { before: 280, after: 60 }, children: [run(`备注：${remark}`, { size: 15 })] }),
        new Paragraph({ spacing: { after: 120 }, children: [run('注：请预留至少十个工作天予印刷商进行排版及翻译工作。', { size: 15 })] }),
      ],
    }],
  })
}
