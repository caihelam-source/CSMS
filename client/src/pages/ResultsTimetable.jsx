import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock, FileSpreadsheet, FileText, Plus, RefreshCw,
  History, Table as TableIcon, AlertCircle,
} from 'lucide-react'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, WidthType, BorderStyle, AlignmentType } from 'docx'
import { scheduleService, companyService } from '../services/index.js'
import { fmtDateShort, saveBlob } from '../utils/helpers'
import { LoadingSpinner, EmptyState, inputClass, labelClass, PageHeader, FormField, taskPriorityColor, taskStatusColor } from '../components/UIHelpers'
import { FONT, headerCell, dataCell } from '../utils/docxCommon'

// ===== 锚点默认（与引擎 timetableData.js defaults 同源，便于演示预填）======
const ANCHOR_DEFAULTS = {
  interim: { T0: '2026-06-30', T1: '2026-08-20', T2: '2026-09-22' },
  annual: { T0: '2026-12-31', T1: '2027-03-26', T2: '2027-04-23', T3: '2027-06-04', T4: '2027-05-14' },
}

// 中文优先级/状态 → CSMS Task 英文枚举（与后端 PRI_MAP/STA_MAP 对应）
const PRI_CN2EN = { '最高优': 'urgent', '高优': 'high', '中优': 'medium', '低优': 'low' }
const STA_CN2EN = { '未启动': 'pending', '进行中': 'in_progress', '部分完成': 'in_progress', '已完成': 'completed' }

const periodLabel = (p) => (p === 'annual' ? '年度' : '中期')

// ISO 'YYYY-MM-DD' 或 Date / 完整 ISO → 'dd/mm/yyyy'
// 纯日期手动解析（避免 UTC 漂移）；历史重开排期来自 Atlas 的 Date/ISO 串走 new Date() 本地解析
const isoToDMY = (s) => {
  if (!s) return ''
  const str = typeof s === 'string' ? s : ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    return `${da}/${mo}/${y}`
  }
  return str || String(s)
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

  const anchorKeys = useMemo(
    () => (period === 'annual' ? ['T0', 'T1', 'T2', 'T3', 'T4'] : ['T0', 'T1', 'T2']),
    [period],
  )

  // 切换期间时重置锚点预填
  const handlePeriodChange = (p) => {
    setPeriod(p)
    setAnchors({ ...ANCHOR_DEFAULTS[p] })
  }

  const setAnchor = (k, v) => setAnchors((a) => ({ ...a, [k]: v }))

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
          const cos = coRes.data?.data || []
          setCompanies(cos)
          const results = histRes.data?.data?.results || []
          setHistory(results)
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
      const data = res.data?.data || {}
      setResult(data)
      // 刷新历史
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
      const doc = res.data?.data || {}
      setResult({
        id: doc._id || id,
        period: doc.period,
        anchors: doc.anchors || {},
        items: doc.items || [],
        tasksCreated: doc.items?.length || 0,
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

  // ===== 前端生成打印版 Word（复用 docxCommon 字体/边框工具）======
  const handleWord = async () => {
    if (!result?.items?.length) return
    setWordLoading(true)
    try {
      const companyName = companies.find((c) => c._id === selectedCompany)?.name || name || '公司'
      const blob = await Packer.toBlob(buildPrintDoc(companyName, result.period, result.anchors, result.items))
      const fn = `${code || '1321'}_${periodLabel(result.period)}业绩时间表_打印版.docx`
      saveBlob(blob, fn)
    } catch (e) {
      setError(e?.message || '生成 Word 失败')
    } finally {
      setWordLoading(false)
    }
  }

  const items = result?.items || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="业绩公告排期"
        subtitle="港股中期 / 年度业绩披露全流程时间表生成器（锚点驱动 · 回写任务）"
        icon={CalendarClock}
        actions={
          <span className="text-xs text-ink-3">数据源：CSMS 排期引擎 · 与 Skill 同源</span>
        }
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

        {/* 锚点输入 */}
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

      {/* ===== 结果区 ===== */}
      {result && items.length > 0 && (
        <div className="bg-card rounded-xl border border-hairline p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <TableIcon size={16} className="text-primary-600" />
              已生成 <span className="font-semibold text-ink">{items.length}</span> 项任务
              {result.tasksCreated != null && (
                <span className="text-ink-3">· 回写 Task {result.tasksCreated} 条</span>
              )}
              <span className="text-ink-3">· {periodLabel(result.period)}业绩</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-hairline rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">类别</th>
                  <th className="px-3 py-2 text-left">任务名称</th>
                  <th className="px-3 py-2 text-left">规则依据</th>
                  <th className="px-3 py-2 text-left">负责人</th>
                  <th className="px-3 py-2 text-left">中介</th>
                  <th className="px-3 py-2 text-left">启动</th>
                  <th className="px-3 py-2 text-left">截止</th>
                  <th className="px-3 py-2 text-left">优先级</th>
                  <th className="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.index} className="border-t border-hairline hover:bg-canvas/50">
                    <td className="px-3 py-2 text-ink-3">{it.index}</td>
                    <td className="px-3 py-2">{it.category}</td>
                    <td className="px-3 py-2 font-medium text-ink max-w-xs">{it.title}</td>
                    <td className="px-3 py-2 text-ink-2 max-w-xs text-xs">{it.rule}</td>
                    <td className="px-3 py-2">{it.owner}</td>
                    <td className="px-3 py-2 text-ink-2">{it.agency}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-2">{fmtDateShort(it.startDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-2">{fmtDateShort(it.endDate)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${taskPriorityColor(PRI_CN2EN[it.priority] || 'medium')}`}>
                        {it.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${taskStatusColor(STA_CN2EN[it.status] || 'pending')}`}>
                        {it.status}
                      </span>
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
            <table className="min-w-full text-sm">
              <thead className="bg-canvas text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left">公司</th>
                  <th className="px-3 py-2 text-left">期间</th>
                  <th className="px-3 py-2 text-left">生成时间</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} className="border-t border-hairline hover:bg-canvas/50">
                    <td className="px-3 py-2">{h.company?.name || h.name || '—'}</td>
                    <td className="px-3 py-2">{periodLabel(h.period)}</td>
                    <td className="px-3 py-2 text-ink-2 whitespace-nowrap">{fmtDateShort(h.createdAt)}</td>
                    <td className="px-3 py-2">
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

// ===== 打印版 Word 构建（横向，与 Excel 全量 1:1）======
function buildPrintDoc(companyName, period, anchors, items) {
  const title = `${companyName} ${periodLabel(period)}业绩公告排期时间表`
  const today = new Date()
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

  const anchorRows = (period === 'annual'
    ? [['T0 财年末', 'T1 董事会/业绩公告日', 'T2 报告上传 ESS', 'T3 股东会', 'T4 股东会通告'],
       [anchors.T0, anchors.T1, anchors.T2, anchors.T3, anchors.T4]]
    : [['T0 财年末', 'T1 董事会/业绩公告日', 'T2 报告上传 ESS'],
       [anchors.T0, anchors.T1, anchors.T2]]
  ).map((row, ri) => new TableRow({
    children: row.map((cell) => ri === 0
      ? headerCell(cell, { size: 16 })
      : dataCell(isoToDMY(cell), { size: 16 })),
  }))

  const headers = ['序号', '类别', '任务名称', '规则依据', '操作步骤', '负责人', '中介', '启动', '截止', '优先级', '状态', '文件']
  const colW = [500, 1100, 2600, 2600, 2600, 1200, 1200, 850, 850, 700, 700, 900]

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, { width: colW[i], size: 15 })),
  })

  const bodyRows = items.map((it) => new TableRow({
    children: [
      dataCell(String(it.index), { width: colW[0], align: AlignmentType.CENTER, size: 14 }),
      dataCell(it.category || '', { width: colW[1], size: 14 }),
      dataCell(it.title || '', { width: colW[2], size: 14 }),
      dataCell(it.rule || '', { width: colW[3], size: 13 }),
      dataCell(it.steps || '', { width: colW[4], size: 13 }),
      dataCell(it.owner || '', { width: colW[5], size: 14 }),
      dataCell(it.agency || '', { width: colW[6], size: 14 }),
      dataCell(isoToDMY(it.startDate), { width: colW[7], align: AlignmentType.CENTER, size: 14 }),
      dataCell(isoToDMY(it.endDate), { width: colW[8], align: AlignmentType.CENTER, size: 14 }),
      dataCell(it.priority || '', { width: colW[9], align: AlignmentType.CENTER, size: 14 }),
      dataCell(it.status || '', { width: colW[10], align: AlignmentType.CENTER, size: 14 }),
      dataCell(it.file || '', { width: colW[11], size: 13 }),
    ],
  }))

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const fullBorders = () => ({
    top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder,
    insideHorizontal: thinBorder, insideVertical: thinBorder,
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colW,
    borders: fullBorders(),
    rows: [headerRow, ...bodyRows],
  })

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: 'landscape', width: 16838, height: 11907 },
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: title, bold: true, size: 28, font: FONT })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `编制日期：${todayStr}`, size: 18, font: FONT })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: fullBorders(),
          rows: anchorRows,
        }),
        new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: '任务明细', bold: true, size: 20, font: FONT })] }),
        table,
      ],
    }],
  })
}
