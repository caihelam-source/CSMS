// AnnouncementsTab — 首页公告管理（管理员后台）。
// 列表 / 新增 / 编辑 / 删除 / 启停 / 排序；库为空时可一键初始化默认公告。
// 数据走 announcementService（真实后端 /api/announcements，或 mock 演示）。
import { useState, useEffect, useCallback } from 'react'
import {
  Megaphone, Plus, Pencil, Trash2, Loader2, AlertTriangle, Power,
  Save, RotateCcw, ExternalLink,
} from 'lucide-react'
import { announcementService } from '../../services/index.js'
import Modal from '../../components/Modal'
import { inputClass, labelClass } from '../../components/UIHelpers'
import useIsMobile from '../../hooks/useIsMobile'

const blank = () => ({
  _id: null,
  eyebrow: '',
  title: '',
  subtitle: '',
  link: '',
  linkText: '',
  active: true,
  order: 0,
})

export default function AnnouncementsTab() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'err', text }
  const [editing, setEditing] = useState(null) // 草稿对象或 null
  const isMobile = useIsMobile()

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await announcementService.getAll()
      const data = res?.data?.data
      setList(Array.isArray(data) ? data : [])
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '加载公告失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── 启停（内联）──
  const toggleActive = async (a) => {
    setMsg(null)
    try {
      await announcementService.update(a._id, { active: !a.active })
      setList((prev) => prev.map((x) => (x._id === a._id ? { ...x, active: !a.active } : x)))
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '切换状态失败' })
    }
  }

  // ── 排序（内联数字）──
  const changeOrder = async (a, raw) => {
    const order = Number(raw) || 0
    setList((prev) => prev.map((x) => (x._id === a._id ? { ...x, order } : x)))
    try {
      await announcementService.update(a._id, { order })
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '更新排序失败' })
    }
  }

  // ── 删除 ──
  const remove = async (a) => {
    if (!window.confirm(`确认删除公告「${a.title || '未命名'}」？`)) return
    setMsg(null)
    try {
      await announcementService.remove(a._id)
      setList((prev) => prev.filter((x) => x._id !== a._id))
      setMsg({ type: 'ok', text: '已删除' })
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '删除失败' })
    }
  }

  // ── 初始化默认公告 ──
  const initialize = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await announcementService.initialize()
      const data = res?.data?.data
      if (Array.isArray(data) && data.length) {
        setList(data)
        setMsg({ type: 'ok', text: res?.data?.message || `已初始化 ${data.length} 条默认公告` })
      } else {
        setMsg({ type: 'ok', text: res?.data?.message || '已存在公告，跳过初始化' })
        await load()
      }
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '初始化失败' })
    } finally {
      setSaving(false)
    }
  }

  // ── 弹窗保存 ──
  const saveEditor = async () => {
    if (!editing) return
    if (!editing.title || !editing.title.trim()) {
      setMsg({ type: 'err', text: '标题不能为空' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      if (editing._id) {
        const res = await announcementService.update(editing._id, editing)
        const updated = res?.data?.data || editing
        setList((prev) => prev.map((x) => (x._id === editing._id ? updated : x)))
        setMsg({ type: 'ok', text: '已保存' })
      } else {
        const res = await announcementService.create(editing)
        const created = res?.data?.data || editing
        setList((prev) => [...prev, created])
        setMsg({ type: 'ok', text: '已新增' })
      }
      setEditing(null)
    } catch (err) {
      setMsg({ type: 'err', text: err?.response?.data?.message || err?.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-3">
        <Loader2 className="animate-spin mr-2" size={18} /> 加载公告…
      </div>
    )
  }

  // 排序后展示（order 升序；同 order 按创建时间倒序）
  const sorted = [...list].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <Megaphone size={16} className="text-primary-600" />
          <span>共 {list.length} 条公告 · 仅「启用」且已排序的会展示在 Dashboard 走马灯</span>
        </div>
        <div className={`flex ${isMobile ? 'flex-col' : ''} gap-2`}>
          {list.length === 0 && (
            <button onClick={initialize} disabled={saving}
              className={`flex items-center justify-center gap-2 ${isMobile ? 'w-full' : ''} px-4 py-2 text-sm border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50`}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              初始化默认公告
            </button>
          )}
          <button onClick={() => setEditing(blank())}
            className={`flex items-center justify-center gap-2 ${isMobile ? 'w-full' : ''} px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm`}>
            <Plus size={15} /> 新增公告
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {msg.text}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center text-ink-3 bg-surface rounded-xl border border-hairline">
          <AlertTriangle size={40} className="mb-3 opacity-40" />
          <p className="text-sm">暂无公告</p>
          <button onClick={initialize} disabled={saving} className="mt-3 px-4 py-2 text-sm border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50">
            {saving ? '初始化中…' : '初始化默认公告'}
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-responsive">
              <thead className="bg-canvas border-b border-hairline">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-14">顺序</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-16">状态</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-24">标签</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">标题</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase">副标题</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-24">链接</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-2 uppercase w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((a) => (
                  <tr key={a._id} className={`hover:bg-canvas ${a.active ? '' : 'opacity-60'}`}>
                    <td data-label="顺序" className="px-4 py-2">
                      <input type="number" value={a.order || 0} onChange={(e) => changeOrder(a, e.target.value)}
                        className="w-14 px-2 py-1 border border-hairline rounded-md text-xs text-right focus:ring-2 focus:ring-primary-500" />
                    </td>
                    <td data-label="状态" className="px-4 py-2">
                      <button onClick={() => toggleActive(a)} aria-label={a.active ? '停用' : '启用'}
                        title={a.active ? '点击停用（前台不再展示）' : '点击启用（前台展示）'}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                          a.active ? 'bg-success/10 text-success border-success/30' : 'bg-canvas text-ink-3 border-hairline'
                        }`}>
                        <Power size={12} /> {a.active ? '启用' : '停用'}
                      </button>
                    </td>
                    <td data-label="标签" className="px-4 py-2 text-ink-2 text-xs whitespace-nowrap">{a.eyebrow || '—'}</td>
                    <td data-label="标题" className="px-4 py-2 text-ink font-medium max-w-[220px]">{a.title || '—'}</td>
                    <td data-label="副标题" className="px-4 py-2 text-ink-2 text-xs max-w-[280px] truncate" title={a.subtitle}>{a.subtitle || '—'}</td>
                    <td data-label="链接" className="px-4 py-2 text-xs">
                      {a.link ? (
                        <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline max-w-[120px] truncate" title={a.link}>
                          <ExternalLink size={12} /> {a.linkText || '链接'}
                        </a>
                      ) : <span className="text-ink-3">—</span>}
                    </td>
                    <td data-label="操作" className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing({ ...a })} aria-label={`编辑公告 ${a.title || a._id}`}
                          className="p-1 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded" title="编辑"><Pencil size={14} /></button>
                        <button onClick={() => remove(a)} aria-label={`删除公告 ${a.title || a._id}`}
                          className="p-1 text-ink-3 hover:text-danger hover:bg-danger/10 rounded" title="删除"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <Modal isOpen title={editing._id ? '编辑公告' : '新增公告'} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelClass}>顺序</label>
                <input type="number" value={editing.order || 0} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) || 0 })} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>小标签（eyebrow）</label>
                <input value={editing.eyebrow || ''} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} className={inputClass} placeholder="如 合规提醒" />
              </div>
            </div>
            <div>
              <label className={labelClass}>标题 *</label>
              <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} placeholder="走马灯主标题" />
            </div>
            <div>
              <label className={labelClass}>副标题</label>
              <textarea value={editing.subtitle || ''} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} rows={2} className={inputClass} placeholder="补充说明（短为宜，1/3 高度横幅单行截断）" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>跳转链接（可选）</label>
                <input value={editing.link || ''} onChange={(e) => setEditing({ ...editing, link: e.target.value })} className={inputClass} placeholder="https://… 或 /companies" />
              </div>
              <div>
                <label className={labelClass}>链接文案（可选）</label>
                <input value={editing.linkText || ''} onChange={(e) => setEditing({ ...editing, linkText: e.target.value })} className={inputClass} placeholder="如 立即查看" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4" />
              启用（在前台 Dashboard 走马灯展示）
            </label>

            <div className="flex justify-end gap-3 pt-2 border-t border-hairline">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">取消</button>
              <button type="button" disabled={saving || !editing.title?.trim()} onClick={saveEditor}
                className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
