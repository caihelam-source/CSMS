import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Plus, GripVertical, ShieldAlert, AlertTriangle } from 'lucide-react'
import { templateService } from '../../services/index.js'
import { LoadingSpinner, inputClass, labelClass } from '../UIHelpers'
import SchemaDocRenderer from '../../schemaDoc/SchemaDocRenderer'
import { deepClone, createSampleData } from '../../schemaDoc/schemaUtils'
import { TEMPLATE_CATEGORY_OPTIONS } from '../../constants/templateCategories'
import { useAuth } from '../../contexts/AuthContext'
import BuilderFieldProps from './BuilderFieldProps'
import {
  BUILDER_FIELD_TYPES,
  buildDocSchema,
  createBlankField,
  getFieldTypeLabel,
  moveField,
  validateDraft,
} from './builderHelpers'

/**
 * TemplateBuilder.jsx — 模板编辑器主容器（三栏：字段列表 / 属性表单 / A4 实时预览）。
 *
 * 本期只编辑 fields[] + meta，layoutMode 固定为 'auto'，由 buildDocPlan 的
 * autoSections() 负责自动成文，因此不做区块（sections）可视化编排。
 *
 * 安全红线：不出现 eval / new Function / dangerouslySetInnerHTML。
 */

/**
 * 从归一化响应中提取模板对象（兼容多种包裹形状）。
 * @param {*} res 服务层返回
 * @returns {object|null} 模板对象
 */
function pickTemplate(res) {
  const payload = res?.data ?? res
  if (!payload || typeof payload !== 'object') return null
  if (payload.template && typeof payload.template === 'object') return payload.template
  const inner = payload.data
  if (inner && typeof inner === 'object') {
    if (inner.template && typeof inner.template === 'object') return inner.template
    return inner
  }
  return payload
}

/** 提取后端错误消息。 */
function errMsg(e, fallback) {
  return e?.response?.data?.message || e?.message || fallback
}

/**
 * 由模板对象推导顶部 meta 草稿。
 * @param {object|null} template 模板对象
 * @returns {object} meta 草稿
 */
function initialMeta(template) {
  const schemaMeta = template?.docSchema?.meta || {}
  return {
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'other',
    docTitle: schemaMeta.docTitle || template?.name || '',
    docSubtitle: schemaMeta.docSubtitle || '',
    companyField: schemaMeta.companyField || '',
    headerMeta: Array.isArray(schemaMeta.headerMeta) ? deepClone(schemaMeta.headerMeta) : [],
    fileNamePattern: schemaMeta.fileNamePattern || '',
    archiveNote: schemaMeta.archiveNote || '',
  }
}

/**
 * 由模板对象推导字段草稿（深拷贝，避免污染列表数据）。
 * @param {object|null} template 模板对象
 * @returns {object[]} 字段数组
 */
function initialFields(template) {
  const list = template?.docSchema?.fields
  return Array.isArray(list) ? deepClone(list) : []
}

/**
 * 模板编辑器。
 *
 * @param {object} props
 * @param {object|null} props.template 待编辑的模板；null 表示新建
 * @param {() => void} [props.onSaved] 保存成功回调
 * @param {() => void} [props.onBack] 返回列表回调
 * @returns {JSX.Element}
 */
const TemplateBuilder = ({ template = null, onSaved, onBack }) => {
  const { canEdit } = useAuth()

  const [meta, setMeta] = useState(() => initialMeta(template))
  const [fields, setFields] = useState(() => initialFields(template))
  const [selected, setSelected] = useState(0)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(() => Boolean(template?._id && !template?.docSchema))
  const [dragIndex, setDragIndex] = useState(-1)
  const [addOpen, setAddOpen] = useState(false)

  /* ---------------- 编辑既有模板：补拉详情 ---------------- */

  useEffect(() => {
    let alive = true
    const id = template?._id
    if (!id || template?.docSchema) {
      setLoading(false)
      return () => { alive = false }
    }
    setLoading(true)
    templateService
      .getOne(id)
      .then((res) => {
        if (!alive) return
        const detail = pickTemplate(res)
        if (detail && detail.docSchema) {
          setMeta(initialMeta(detail))
          setFields(initialFields(detail))
          setSelected(0)
        }
      })
      .catch((e) => { if (alive) toast.error(errMsg(e, '加载模板详情失败')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [template])

  /* ---------------- 派生数据 ---------------- */

  const draftSchema = useMemo(() => buildDocSchema(meta, fields), [meta, fields])
  const sampleData = useMemo(() => createSampleData(draftSchema, {}), [draftSchema])
  const allKeys = useMemo(() => fields.map((f) => String(f?.key || '')), [fields])

  const selectedField = fields[selected] || null

  /* ---------------- 交互 ---------------- */

  /**
   * 更新 meta 的单个字段。
   * @param {string} key meta 键名
   * @param {*} value 新值
   */
  const patchMeta = (key, value) => {
    setMeta((prev) => ({ ...prev, [key]: value }))
  }

  /**
   * 新增字段并选中它。
   * @param {string} type 字段类型
   */
  const handleAddField = (type) => {
    const next = fields.concat(createBlankField(type, fields.map((f) => f?.key)))
    setFields(next)
    setSelected(next.length - 1)
    setAddOpen(false)
  }

  /**
   * 替换当前选中字段。
   * @param {object} next 新字段定义
   */
  const handleFieldChange = (next) => {
    setFields((prev) => prev.map((f, i) => (i === selected ? next : f)))
  }

  /** 删除当前选中字段。 */
  const handleFieldDelete = () => {
    setFields((prev) => prev.filter((_, i) => i !== selected))
    setSelected((prev) => Math.max(0, prev - 1))
  }

  /** HTML5 原生拖拽：记录源下标。 */
  const handleDragStart = (index) => (e) => {
    setDragIndex(index)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  /** HTML5 原生拖拽：允许放置。 */
  const handleDragOver = (e) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }

  /** HTML5 原生拖拽：落位并重排。 */
  const handleDrop = (index) => (e) => {
    e.preventDefault()
    if (dragIndex < 0 || dragIndex === index) {
      setDragIndex(-1)
      return
    }
    setFields((prev) => moveField(prev, dragIndex, index))
    setSelected(index)
    setDragIndex(-1)
  }

  /** 保存：先本地校验，再走 create / update。 */
  const handleSave = async () => {
    const list = validateDraft(meta, fields)
    setErrors(list)
    if (list.length > 0) {
      toast.error(list[0])
      return
    }
    setSaving(true)
    try {
      const body = {
        name: String(meta.name || '').trim(),
        description: String(meta.description || '').trim(),
        category: meta.category,
        engine: 'schema',
        schemaVersion: 1,
        docSchema: buildDocSchema(meta, fields),
        sampleData,
      }
      if (template?._id) await templateService.update(template._id, body)
      else await templateService.create(body)
      toast.success('已保存')
      if (typeof onSaved === 'function') onSaved()
    } catch (e) {
      toast.error(errMsg(e, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- 渲染 ---------------- */

  if (!canEdit) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-8 text-center">
        <ShieldAlert size={28} className="mx-auto mb-3 text-warning" />
        <p className="text-sm text-ink-2">仅管理员或公司秘书可编辑模板</p>
        <button
          type="button"
          onClick={() => { if (typeof onBack === 'function') onBack() }}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium"
        >
          <ArrowLeft size={15} /> 返回列表
        </button>
      </div>
    )
  }

  if (loading) return <LoadingSpinner text="加载模板中..." />

  return (
    <div className="space-y-4">
      {/* ---------- 顶部 meta 条 ---------- */}
      <div className="bg-surface border border-hairline rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className={labelClass} htmlFor="builder-name">模板名称 *</label>
            <input
              id="builder-name"
              type="text"
              className={inputClass}
              value={meta.name}
              onChange={(e) => patchMeta('name', e.target.value)}
              placeholder="董事会决议（通用）"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="builder-category">分类 *</label>
            <select
              id="builder-category"
              className={inputClass}
              value={meta.category}
              onChange={(e) => patchMeta('category', e.target.value)}
            >
              {TEMPLATE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="builder-doc-title">文档标题</label>
            <input
              id="builder-doc-title"
              type="text"
              className={inputClass}
              value={meta.docTitle}
              onChange={(e) => patchMeta('docTitle', e.target.value)}
              placeholder="董事会决议"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="builder-doc-subtitle">文档副标题</label>
            <input
              id="builder-doc-subtitle"
              type="text"
              className={inputClass}
              value={meta.docSubtitle}
              onChange={(e) => patchMeta('docSubtitle', e.target.value)}
              placeholder="BOARD RESOLUTION"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className={labelClass} htmlFor="builder-description">模板描述</label>
            <input
              id="builder-description"
              type="text"
              className={inputClass}
              value={meta.description}
              onChange={(e) => patchMeta('description', e.target.value)}
              placeholder="用于一句话说明该模板的适用场景"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={15} /> {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {errors.length > 0 && (
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
            <p className="text-sm font-medium text-danger mb-1.5 inline-flex items-center gap-1.5">
              <AlertTriangle size={15} /> 校验未通过（{errors.length} 项）
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {errors.map((msg, i) => (
                <li key={i} className="text-xs text-danger">{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- 三栏 ---------- */}
      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* 左 25% —— 字段列表 */}
        <div className="w-full xl:w-[25%] shrink-0">
          <div className="bg-surface border border-hairline rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">字段（{fields.length}）</p>
            </div>

            <ul className="space-y-1.5">
              {fields.map((field, index) => {
                const active = index === selected
                return (
                  <li
                    key={`${field?.key || 'field'}-${index}`}
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(index)}
                    onDragEnd={() => setDragIndex(-1)}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(index)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                        active
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-hairline bg-surface hover:bg-canvas'
                      } ${dragIndex === index ? 'opacity-50' : ''}`}
                    >
                      <GripVertical size={14} className="shrink-0 text-ink-3 cursor-grab" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink truncate">
                          {field?.label || '(未命名字段)'}
                          {field?.required && <span className="text-danger ml-0.5">*</span>}
                        </span>
                        <span className="block text-xs text-ink-3 font-mono truncate">{field?.key}</span>
                      </span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-canvas text-ink-2 border border-hairline">
                        {getFieldTypeLabel(field?.type)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {fields.length === 0 && (
              <p className="text-xs text-ink-3 text-center py-4">尚未添加字段</p>
            )}

            {/* 新增字段（下拉选类型） */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-dashed border-hairline text-ink-2 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Plus size={14} /> 新增字段
              </button>
              {addOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-hairline rounded-lg shadow-lg py-1 max-h-72 overflow-auto">
                  {BUILDER_FIELD_TYPES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleAddField(item.value)}
                      className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-canvas"
                    >
                      {item.label}
                      <span className="ml-2 text-xs text-ink-3 font-mono">{item.value}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-ink-3 pt-1">提示：拖动条目可调整字段顺序，预览会实时更新。</p>
          </div>
        </div>

        {/* 中 35% —— 属性表单 */}
        <div className="w-full xl:w-[35%] shrink-0">
          <BuilderFieldProps
            field={selectedField}
            allKeys={allKeys}
            onChange={handleFieldChange}
            onDelete={handleFieldDelete}
          />
        </div>

        {/* 右 40% —— A4 实时预览 */}
        <div className="w-full xl:w-[40%] xl:sticky xl:top-4">
          <div className="bg-white border border-hairline rounded-xl overflow-auto max-h-[calc(100vh-200px)] p-4">
            <SchemaDocRenderer docSchema={draftSchema} data={sampleData} mode="preview" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateBuilder
