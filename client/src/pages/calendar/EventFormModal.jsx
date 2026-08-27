// 新建 / 编辑自建事件表单（Modal）。title/date 必填校验。
// 编辑态（initial 含 id 且为 user_event）显示「删除」。
import { useState, useEffect } from 'react'
import { SOURCE_COLOR, EVENT_CATEGORY_OPTIONS } from './calendarConstants'

const toDateInput = (d) => {
  const x = new Date(d)
  if (isNaN(x.getTime())) return ''
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-3 mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function EventFormModal({ open, initial, companies, onClose, onSubmit, onDelete, submitting }) {
  const [form, setForm] = useState({ title: '', date: '', time: '', allDay: true, companyId: '', category: '', note: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        title: initial.title || '',
        date: toDateInput(initial.date),
        time: initial.time || '',
        allDay: initial.allDay !== false,
        companyId: initial.companyId || '',
        category: initial.category || '',
        note: initial.note || '',
      })
    } else {
      setForm({ title: '', date: toDateInput(new Date()), time: '', allDay: true, companyId: '', category: '', note: '' })
    }
    setError('')
  }, [open, initial])

  if (!open) return null
  const isEdit = !!initial?.id
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError('请填写标题')
      return
    }
    if (!form.date) {
      setError('请选择日期')
      return
    }
    onSubmit({
      title: form.title.trim(),
      date: form.date,
      time: form.allDay ? '' : form.time,
      allDay: form.allDay,
      companyId: form.companyId || null,
      category: form.category || '',
      note: form.note || '',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface shadow-3 border border-hairline"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <h3 className="font-semibold text-ink">
            {isEdit ? '编辑事件' : '新建事件'}
            <span className="text-xs text-ink-3 ml-1" style={{ color: SOURCE_COLOR.user_event }}>· 我的事件</span>
          </h3>
          <button onClick={onClose} className="tap-target w-8 h-8 rounded-lg text-ink-3 hover:bg-canvas transition-colors" aria-label="关闭">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-danger">{error}</div>}
          <Field label="标题 *">
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500"
              placeholder="如：董事会现场会"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期 *">
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500"
              />
            </Field>
            <Field label="时间">
              <input
                type="time"
                value={form.time}
                disabled={form.allDay}
                onChange={(e) => set('time', e.target.value)}
                className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500 disabled:opacity-50"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => set('allDay', e.target.checked)}
              className="accent-primary-600"
            />
            全天事件
          </label>
          <Field label="关联公司">
            <select
              value={form.companyId}
              onChange={(e) => set('companyId', e.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500"
            >
              <option value="">— 个人（不关联公司）—</option>
              {companies.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="分类">
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500"
            >
              <option value="">— 未分类 —</option>
              {EVENT_CATEGORY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="备注">
            <textarea
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-500"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-hairline">
          {isEdit ? (
            <button
              onClick={() => onDelete(initial)}
              disabled={submitting}
              className="tap-target px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="tap-target px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-canvas">取消</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="tap-target px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
