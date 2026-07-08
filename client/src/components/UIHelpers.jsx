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
      {text && <p className="text-gray-400 text-sm mt-3">{text}</p>}
    </div>
  )
}

/**
 * EmptyState — reusable empty state placeholder
 * Usage: <EmptyState icon={FileText} title="暂无数据" description="点击添加" action={<button>...</button>} />
 */
export const EmptyState = ({ icon: Icon, title = '暂无数据', description = '', action = null }) => (
  <div className="text-center py-16 text-gray-400">
    {Icon && <Icon size={48} className="mx-auto mb-4 opacity-30" />}
    <p className="text-lg font-medium text-gray-600 mb-1">{title}</p>
    {description && <p className="text-sm text-gray-400 mb-4">{description}</p>}
    {action}
  </div>
)

/**
 * FormField — reusable form field with label, validation hint
 * Usage: <FormField label="名称" required error={errors.name}><input ... /></FormField>
 */
export const FormField = ({ label, required = false, error = '', children, className = '' }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
)

/**
 * PageHeader — standard page header with title, subtitle, and action buttons
 * Usage: <PageHeader title="合规提醒" subtitle="跟踪截止日期" icon={Bell} actions={<button>...</button>} />
 */
export const PageHeader = ({ title, subtitle = '', icon: Icon, actions = null, iconColor = 'text-primary-600' }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        {Icon && <Icon className={iconColor} size={26} />}
        {title}
      </h1>
      {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
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
    <svg className="absolute left-3 top-2.5 text-gray-400 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
  </div>
)

/**
 * DeleteConfirmModal — standard delete confirmation dialog
 * Usage: <DeleteConfirmModal isOpen={!!deleteTarget} name={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={saving} />
 */
export const DeleteConfirmModal = ({ isOpen, name, onConfirm, onCancel, loading = false }) => (
  <Modal isOpen={isOpen} onClose={onCancel} title="确认删除" size="sm">
    <p className="text-gray-600 mb-6">确定删除 <strong>{name}</strong>？此操作不可撤销。</p>
    <div className="flex justify-end gap-3">
      <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
      <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
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
      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {subtitle && <p className="text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
)

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
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{warningText}</span>
        </div>
      )}
      <FormField label="完成备注">
        <textarea rows={3} className={inputClass}
          value={noteText} onChange={e => onNoteChange(e.target.value)} placeholder="请输入完成说明..." />
      </FormField>
      <FormField label="上传附件（可选，将归档到公司文档）">
        <input type="file" ref={fileInputRef} className={inputClass}
          onChange={e => onFileChange(e.target.files[0] || null)} />
        {uploadFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <Paperclip size={14} /> {uploadFile.name}
            <button onClick={onFileRemove} className="text-red-500 hover:underline">移除</button>
          </div>
        )}
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
        <button onClick={onConfirm} disabled={saving || (!noteText.trim() && !uploadFile)}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
          {saving ? '处理中...' : '确认完成'}
        </button>
      </div>
    </div>
  </Modal>
)

const INP = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const LBL = 'block text-sm font-medium text-gray-700 mb-1'

export { INP as inputClass, LBL as labelClass }

/**
 * Compliance priority color helper
 * Usage: <span className={`rounded-full ${compliancePriorityColor(r.priority)}`}>{r.priority}</span>
 */
export const compliancePriorityColor = (p) => ({
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}[p] || 'bg-gray-100 text-gray-600 border-gray-200')

/**
 * Compliance status color helper
 */
export const complianceStatusColor = (s) => ({
  completed: 'bg-green-100 text-green-700',
  upcoming: 'bg-blue-100 text-blue-700',
  active: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
}[s] || 'bg-gray-100 text-gray-600')

/**
 * Task priority color helper
 */
export const taskPriorityColor = (p) => ({
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}[p] || 'bg-gray-100 text-gray-600 border-gray-200')

/**
 * Task status color helper
 */
export const taskStatusColor = (s) => ({
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
}[s] || 'bg-gray-100 text-gray-600')

/**
 * InfoCard — simple info card with title and children content
 * Usage: <InfoCard title="基本信息"><dl>...</dl></InfoCard>
 */
export const InfoCard = ({ title, children, className = '' }) => (
  <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
    <h4 className="text-sm font-semibold text-gray-500 mb-3">{title}</h4>
    {children}
  </div>
)

/**
 * TabNav — standard tab navigation bar
 * Usage: <TabNav tabs={[{ key: 'overview', label: '概览', icon: Building2 }]} active={activeTab} onChange={setActiveTab} />
 */
export const TabNav = ({ tabs, active, onChange }) => (
  <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
    {tabs.map(({ key, label, icon: Icon }) => (
      <button key={key} onClick={() => onChange(key)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          active === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}>
        {Icon && <Icon size={16} />}
        {label}
      </button>
    ))}
  </div>
)

/**
 * WarningBanner — colored alert banner for urgent/overdue items
 * Usage: <WarningBanner icon={Clock} title="逾期提醒" count={5} color="amber" items={[...]} renderItem={r => <span>{r.title}</span>} linkTo="/reminders" />
 */
export const WarningBanner = ({ icon: Icon, title, count, color = 'amber', items = [], renderItem, linkTo, linkLabel }) => {
  const colors = {
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', title: 'text-red-800', count: 'text-red-600', item: 'border-red-100 hover:bg-red-50', itemTitle: 'text-red-900', itemSub: 'text-red-500', link: 'text-red-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', title: 'text-amber-800', count: 'text-amber-600', item: 'border-amber-100 hover:bg-amber-50', itemTitle: 'text-amber-900', itemSub: 'text-amber-500', link: 'text-amber-600' },
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
          <div key={idx} className={`flex items-center justify-between p-2 bg-white rounded-lg border ${c.item}`}>
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
