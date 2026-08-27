import { AlertCircle } from 'lucide-react'

/**
 * FormError — 表单校验错误提示（设计语言：红色提示 + 图标）
 * 与 .input-field 的 focus 红边配合，统一全站表单错误态。
 */
const FormError = ({ children, className = '' }) =>
  children ? (
    <p className={`flex items-center gap-1.5 text-sm text-danger mt-1 ${className}`}>
      <AlertCircle size={14} className="shrink-0" />
      {children}
    </p>
  ) : null

export default FormError
