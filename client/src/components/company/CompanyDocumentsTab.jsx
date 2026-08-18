// CompanyDocumentsTab — 文件管理（D2 等价重构，搬迁自 CompanyDetail 的 documents Tab，复用 DocumentManager）。
// 行为 / 样式 / 交互与原版完全一致。
import { Upload } from 'lucide-react'
import { TabActionBar } from '../../components/UIHelpers'
import DocumentManager from '../../components/DocumentManager'

export default function CompanyDocumentsTab({ ctx }) {
  const { documents, companyId, onUploadRelated } = ctx

  return (
    <div className="space-y-4">
      <TabActionBar
        title="文件"
        count={documents.length}
        actionLabel="上传并关联会议"
        actionIcon={Upload}
        onAction={onUploadRelated}
      />
      <DocumentManager companyId={companyId} embedded showExport onDocumentsChange={ctx.setDocuments} />
    </div>
  )
}
