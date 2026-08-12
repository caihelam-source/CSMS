import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FileCode, Plus, Zap, Pencil, Trash2, Copy, PenLine, RefreshCw } from 'lucide-react'
import { templateService } from '../../services/index.js'
import { LoadingSpinner, EmptyState, SearchBar, DeleteConfirmModal } from '../UIHelpers'
import { TEMPLATE_CATEGORY_OPTIONS, categoryLabel, categoryBadge } from '../../constants/templateCategories'
import { useAuth } from '../../contexts/AuthContext'

/**
 * 从归一化响应中安全提取模板数组。
 * 兼容 { templates: [] } / { data: { templates: [] } } / 裸数组等多种形状。
 * @param {*} res 服务层返回
 * @returns {Array<object>}
 */
function pickTemplates(res) {
  const payload = res?.data ?? res
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.templates)) return payload.templates
  const inner = payload?.data
  if (Array.isArray(inner)) return inner
  if (Array.isArray(inner?.templates)) return inner.templates
  return []
}

/**
 * 从归一化响应中提取单个对象载荷。
 * @param {*} res 服务层返回
 * @param {string} key 复数/单数键名
 * @returns {object|null}
 */
function pickPayload(res, key) {
  const payload = res?.data ?? res
  if (!payload || typeof payload !== 'object') return null
  if (payload[key] && typeof payload[key] === 'object') return payload[key]
  const inner = payload.data
  if (inner && typeof inner === 'object') {
    if (inner[key] && typeof inner[key] === 'object') return inner[key]
    return inner
  }
  return payload
}

/** 提取后端错误消息。 */
function errMsg(e, fallback) {
  return e?.response?.data?.message || e?.message || fallback
}

/**
 * TemplateList — 模板列表视图（同页三视图状态机的 'list' 分支）。
 *
 * @param {object} props
 * @param {(template:object)=>void} props.onFill 点击「填写」
 * @param {()=>void} props.onNew 点击「新建模板」（admin）
 * @param {(template:object)=>void} props.onEdit 点击「编辑」（admin）
 * @returns {JSX.Element}
 */
const TemplateList = ({ onFill, onNew, onEdit }) => {
  const { canEdit } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await templateService.getAll()
      setTemplates(pickTemplates(res))
    } catch (e) {
      toast.error(errMsg(e, '加载模板失败'))
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      const matchSearch =
        !q ||
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q)
      const matchCategory = !category || t.category === category
      return matchSearch && matchCategory
    })
  }, [templates, search, category])

  /** 初始化内置模板（admin）。 */
  const handleInit = async () => {
    setBusy(true)
    try {
      const res = await templateService.initPresets()
      const payload = pickPayload(res, 'result') || {}
      const deleted = payload.deleted ?? 0
      const upserted = payload.upserted ?? 0
      toast.success(`已清理 ${deleted} 条旧模板，写入 ${upserted} 个内置模板`)
      await fetchTemplates()
    } catch (e) {
      toast.error(errMsg(e, '初始化失败'))
    } finally {
      setBusy(false)
    }
  }

  /** 复制模板（admin）。 */
  const handleDuplicate = async (template) => {
    setBusy(true)
    try {
      await templateService.duplicate(template._id, { name: `${template.name}（副本）` })
      toast.success('已复制模板')
      await fetchTemplates()
    } catch (e) {
      toast.error(errMsg(e, '复制失败'))
    } finally {
      setBusy(false)
    }
  }

  /** 删除模板（admin，内置模板后端返 403）。 */
  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await templateService.delete(deleteTarget._id)
      setTemplates((list) => list.filter((t) => t._id !== deleteTarget._id))
      toast.success('已删除模板')
      setDeleteTarget(null)
    } catch (e) {
      if (e?.response?.status === 403) toast.error('内置模板不可删除')
      else toast.error(errMsg(e, '删除失败'))
    } finally {
      setBusy(false)
    }
  }

  const iconBtn =
    'p-1.5 rounded-lg text-ink-3 transition-colors hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="space-y-5">
      {/* 工具条 */}
      <div className="bg-surface rounded-xl border border-hairline p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索模板名称或描述..." />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">全部分类</option>
            {TEMPLATE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchTemplates}
            title="刷新"
            className="px-3 py-2 border border-hairline rounded-lg hover:bg-canvas"
          >
            <RefreshCw size={15} className="text-ink-2" />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleInit}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium disabled:opacity-50"
              >
                <Zap size={15} /> 初始化内置模板
              </button>
              <button
                type="button"
                onClick={onNew}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus size={15} /> 新建模板
              </button>
            </>
          )}
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <LoadingSpinner text="加载模板中..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title={templates.length === 0 ? '暂无模板' : '没有匹配的模板'}
          description={templates.length === 0 ? '可先初始化系统内置的合规文书模板。' : '尝试调整搜索关键词或分类筛选。'}
          action={
            templates.length === 0 && canEdit ? (
              <button
                type="button"
                onClick={handleInit}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
              >
                <Zap size={15} /> 初始化内置模板
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const vars = Array.isArray(t.variables) ? t.variables : []
            return (
              <div
                key={t._id}
                className="bg-surface rounded-xl border border-hairline shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryBadge(t.category)}`}>
                    {categoryLabel(t.category)}
                  </span>
                  {t.isPreset === true && (
                    <span className="shrink-0 text-xs bg-info/10 text-primary-700 px-1.5 py-0.5 rounded">内置</span>
                  )}
                </div>

                <h3 className="font-semibold text-ink mb-1 break-words" title={t.name}>{t.name}</h3>
                {t.description && <p className="text-xs text-ink-2 mb-3 line-clamp-2">{t.description}</p>}

                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {vars.slice(0, 6).map((v, i) => {
                      const label = typeof v === 'string' ? v : (v?.label || v?.key || '')
                      return (
                        <span key={`${label}-${i}`} className="text-xs bg-canvas text-ink-2 px-1.5 py-0.5 rounded">
                          {label}
                        </span>
                      )
                    })}
                    {vars.length > 6 && (
                      <span className="text-xs bg-canvas text-ink-2 px-1.5 py-0.5 rounded">+{vars.length - 6}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-hairline mt-auto">
                  <button
                    type="button"
                    onClick={() => onFill(t)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 font-medium"
                  >
                    <PenLine size={13} /> 填写
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        title="编辑"
                        className={`${iconBtn} hover:text-primary-600`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(t)}
                        disabled={busy}
                        title="复制"
                        className={`${iconBtn} hover:text-primary-600`}
                      >
                        <Copy size={15} />
                      </button>
                      {t.isPreset !== true && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          title="删除"
                          className={`${iconBtn} hover:text-danger hover:bg-danger/10`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={busy}
      />
    </div>
  )
}

export default TemplateList
