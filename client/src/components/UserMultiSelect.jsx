import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Users, X } from 'lucide-react'
import { inputClass, labelClass } from './UIHelpers'

/**
 * UserMultiSelect — 轻量多选参与者控件（Tailwind + lucide，零新依赖）
 *
 * 用于任务创建/编辑时从 User 列表勾选多个参与者（assignedTo）。
 * 与现有 UI 体系（inputClass / labelClass）保持一致，移动端用 w-full 自然适配（Q5）。
 *
 * Props:
 *  - users:   User[]  （含 _id / name / email / role）
 *  - value:   string[]  （已选 User._id 列表）
 *  - onChange:(ids: string[]) => void
 *  - label?:  string
 *  - disabled?: boolean
 */
export default function UserMultiSelect({ users = [], value = [], onChange, label = '参与者', disabled = false }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // 点击组件外部时关闭下拉面板
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selectedIds = Array.isArray(value) ? value : []
  const selectedUsers = users.filter((u) => selectedIds.includes(u._id))

  const toggle = (id) => {
    if (disabled) return
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const clear = () => {
    if (!disabled) onChange([])
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className={labelClass}>{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Users size={15} className="text-ink-3 shrink-0" />
          {selectedUsers.length === 0 ? (
            <span className="text-ink-3 truncate">未选择</span>
          ) : (
            <span className="truncate">{selectedUsers.map((u) => u.name || u.email).join('、')}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-ink-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {selectedUsers.length > 0 && (
        <div className="mt-1 flex items-center justify-between text-xs text-ink-2">
          <span>已选 {selectedUsers.length} 人</span>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="flex items-center gap-1 text-ink-3 hover:text-danger disabled:opacity-50"
          >
            <X size={12} /> 清除
          </button>
        </div>
      )}

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-hairline bg-surface shadow-3">
          {users.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-3">暂无可选用户</div>
          ) : (
            users.map((u) => {
              const checked = selectedIds.includes(u._id)
              return (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => toggle(u._id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-hairline'}`}>
                    {checked && <Check size={12} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.name || u.email || u._id}</span>
                    {u.role && <span className="block text-xs capitalize text-ink-3">{u.role}</span>}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
