// useUsers — 管理后台用户列表 / 增删改取数（D1 等价重构，下沉自原 AdminPanel）。
import { useState, useEffect, useCallback } from 'react'
import { userService } from '../services/index.js'
import { normalizeUser } from '../components/admin/_shared'

// 用户加载后为每条补 accessibleCompanies 默认字段（与原有 loadUsers 行为一致）。
const mapUsers = (res) =>
  (res.data?.data || res.data || []).map(u => ({ ...u, accessibleCompanies: u.accessibleCompanies || [] }))

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await userService.getAll()
      setUsers(mapUsers(res))
    } catch (err) {
      console.error('[useUsers] load users failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const createUser = useCallback(async (payload) => {
    const res = await userService.create(payload)
    const created = normalizeUser(res.data?.data || res.data)
    setUsers(us => [...us, created])
    return created
  }, [])

  const updateUser = useCallback(async (id, payload) => {
    const res = await userService.update(id, payload)
    const updated = normalizeUser(res.data?.data || res.data)
    setUsers(us => us.map(u => u.id === id ? updated : u))
    return updated
  }, [])

  const removeUser = useCallback(async (id) => {
    await userService.remove(id)
    setUsers(us => us.filter(u => u.id !== id))
  }, [])

  return { users, loading, loadUsers, createUser, updateUser, removeUser, setUsers }
}
