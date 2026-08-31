import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft, Command } from 'lucide-react'
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

// 命中关键词高亮：把匹配片段包成 <mark>
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

// 变体：决定外层 padding + 下拉定位
//   inline  — 抽屉/普通容器（默认，左右 padding 12px，下拉 320px 宽）
//   navbar  — 顶栏紧凑内嵌（无 padding，下拉与输入框等宽，更宽展示）
//   overlay — 全屏浮层（容器 padding 16px，下拉沿容器宽度自适应）
const VARIANT_OUTER = {
  inline:  'relative px-3 pb-3',
  navbar:  'relative w-full',
  overlay: 'relative px-4 pb-4',
}
const VARIANT_DROPDOWN = {
  // inline: 沿用原 drawer 行为（与 12px padding 对齐，固定 320px）
  inline:  'absolute z-50 left-3 right-3 top-full mt-1 w-80',
  // navbar: 下拉左对齐输入框，超 sm 时撑到 460px 方便展示 title+subtitle
  navbar:  'absolute z-50 left-0 right-0 top-full mt-2 w-full sm:w-[460px]',
  // overlay: 沿浮层 padding 缩进
  overlay: 'absolute z-50 left-4 right-4 top-full mt-2 w-auto',
}

export default function GlobalSearch({ onOpenCommand, variant = 'inline' }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)
  const activeRef = useRef(null)
  const debounceRef = useRef(null)

  const outerCls = VARIANT_OUTER[variant] || VARIANT_OUTER.inline
  const dropdownCls = VARIANT_DROPDOWN[variant] || VARIANT_DROPDOWN.inline

  // 防抖调用跨实体全局搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (!term) {
      setResults([])
      setOpen(false)
      setLoading(false)
      setActiveIndex(0)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchService.globalSearch(term)
        const data = res?.data?.data || {}
        setResults(data.results || [])
        setActiveIndex(0)
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

  // active 项滚动进可视区（键盘导航时）
  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const go = useCallback((link) => {
    setOpen(false)
    setQuery('')
    navigate(link)
  }, [navigate])

  const onKeyDown = (e) => {
    const flat = grouped.flatMap((g) => g.items)
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length) setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (flat.length) {
        const item = flat[activeIndex] || flat[0]
        if (item) go(item.link)
      }
    }
  }

  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0)

  const total = results.length
  let vi = -1

  return (
    <div ref={containerRef} className={outerCls}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
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
        {onOpenCommand && (
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="打开命令面板"
            title="命令面板 (⌘K)"
            className="shrink-0 p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-canvas border border-hairline transition-colors"
          >
            <Command size={18} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className={`${dropdownCls} max-h-96 overflow-y-auto bg-surface rounded-xl shadow-3 border border-hairline py-2`}>
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
                  {g.items.map((r) => {
                    vi += 1
                    const idx = vi
                    const active = idx === activeIndex
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        ref={active ? activeRef : null}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => go(r.link)}
                        className={`w-full text-left px-4 py-2 flex flex-col ${active ? 'bg-primary-50' : 'hover:bg-canvas'}`}
                      >
                        <span className="text-sm font-medium text-ink truncate">
                          {highlight(r.title, query.trim())}
                        </span>
                        {r.subtitle && (
                          <span className="text-xs text-ink-3 truncate">
                            {highlight(r.subtitle, query.trim())}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}

              <button
                onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="w-full mt-1 px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 border-t border-hairline"
              >
                <CornerDownLeft size={14} />
                查看全部 {total} 条结果
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
