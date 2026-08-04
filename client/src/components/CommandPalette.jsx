import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { NAV_ITEMS, NAV_GROUPS } from './Navbar'
import {
  Search, CornerDownLeft, Sun, Moon, Monitor, LogOut,
  Command, Crown, ArrowRight,
} from 'lucide-react'

// 导航分组 → 命令面板内展示的中文标题（与 Navbar 侧栏组对应，但更口语化）
const GROUP_LABELS = {
  Command: '主导航',
  Operations: '业务',
  Compliance: '合规',
  Library: '资料库',
  System: '系统',
}

/**
 * CommandPalette — ⌘K / Ctrl+K 全局命令面板
 * - 复用 Navbar 导出的 NAV_ITEMS / NAV_GROUPS 作为导航数据源（单一事实源）
 * - 动作区：主题切换（明/暗/系统）、退出登录
 * - 输入时额外提供「查看全部搜索结果」跳转到 /search
 * - 键盘：↑↓ 移动、Enter 执行、Esc 关闭；输入框自动聚焦
 */
export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { logout, isAdmin } = useAuth()
  const { theme, setTheme } = useTheme()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const activeRef = useRef(null)

  // 打开时重置状态并聚焦输入框；关闭时恢复 body 滚动
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      document.body.style.overflow = 'hidden'
      return () => { clearTimeout(t); document.body.style.overflow = '' }
    }
  }, [isOpen])

  // Esc 关闭（输入框失焦等边界情况保险）
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // 导航项（含 admin-only 的 Admin Panel，与 Navbar 一致）
  const navItems = useMemo(() => {
    const items = NAV_ITEMS.map(it => ({
      id: `nav-${it.path}`,
      group: it.group,
      icon: it.icon,
      label: it.label,
      path: it.path,
      run: () => navigate(it.path),
    }))
    if (isAdmin) {
      items.push({
        id: 'nav-/admin',
        group: 'System',
        icon: Crown,
        label: 'Admin Panel',
        path: '/admin',
        run: () => navigate('/admin'),
      })
    }
    return items
  }, [navigate, isAdmin])

  // 动作项：主题三态（仅显示非当前态）+ 退出登录
  const actionItems = useMemo(() => {
    const items = []
    if (theme !== 'light') items.push({ id: 'act-light', icon: Sun, label: '切换到亮色主题', run: () => setTheme('light') })
    if (theme !== 'dark') items.push({ id: 'act-dark', icon: Moon, label: '切换到暗色主题', run: () => setTheme('dark') })
    if (theme !== 'system') items.push({ id: 'act-system', icon: Monitor, label: '跟随系统主题', run: () => setTheme('system') })
    items.push({ id: 'act-logout', icon: LogOut, label: '退出登录', run: logout })
    return items
  }, [theme, setTheme, logout])

  // 组装分组结果（保持 NAV_GROUPS 顺序 → 动作组 → 搜索兜底项）
  const q = query.trim().toLowerCase()
  const sections = useMemo(() => {
    const secs = []
    NAV_GROUPS.forEach(g => {
      const items = q
        ? navItems.filter(i => i.group === g.key && i.label.toLowerCase().includes(q))
        : navItems.filter(i => i.group === g.key)
      if (items.length) secs.push({ title: GROUP_LABELS[g.key] || g.key, items })
    })
    const acts = q ? actionItems.filter(i => i.label.toLowerCase().includes(q)) : actionItems
    if (acts.length) secs.push({ title: '操作', items: acts })
    if (q) {
      secs.push({
        title: '',
        items: [{
          id: 'search-all',
          icon: Search,
          label: `查看“${query.trim()}”的全部搜索结果`,
          run: () => navigate(`/search?q=${encodeURIComponent(query.trim())}`),
        }],
      })
    }
    return secs
  }, [q, query, navItems, actionItems, navigate])

  const flat = useMemo(() => sections.flatMap(s => s.items), [sections])

  // 选中项滚动进可视区
  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const execute = (item) => {
    item.run?.()
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length) setActiveIndex(i => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[activeIndex]
      if (item) execute(item)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-xl bg-surface rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline shrink-0">
          <Command size={18} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={onKeyDown}
            placeholder="输入命令或搜索页面…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            aria-label="命令面板输入"
          />
          <kbd className="hidden sm:flex items-center text-[11px] text-ink-3 border border-hairline rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto py-2 flex-1">
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-3">无匹配结果</div>
          ) : (
            sections.map((section, si) => (
              <div key={section.title || `sec-${si}`} className="mb-1">
                {section.title && (
                  <div className="px-4 py-1 text-xs font-semibold text-ink-3 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                {section.items.map(item => {
                  const idx = flat.indexOf(item)
                  const active = idx === activeIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      ref={active ? activeRef : null}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => execute(item)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                        active ? 'bg-primary-50' : 'hover:bg-canvas'
                      }`}
                    >
                      {Icon && <Icon size={17} className={active ? 'text-primary-600' : 'text-ink-3'} />}
                      <span className="flex-1 text-sm text-ink truncate">{item.label}</span>
                      {item.path && (
                        <span className="text-xs text-ink-3 truncate hidden sm:block">{item.path}</span>
                      )}
                      {active && <CornerDownLeft size={14} className="text-primary-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-hairline text-[11px] text-ink-3 shrink-0">
          <span className="flex items-center gap-1"><ArrowRight size={12} />↑↓ 选择</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={12} />↵ 执行</span>
          <span className="flex items-center gap-1"><Command size={12} />⌘K 开关</span>
        </div>
      </div>
    </div>
  )
}
