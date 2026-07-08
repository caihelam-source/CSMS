import { useEffect, useState, useCallback } from 'react'
import Modal from './Modal'
import { AlertTriangle, Trash2 } from 'lucide-react'

/**
 * ConfirmDialog — replacement for window.confirm()
 * Usage: <ConfirmDialog isOpen={true} onConfirm={fn} onCancel={fn} title="..." message="..." />
 */
export const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title = '确认操作', message, confirmLabel = '确认', cancelLabel = '取消', variant = 'danger' }) => {
  const [loading, setLoading] = useState(false)

  useEffect(() => { setLoading(false) }, [isOpen])

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="flex items-start gap-3 mb-6">
        {variant === 'danger' ? (
          <div className="p-2 bg-red-100 rounded-lg shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
        ) : (
          <div className="p-2 bg-amber-100 rounded-lg shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
        )}
        <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button onClick={handleConfirm} disabled={loading}
          className={`px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
            variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
          }`}>
          {loading ? '处理中...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

/**
 * useConfirm hook — programmatic confirm dialog without window.confirm()
 * Returns { confirm, ConfirmDialogComponent }
 * Usage:
 *   const { confirm, ConfirmDialogComponent } = useConfirm()
 *   const handleDelete = async () => {
 *     const ok = await confirm({ title: '删除', message: '确定删除？' })
 *     if (!ok) return
 *     // proceed
 *   }
 *   // In JSX: {ConfirmDialogComponent}
 */
export const useConfirm = () => {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', confirmLabel: '确认', variant: 'danger' })
  const [resolver, setResolver] = useState(null)

  const confirm = useCallback(({ title = '确认操作', message, confirmLabel = '确认', variant = 'danger' } = {}) => {
    return new Promise((resolve) => {
      setState({ isOpen: true, title, message, confirmLabel, variant })
      setResolver(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, isOpen: false }))
    resolver?.(true)
    setResolver(null)
  }, [resolver])

  const handleCancel = useCallback(() => {
    setState(s => ({ ...s, isOpen: false }))
    resolver?.(false)
    setResolver(null)
  }, [resolver])

  const ConfirmDialogComponent = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
    />
  )

  return { confirm, ConfirmDialogComponent }
}

export default ConfirmDialog
