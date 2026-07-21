import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchService } from '../services'

// 实体类型 → 中文标签 + 徽章配色（分组展示用）
const TYPE_META = {
  company:   { label: '公司',   cls: 'bg-info/10 text-primary-700' },
  personnel: { label: '人员',   cls: 'bg-canvas text-ink-2' },
  document:  { label: '文档',   cls: 'bg-warning/10 text-warning' },
  meeting:   { label: '会议',   cls: 'bg-success/10 text-success' },
  task:      { label: '任务',   cls: 'bg-canvas text-ink-2' },
  reminder:  { label: '合规提醒', cls: 'bg-danger/10 text-danger' },
}
const TYPE_ORDER = ['company', 'personnel', 'document', 'meeting', 'task', 'reminder']

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  // 防抖调用跨实体全局搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (!term) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchService.globalSearch(term)
        const data = res?.data?.data || {}
        setResults(data.results || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // 点击外部关闭下拉
  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = useCallback((link) => {
    setOpen(false)
    setQuery('')
    navigate(link)
  }, [navigate])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' && results.length > 0) go(results[0].link)
  }

  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0)

  const total = results.length

  return (
    <div ref={containerRef} className="relative px-3 pb-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={onKeyDown}
          placeholder="搜索公司 / 人员 / 文件 / 会议…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-hairline bg-canvas focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-50 left-3 right-3 top-full mt-1 w-80 max-h-96 overflow-y-auto bg-surface rounded-xl shadow-lg border border-hairline py-2">
          {loading && <div className="px-4 py-3 text-sm text-ink-3">搜索中…</div>}

          {!loading && total === 0 && (
            <div className="px-4 py-3 text-sm text-ink-3">
              未找到与 “{query.trim()}” 相关的结果
            </div>
          )}

          {!loading && total > 0 && (
            <>
              <div className="px-4 pb-1 text-xs text-ink-3">找到 {total} 条结果</div>
              {grouped.map((g) => (
                <div key={g.type} className="mb-1">
                  <div className="flex items-center gap-2 px-4 py-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_META[g.type].cls}`}>
                      {TYPE_META[g.type].label}
                    </span>
                    <span className="text-xs text-ink-3">{g.items.length}</span>
                  </div>
                  {g.items.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => go(r.link)}
                      className="w-full text-left px-4 py-2 hover:bg-canvas flex flex-col"
                    >
                      <span className="text-sm font-medium text-ink truncate">{r.title}</span>
                      {r.subtitle && <span className="text-xs text-ink-3 truncate">{r.subtitle}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
