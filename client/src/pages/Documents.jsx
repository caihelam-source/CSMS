import DocumentManager from '../components/DocumentManager'

// Document 入口：统一文件管理中心（与 Company 文件 Tab 共享同一套数据与能力）
export default function Documents() {
  return <DocumentManager showExport />
}
