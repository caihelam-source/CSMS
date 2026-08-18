// DataScopeTab — 数据权限分配（D1 等价重构，搬迁自 AdminPanel 的 scope Tab 分支）。
import { useState, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { useUsers } from '../../hooks/useUsers'
import { useAuth } from '../../contexts/AuthContext'
import { userService, companyService } from '../../services/index.js'

export default function DataScopeTab() {
  const { users, setUsers } = useUsers()
  const { applyScopeUpdate } = useAuth()
  const [companies, setCompanies] = useState([])
  const [scopeUserId, setScopeUserId] = useState(null)
  const [scopeSel, setScopeSel] = useState([])
  const [scopeSaving, setScopeSaving] = useState(false)

  const loadCompanies = async () => {
    try {
      const res = await companyService.getAll()
      const list = res.data?.data || res.data || []
      setCompanies(Array.isArray(list) ? list : (list.data || []))
    } catch (err) { console.error('[DataScopeTab] load companies failed:', err) }
  }

  useEffect(() => { loadCompanies() }, [])

  const openScope = (u) => {
    setScopeUserId(u.id)
    setScopeSel(u.accessibleCompanies || [])
  }
  const saveScope = async () => {
    setScopeSaving(true)
    try {
      const res = await userService.update(scopeUserId, { accessibleCompanies: scopeSel })
      const updated = res.data?.data || res.data
      const uid = updated?._id || updated?.id || scopeUserId
      setUsers(us => us.map(u => u.id === uid ? { ...u, accessibleCompanies: scopeSel } : u))
      // 改的是自己 → 立即同步登录态，页面无声过滤即时生效（免重新登录）
      applyScopeUpdate(uid, scopeSel)
      setScopeUserId(null)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save scope failed'
      alert(msg)
    } finally {
      setScopeSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm text-primary-700">
        为每位非 admin/auditor 用户分配其可访问的公司范围。admin 与 auditor 默认跨公司可见（不受限）。未分配的用户将看不到任何公司数据。
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 用户列表 */}
        <div className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline font-medium text-ink text-sm">用户</div>
          <div className="divide-y divide-gray-100 max-h-[60vh] overflow-auto">
            {users.filter(u => u.role !== 'admin' && u.role !== 'auditor').map(u => (
              <button key={u.id} onClick={() => openScope(u)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-canvas transition-colors ${scopeUserId === u.id ? 'bg-primary-50' : ''}`}>
                <div>
                  <div className="text-sm font-medium text-ink">{u.name}</div>
                  <div className="text-xs text-ink-3">{u.email}</div>
                </div>
                <span className="text-xs text-ink-2">{(u.accessibleCompanies || []).length} 家</span>
              </button>
            ))}
          </div>
        </div>

        {/* 公司多选 */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-hairline shadow-sm p-5">
          {scopeUserId ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-ink">分配可访问公司</h3>
                <span className="text-sm text-ink-2">已选 {scopeSel.length} 家</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-auto">
                {companies.map(c => {
                  const cid = c._id || c.id
                  const checked = scopeSel.includes(cid)
                  return (
                    <label key={cid} className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer ${checked ? 'border-primary-400 bg-primary-50' : 'border-hairline hover:border-hairline'}`}>
                      <input type="checkbox" checked={checked} onChange={() => setScopeSel(s => s.includes(cid) ? s.filter(x => x !== cid) : [...s, cid])} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm text-ink truncate">{c.name}</div>
                        <div className="text-xs text-ink-3">{c.registrationNumber}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setScopeUserId(null)} className="px-4 py-2 text-sm border border-hairline rounded-lg hover:bg-canvas text-ink">取消</button>
                <button onClick={saveScope} disabled={scopeSaving} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                  {scopeSaving ? '保存中…' : '保存权限'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-ink-3">
              <Building2 size={40} className="mb-3 opacity-40" />
              <p className="text-sm">从左侧选择一位用户以分配公司数据权限</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
