import { useCallback, useState } from 'react'
import { FileCode, ArrowLeft } from 'lucide-react'
import { PageHeader } from '../components/UIHelpers'
import TemplateList from '../components/templates/TemplateList'
import TemplateFill from '../components/templates/TemplateFill'
import TemplateBuilder from '../components/templates/TemplateBuilder'

/**
 * Templates — 文档模板页面容器（同页三视图状态机，非弹窗）。
 *
 * view:
 *  - 'list'    模板列表（全员可见，管理入口按 canEdit 收敛 = admin 或 secretary）
 *  - 'fill'    模板填写（左表单 / 右 A4 预览 + 打印 / 导出 Word / 复制 HTML）
 *  - 'builder' Schema 模板编辑器（新建 / 编辑 docSchema，canEdit 才可进入）
 *
 * @returns {JSX.Element}
 */
const Templates = () => {
  const [view, setView] = useState('list')
  const [activeTemplate, setActiveTemplate] = useState(null)

  const backToList = useCallback(() => {
    setView('list')
    setActiveTemplate(null)
  }, [])

  const handleFill = useCallback((template) => {
    setActiveTemplate(template)
    setView('fill')
  }, [])

  const handleNew = useCallback(() => {
    setActiveTemplate(null)
    setView('builder')
  }, [])

  const handleEdit = useCallback((template) => {
    setActiveTemplate(template)
    setView('builder')
  }, [])

  const subtitleMap = {
    list: '管理 Schema 驱动的合规文书模板',
    fill: activeTemplate?.name ? `填写：${activeTemplate.name}` : '填写模板',
    builder: activeTemplate?.name ? `编辑：${activeTemplate.name}` : '新建模板',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="文档模板"
        subtitle={subtitleMap[view]}
        icon={FileCode}
        actions={
          view !== 'list' ? (
            <button
              type="button"
              onClick={backToList}
              className="flex items-center gap-1.5 px-3 py-2 border border-hairline text-ink rounded-lg hover:bg-canvas text-sm font-medium"
            >
              <ArrowLeft size={15} /> 返回列表
            </button>
          ) : null
        }
      />

      {view === 'list' && (
        <TemplateList onFill={handleFill} onNew={handleNew} onEdit={handleEdit} />
      )}

      {view === 'fill' && activeTemplate && (
        <TemplateFill template={activeTemplate} onBack={backToList} />
      )}

      {view === 'builder' && (
        <TemplateBuilder template={activeTemplate} onBack={backToList} onSaved={backToList} />
      )}
    </div>
  )
}

export default Templates
