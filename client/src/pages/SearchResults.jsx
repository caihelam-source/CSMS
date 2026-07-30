import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { searchService } from '../services'
import { PageHeader, LoadingSpinner } from '../components/UIHelpers'

// 实体类型 → 中文标签 + 徽章配色（与 GlobalSearch 保持一致）
const TYPE_META = {
  company:   { label: '公司',   cls: 'bg-info/10 text-primary-700' },
  personnel: { label: '人员',   cls: 'bg-canvas text-ink-2' },
  document:  { label: '文档',   cls: 'bg-warning/10 text-warning' },
  meeting:   { label: '会议',   cls: 'bg-success/10 text-success' },
  task:      { label: '任务',   cls: 'bg-canvas text-ink-2' },
  reminder:  { label: '合规提醒', cls: 'bg-danger/10 text-danger' },
}
const TYPE_ORDER = ['company', 'personnel', 'document', 'meeting', 'task', 'reminder']

// 命中关键词高亮：与 GlobalSearch 同源
function highlight(text, q) {
  if (!text || !q) return text
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${esc})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-warning/30 text-ink rounded px-0.5">{part}</mark>
      : <span key={i}>{part}</span>
  )
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = (searchParams.get('q') || '').toString().trim()
  const [input, setInput] = useState(q)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(30)

  useEffect(() => { setInput(q) }, [q])

  const run = useCallback(async () => {
    if (!q) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchService.globalSearch(q, limit)
      const data = res?.data?.data || {}
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally { setLoading(false) }
  }, [q, limit])

  useEffect(() => { run() }, [run])

  const onSearch = (e) => {
    e.preventDefault()
    const term = input.trim()
    if (term) { setLimit(30); setSearchParams({ q: term }) }
  }

  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0)
  const total = results.length

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        title="搜索结果"
        subtitle={q ? `“${q}” 的跨实体全局检索` : '请输入关键词开始检索'}
      />

      <form onSubmit={onSearch} className="relative max-w-xl mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="搜索公司 / 人员 / 文件 / 会议…"
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-hairline bg-canvas focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </form>

      {loading && <LoadingSpinner />}

      {!loading && !q && (
        <div className="text-sm text-ink-3 py-10 text-center">在上方输入关键词，跨 6 类实体检索。</div>
      )}

      {!loading && q && total === 0 && (
        <div className="text-sm text-ink-3 py-10 text-center">未找到与 “{q}” 相关的结果</div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="text-sm text-ink-3 mb-4">共 {total} 条结果</div>
          {grouped.map((g) => (
            <section key={g.type} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_META[g.type].cls}`}>
                  {TYPE_META[g.type].label}
                </span>
                <span className="text-sm text-ink-3">{g.items.length}</span>
              </div>
              <div className="grid gap-2">
                {g.items.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => navigate(r.link)}
                    className="text-left px-4 py-3 rounded-xl border border-hairline bg-surface hover:bg-canvas hover:border-primary-300 transition flex flex-col"
                  >
                    <span className="text-sm font-medium text-ink">
                      {highlight(r.title, q)}
                    </span>
                    {r.subtitle && (
                      <span className="text-xs text-ink-3 mt-0.5">
                        {highlight(r.subtitle, q)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {total >= limit && (
            <button
              onClick={() => setLimit((l) => l + 30)}
              className="w-full py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 rounded-lg border border-hairline flex items-center justify-center gap-1.5"
            >
              <CornerDownLeft size={14} />
              加载更多
            </button>
          )}
        </>
      )}
    </div>
  )
}
