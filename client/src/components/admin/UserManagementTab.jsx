// UserManagementTab — 用户管理（D1 等价重构，搬迁自 AdminPanel 的 users Tab 分支）。
import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail, Loader2 } from 'lucide-react'
import { useUsers } from '../../hooks/useUsers'
import { useAuth } from '../../contexts/AuthContext'
import { roleInfo, UserForm } from './_shared'
import { DeleteConfirmModal } from '../../components/UIHelpers'
import Modal from '../../components/Modal'

export default function UserManagementTab() {
  const { users, loading: listLoading, createUser, updateUser, removeUser } = useUsers()
  const { user: currentUser } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (u) => { setEditTarget(u); setModalOpen(true) }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editTarget) {
        const payload = { name: form.name, email: form.email, role: form.role, isActive: form.status === 'active' }
        await updateUser(editTarget.id, payload)
      } else {
        const payload = { name: form.name, email: form.email, password: form.password, role: form.role }
        await createUser(payload)
      }
      setModalOpen(false)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await removeUser(deleteTarget.id)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Delete failed'
      alert(msg)
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-ink-2">{listLoading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} registered`}</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-hairline overflow-hidden shadow-sm">
        <table className="w-full text-sm table-responsive">
          <thead className="bg-canvas border-b border-hairline">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-2 uppercase tracking-wide">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {listLoading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3"><Loader2 className="inline animate-spin" size={18} /> Loading users…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-3">No users found.</td></tr>
            ) : users.map(u => {
              const ri = roleInfo(u.role)
              const RoleIcon = ri.icon
              const isMe = u.email === currentUser?.email
              return (
                <tr key={u.id} className="hover:bg-canvas transition-colors">
                  <td data-label="User" className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">
                        {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-ink">{u.name}</span>
                          {isMe && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">You</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-ink-3 mt-0.5">
                          <Mail size={11} />{u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role" className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ri.color}`}>
                      <RoleIcon size={12} />{ri.label}
                    </span>
                  </td>
                  <td data-label="Status" className="px-5 py-4">
                    {u.status === 'active'
                      ? <span className="inline-flex items-center gap-1 text-success text-xs"><span className="w-1.5 h-1.5 rounded-full bg-success" />Active</span>
                      : <span className="inline-flex items-center gap-1 text-ink-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-ink-3" />Inactive</span>}
                  </td>
                  <td data-label="Joined" className="px-5 py-4 text-ink-3 text-xs">{u.joined}</td>
                  <td data-label="操作" className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-ink-3 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                        <Pencil size={15} />
                      </button>
                      {!isMe && (
                        <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 rounded-lg">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit User' : 'Add New User'} size="md">
        <UserForm initial={editTarget || {}} onSave={handleSave} onCancel={() => setModalOpen(false)} loading={saving} currentUserId={currentUser?.id} />
      </Modal>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={false}
      />
    </div>
  )
}
