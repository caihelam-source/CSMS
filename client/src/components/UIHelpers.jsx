import { Link } from 'react-router-dom'
import Modal from './Modal'
import { AlertTriangle, Paperclip } from 'lucide-react'

/**
 * LoadingSpinner — reusable loading indicator
 * Usage: <LoadingSpinner /> or <LoadingSpinner size="lg" text="Loading..." />
 * Sizes: xs (button inline), sm, md (default), lg
 * Variant: "inline" for inside buttons, "centered" (default) for page-level
 */
export const LoadingSpinner = ({ size = 'md', text = '', variant = 'centered', className = '' }) => {
  const sizeMap = { xs: 'h-4 w-4', sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-12 w-12' }
  const borderMap = { xs: 'border-2', sm: 'border', md: 'border-b-2', lg: 'border-b-2' }
  const colorMap = { xs: 'border-current border-r-transparent', sm: 'border-primary-600', md: 'border-primary-600', lg: 'border-primary-600' }

  const spinner = <div className={`animate-spin rounded-full ${borderMap[size]} ${colorMap[size]} ${sizeMap[size]} ${className}`} />

  if (variant === 'inline') return spinner

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {spinner}
      {text && <p className="text-ink-3 text-sm mt-3">{text}</p>}
    </div>
  )
}

/**
 * EmptyState — reusable empty state placeholder
 * Usage: <EmptyState icon={FileText} title="暂无数据" description="点击添加" action={<button>...</button>} />
 */
export const EmptyState = ({ icon: Icon, title = '暂无数据', description = '', action = null }) => (
  <div className="text-center py-16 text-ink-3">
    {Icon && <Icon size={48} className="mx-auto mb-4 opacity-30" />}
    <p className="text-lg font-medium text-ink-2 mb-1">{title}</p>
    {description && <p className="text-sm text-ink-3 mb-4">{description}</p>}
    {action}
  </div>
)

/**
 * FormField — reusable form field with label, validation hint
 * Usage: <FormField label="名称" required error={errors.name}><input ... /></FormField>
 */
export const FormField = ({ label, required = false, error = '', children, className = '' }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-ink mb-1">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-danger mt-1">{error}</p>}
  </div>
)

/**
 * PageHeader — standard page header with title, subtitle, and action buttons
 * Usage: <PageHeader title="合规提醒" subtitle="跟踪截止日期" icon={Bell} actions={<button>...</button>} />
 */
export const PageHeader = ({ title, subtitle = '', icon: Icon, actions = null, iconColor = 'text-primary-600' }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
        {Icon && <Icon className={iconColor} size={26} />}
        {title}
      </h1>
      {subtitle && <p className="text-ink-2 text-sm mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
  </div>
)

/**
 * SearchBar — standard search input with icon
 * Usage: <SearchBar value={search} onChange={setSearch} placeholder="搜索..." />
 */
export const SearchBar = ({ value, onChange, placeholder = '搜索...', className = '' }) => (
  <div className={`relative flex-1 min-w-[180px] ${className}`}>
    <svg className="absolute left-3 top-2.5 text-ink-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
  </div>
)

/**
 * DeleteConfirmModal — standard delete confirmation dialog
 * Usage: <DeleteConfirmModal isOpen={!!deleteTarget} name={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={saving} />
 */
export const DeleteConfirmModal = ({ isOpen, name, onConfirm, onCancel, loading = false }) => (
  <Modal isOpen={isOpen} onClose={onCancel} title="确认删除" size="sm">
    <p className="text-ink-2 mb-6">确定删除 <strong>{name}</strong>？此操作不可撤销。</p>
    <div className="flex justify-end gap-3">
      <button onClick={onCancel} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
      <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
        {loading ? '删除中...' : '确认删除'}
      </button>
    </div>
  </Modal>
)

/**
 * DetailHeader — detail page header with back button, avatar/initial, title and subtitle
 * Usage: <DetailHeader onBack={() => navigate('/companies')} title={company.name} subtitle={company.registrationNumber} initials={company.name?.charAt(0)} />
 */
export const DetailHeader = ({ onBack, title, subtitle = '', initials = '?', avatarColor = 'bg-primary-100 text-primary-700', badges = null }) => (
  <div className="flex items-center gap-4">
    <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100">
      <svg className="h-5 w-5 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-xl font-bold`}>
      {initials}
    </div>
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        {title}
        {badges}
      </h1>
      {subtitle && <p className="text-ink-2 mt-0.5">{subtitle}</p>}
    </div>
  </div>
)

// Shared CSS constants — must be defined before any component that uses them
const INP = 'w-full px-3 py-2 border border-hairline rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const LBL = 'block text-sm font-medium text-ink mb-1'

export { INP as inputClass, LBL as labelClass }

/**
 * CompleteWithAttachmentModal — shared "mark complete" dialog with note + file attachment
 * Used by TaskDetail and ComplianceReminderDetail (deduplicated from both pages)
 * Usage: <CompleteWithAttachmentModal isOpen={completeOpen} onClose={() => setCompleteOpen(false)}
 *   title="标记任务完成" warningText="必须填写..."
 *   noteText={noteText} onNoteChange={setNoteText}
 *   uploadFile={uploadFile} onFileChange={f => setUploadFile(f)} onFileRemove={() => setUploadFile(null)}
 *   onConfirm={handleComplete} saving={saving} fileInputRef={fileInputRef} />
 */
export const CompleteWithAttachmentModal = ({
  isOpen, onClose, onConfirm, title = '标记完成',
  warningText = '', noteText, onNoteChange,
  uploadFile, onFileChange, onFileRemove,
  saving = false, fileInputRef,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
    <div className="space-y-4">
      {warningText && (
        <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg text-sm text-warning flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{warningText}</span>
        </div>
      )}
      <FormField label="完成备注">
        <textarea rows={3} className={INP}
          value={noteText} onChange={e => onNoteChange(e.target.value)} placeholder="请输入完成说明..." />
      </FormField>
      <FormField label="上传附件（可选，将归档到公司文档）">
        <input type="file" ref={fileInputRef} className={INP}
          onChange={e => onFileChange(e.target.files[0] || null)} />
        {uploadFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-2">
            <Paperclip size={14} /> {uploadFile.name}
            <button onClick={onFileRemove} className="text-danger hover:underline">移除</button>
          </div>
        )}
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-hairline rounded-lg text-ink hover:bg-canvas">取消</button>
        <button onClick={onConfirm} disabled={saving || (!noteText.trim() && !uploadFile)}
          className="px-4 py-2 text-sm bg-success text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
          {saving ? '处理中...' : '确认完成'}
        </button>
      </div>
    </div>
  </Modal>
)

/**
 * Usage: <span className={`rounded-full ${compliancePriorityColor(r.priority)}`}>{r.priority}</span>
 */
export const compliancePriorityColor = (p) => ({
  critical: 'bg-danger/10 text-danger border-danger/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-gray-100 text-ink-2 border-hairline',
}[p] || 'bg-gray-100 text-ink-2 border-hairline')

/**
 * Compliance status color helper
 */
export const complianceStatusColor = (s) => ({
  completed: 'bg-success/10 text-success',
  upcoming: 'bg-info/10 text-primary-700',
  active: 'bg-warning/10 text-warning',
  expired: 'bg-danger/10 text-danger',
}[s] || 'bg-gray-100 text-ink-2')

/**
 * Task priority color helper
 */
export const taskPriorityColor = (p) => ({
  urgent: 'bg-danger/10 text-danger border-danger/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-gray-100 text-ink-2 border-hairline',
}[p] || 'bg-gray-100 text-ink-2 border-hairline')

/**
 * Task status color helper
 */
export const taskStatusColor = (s) => ({
  completed: 'bg-success/10 text-success',
  in_progress: 'bg-info/10 text-primary-700',
  overdue: 'bg-danger/10 text-danger',
  pending: 'bg-gray-100 text-ink-2',
}[s] || 'bg-gray-100 text-ink-2')

/**
 * Jurisdiction — 统一英文枚举的展示映射（v5.0：与后端 Company/ComplianceRule enum 对齐）
 * 使用处：公司/规则列表徽章、详情页、Excel/文档 fallback。
 */
export const JURISDICTION_OPTIONS = [
  { value: 'HK', label: 'Hong Kong' },
  { value: 'BVI', label: 'BVI' },
  { value: 'Cayman', label: 'Cayman Islands' },
  { value: 'SG', label: 'Singapore' },
  { value: 'OTHER', label: 'Other' },
]

const JURISDICTION_LABELS = {
  HK: 'Hong Kong',
  BVI: 'BVI',
  Cayman: 'Cayman Islands',
  SG: 'Singapore',
  OTHER: 'Other',
  ALL: '全部',
}

/** 把存储值（HK/BVI/Cayman…）转成可读标签；未知值原样返回 */
export const jurisdictionLabel = (j) => JURISDICTION_LABELS[j] || j || '—'

/**
 * InfoCard — simple info card with title and children content
 * Usage: <InfoCard title="基本信息"><dl>...</dl></InfoCard>
 */
export const InfoCard = ({ title, children, className = '' }) => (
  <div className={`bg-canvas rounded-lg p-4 ${className}`}>
    <h4 className="text-sm font-semibold text-ink-2 mb-3">{title}</h4>
    {children}
  </div>
)

/**
 * TabNav — standard tab navigation bar
 * Usage: <TabNav tabs={[{ key: 'overview', label: '概览', icon: Building2 }]} active={activeTab} onChange={setActiveTab} />
 */
export const TabNav = ({ tabs, active, onChange }) => (
  <div className="flex gap-0 border-b border-hairline overflow-x-auto">
    {tabs.map(({ key, label, icon: Icon }) => (
      <button key={key} onClick={() => onChange(key)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          active === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-ink-2 hover:text-ink'
        }`}>
        {Icon && <Icon size={16} />}
        {label}
      </button>
    ))}
  </div>
)

/**
 * SectionSkeleton — pulsing placeholder used while a section loads independently.
 * Keeps the 360° view responsive: each panel shows its own skeleton instead of
 * blocking the whole page.
 * Usage: <SectionSkeleton lines={3} />
 */
export const SectionSkeleton = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-canvas rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
          <div className="h-2.5 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

/**
 * WarningBanner — colored alert banner for urgent/overdue items
 * Usage: <WarningBanner icon={Clock} title="逾期提醒" count={5} color="amber" items={[...]} renderItem={r => <span>{r.title}</span>} linkTo="/reminders" />
 */
export const WarningBanner = ({ icon: Icon, title, count, color = 'amber', items = [], renderItem, linkTo, linkLabel }) => {
  const colors = {
    red: { bg: 'bg-danger/10', border: 'border-danger/20', icon: 'text-danger', title: 'text-danger', count: 'text-red-600', item: 'border-red-100 hover:bg-danger/10', itemTitle: 'text-ink', itemSub: 'text-danger', link: 'text-red-600' },
    amber: { bg: 'bg-warning/10', border: 'border-warning/20', icon: 'text-warning', title: 'text-warning', count: 'text-warning', item: 'border-amber-100 hover:bg-warning/10', itemTitle: 'text-ink', itemSub: 'text-warning', link: 'text-warning' },
  }
  const c = colors[color] || colors.amber
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={c.icon} size={20} />
        <h3 className={`font-semibold ${c.title}`}>{title}</h3>
        <span className={`ml-auto text-sm ${c.count}`}>{count} 项</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((item, idx) => (
          <div key={idx} className={`flex items-center justify-between p-2 bg-surface rounded-lg border ${c.item}`}>
            {renderItem(item, c)}
          </div>
        ))}
        {items.length > 3 && linkTo && (
          <Link to={linkTo} className={`block text-center text-sm ${c.link} hover:underline py-1`}>
            {linkLabel || `查看全部 ${items.length} 项`} →
          </Link>
        )}
      </div>
    </div>
  )
}
