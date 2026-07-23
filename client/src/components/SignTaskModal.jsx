import Modal from './Modal'
import SignTaskForm from './SignTaskForm'

export default function SignTaskModal({ isOpen, onClose, onSuccess, title = '发起签署任务', initialDocument, initialCompanyId, initialPersonnelId, sourceKind, sourceLabel }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <SignTaskForm
        initialDocument={initialDocument}
        initialCompanyId={initialCompanyId}
        initialPersonnelId={initialPersonnelId}
        sourceKind={sourceKind}
        sourceLabel={sourceLabel}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </Modal>
  )
}
