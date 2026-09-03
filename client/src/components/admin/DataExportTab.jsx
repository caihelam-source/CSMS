// DataExportTab — 中央数据库导出（多 Sheet Excel）。
// 用途：管理员一次性把核心集合（公司/人员/文档/会议/合规提醒/任务/签署任务）
//       导出为单个 .xlsx 工作簿，每个集合一个 Sheet，便于审计 / 备份 / 离线查阅。
// 实现：纯前端（SheetJS 动态 import，沿用 Companies/Personnel 既有 import('xlsx') 约定），
//       不新增后端路由；全量取数（services.getAll 不传 page/limit → 后端 usePaging=false 返全量）。
import { useState, useEffect, useCallback } from 'react'
import { Download, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import {
  companyService, personnelService, documentService, meetingService,
  complianceReminderService, taskService, signTaskService,
} from '../../services/index.js'

// 取数 + 归一：兼容 {data:[...]} / {data:{data:[...]}} / paging 信封 / 单实体键
function extractArray(res, keys = []) {
  const body = res?.data ?? res
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  const candidates = [...keys, 'companies', 'personnel', 'documents', 'meetings', 'reminders', 'tasks', 'signTasks', 'rules']
  for (const k of candidates) if (Array.isArray(body?.[k])) return body[k]
  if (body && typeof body === 'object') {
    for (const k of Object.keys(body)) if (Array.isArray(body[k])) return body[k]
  }
  return []
}

// 路径取值：'a.b.c' → obj.a?.b?.c；缺省 ''
const getVal = (obj, path) => path.split('.').reduce((o, k) => (o == null ? '' : o[k]), obj) ?? ''
const fmtDate = (v) => {
  if (!v) return ''
  const s = String(v)
  return s.includes('T') ? s.slice(0, 10) : s
}
const fmtBool = (v) => (v === true ? '是' : v === false ? '否' : v ?? '')

// 每个集合的列定义（key 支持 . 嵌套；label 为中文表头）
const SHEETS = [
  {
    id: 'companies',
    label: '公司',
    icon: '🏢',
    service: () => companyService.getAll(),
    columns: [
      { key: 'name', label: '公司英文名' },
      { key: 'nameChinese', label: '公司中文名' },
      { key: 'registrationNumber', label: '注册号' },
      { key: 'jurisdiction', label: '注册地' },
      { key: 'type', label: '类型' },
      { key: 'status', label: '状态' },
      { key: 'isListed', label: '是否上市', fmt: fmtBool },
      { key: 'incorporationDate', label: '成立日期', fmt: fmtDate },
      { key: 'brExpiryDate', label: 'BR到期日', fmt: fmtDate },
      { key: 'links', label: '关联实体数', fmt: (v) => (Array.isArray(v) ? v.length : 0) },
    ],
  },
  {
    id: 'personnel',
    label: '人员',
    icon: '👤',
    service: () => personnelService.getAll(),
    columns: [
      { key: 'name', label: '姓名(拼音/英文)' },
      { key: 'nameChinese', label: '中文名' },
      { key: 'nric', label: '身份证/护照号' },
      { key: 'nationality', label: '国籍' },
      { key: 'email', label: '邮箱' },
      { key: 'phone', label: '电话' },
      { key: 'roles', label: '角色', fmt: (v) => (Array.isArray(v) ? v.join('、') : v ?? '') },
      { key: 'status', label: '状态' },
    ],
  },
  {
    id: 'documents',
    label: '文档',
    icon: '📄',
    service: () => documentService.getAll(),
    columns: [
      { key: 'docNumber', label: '文件编号' },
      { key: 'name', label: '文件名' },
      { key: 'type', label: '类型' },
      { key: 'category', label: '分类' },
      { key: 'scope', label: '归属范围' },
      { key: 'company.name', label: '关联公司' },
      { key: 'personnel.name', label: '关联人员' },
      { key: 'documentYear', label: '年份' },
      { key: 'createdAt', label: '创建日期', fmt: fmtDate },
      { key: 'expiresAt', label: '到期日', fmt: fmtDate },
    ],
  },
  {
    id: 'meetings',
    label: '会议',
    icon: '📅',
    service: () => meetingService.getAll(),
    columns: [
      { key: 'title', label: '会议主题' },
      { key: 'type', label: '类型' },
      { key: 'date', label: '日期', fmt: fmtDate },
      { key: 'company.name', label: '关联公司' },
      { key: 'status', label: '状态' },
      { key: 'attendees', label: '出席人数', fmt: (v) => (Array.isArray(v) ? v.length : 0) },
    ],
  },
  {
    id: 'reminders',
    label: '合规提醒',
    icon: '🔔',
    service: () => complianceReminderService.getAll(),
    columns: [
      { key: 'title', label: '提醒标题' },
      { key: 'company.name', label: '关联公司' },
      { key: 'category', label: '分类' },
      { key: 'dueDate', label: '到期日', fmt: fmtDate },
      { key: 'priority', label: '优先级' },
      { key: 'status', label: '状态' },
      { key: 'rule.ruleName', label: '来源规则' },
    ],
  },
  {
    id: 'tasks',
    label: '任务',
    icon: '✅',
    service: () => taskService.getAll(),
    columns: [
      { key: 'title', label: '任务标题' },
      { key: 'type', label: '类型' },
      { key: 'status', label: '状态' },
      { key: 'priority', label: '优先级' },
      { key: 'company.name', label: '关联公司' },
      { key: 'assignedTo.name', label: '负责人' },
      { key: 'dueDate', label: '截止日', fmt: fmtDate },
    ],
  },
  {
    id: 'signTasks',
    label: '签署任务',
    icon: '✍️',
    service: () => signTaskService.getAll(),
    columns: [
      { key: 'title', label: '签署标题' },
      { key: 'status', label: '状态' },
      { key: 'meeting.title', label: '关联会议' },
      { key: 'signer.name', label: '签署人' },
      { key: 'dueDate', label: '截止日', fmt: fmtDate },
      { key: 'company.name', label: '关联公司' },
    ],
  },
]

const DataExportTab = () => {
  const [counts, setCounts] = useState({})
  const [selected, setSelected] = useState(() => SHEETS.map((s) => s.id))
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(null)

  // 挂载时拉各集合计数（仅计数，不拉全量）
  useEffect(() => {
    let alive = true
    const load = async () => {
      const entries = await Promise.all(
        SHEETS.map(async (s) => {
          try {
            const res = await s.service()
            return [s.id, extractArray(res).length]
          } catch {
            return [s.id, 0]
          }
        }),
      )
      if (alive) { setCounts(Object.fromEntries(entries)); setLoadingCounts(false) }
    }
    load()
    return () => { alive = false }
  }, [])

  const toggle = useCallback((id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleExport = async () => {
    if (selected.length === 0) return
    setExporting(true)
    setDone(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const stamp = new Date().toISOString().slice(0, 10)
      for (const s of SHEETS) {
        if (!selected.includes(s.id)) continue
        const res = await s.service()
        const rows = extractArray(res)
        const data = rows.map((r) => {
          const row = {}
          s.columns.forEach((c) => {
            const raw = getVal(r, c.key)
            row[c.label] = c.fmt ? c.fmt(raw) : (raw ?? '')
          })
          return row
        })
        const ws = XLSX.utils.json_to_sheet(data, { header: s.columns.map((c) => c.label) })
        // 列宽自适应（中文表头 + 内容）
        const colWidths = s.columns.map((c) => ({
          wch: Math.min(40, Math.max(10, c.label.length * 2 + 2)),
        }))
        ws['!cols'] = colWidths
        const sheetName = s.label.slice(0, 31)
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }
      XLSX.writeFile(wb, `CSMS_中央数据库_${stamp}.xlsx`)
      setDone({ ok: true, sheets: selected.length, stamp })
    } catch (err) {
      console.error('[DataExport] 导出失败:', err)
      setDone({ ok: false, error: err?.message || String(err) })
    } finally {
      setExporting(false)
    }
  }

  const allSelected = selected.length === SHEETS.length
  const toggleAll = () => setSelected(allSelected ? [] : SHEETS.map((s) => s.id))

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-50 text-primary-700 rounded-lg">
            <FileSpreadsheet size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">中央数据库导出 (Excel)</h3>
            <p className="text-sm text-ink-2 mt-1">
              将核心业务集合一次性导出为单个 .xlsx 工作簿，每个集合一个 Sheet。用于数据备份、审计查阅或离线分析。
              导出在浏览器本地完成，不经由服务器中转。
            </p>
          </div>
        </div>
      </div>

      {/* 集合选择 */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">选择要导出的集合</h4>
          <button
            onClick={toggleAll}
            className="text-xs px-2.5 py-1 rounded border text-ink-2 hover:border-primary-300 hover:text-primary-700 transition-colors"
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHEETS.map((s) => {
            const checked = selected.includes(s.id)
            return (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked ? 'border-primary-300 bg-primary-50' : 'border hover:bg-canvas'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="accent-primary-600 w-4 h-4"
                />
                <span className="text-lg">{s.icon}</span>
                <span className="flex-1 text-sm font-medium">{s.label}</span>
                <span className="text-xs text-ink-3">
                  {loadingCounts ? '…' : `${counts[s.id] ?? 0} 条`}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* 操作区 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          disabled={exporting || selected.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? '导出中…' : `导出 Excel（${selected.length} 个 Sheet）`}
        </button>
        {done?.ok && (
          <span className="flex items-center gap-1 text-sm text-success">
            <CheckCircle2 size={16} /> 已生成 CSMS_中央数据库_{done.stamp}.xlsx
          </span>
        )}
        {done && !done.ok && (
          <span className="text-sm text-danger">导出失败：{done.error}</span>
        )}
      </div>

      <p className="text-xs text-ink-3">
        提示：导出的 Excel 可在 Excel / WPS / Numbers 中打开。关联字段（如「关联公司」）已展开为可读名称。
      </p>
    </div>
  )
}

export default DataExportTab
