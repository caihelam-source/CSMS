// useAuditLogs — 审计日志取数（D1 等价重构，下沉自原 AdminPanel 的 loadAudit）。
import { useState, useEffect, useCallback } from 'react'
import { auditService } from '../services/index.js'

const mapAudit = (res) => {
  const list = res.data?.data || res.data || []
  return Array.isArray(list) ? list : (list.data || [])
}

export function useAuditLogs() {
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(false)

  const loadAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditService.getAll()
      setAuditLogs(mapAudit(res))
    } catch (err) {
      console.error('[useAuditLogs] load audit failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAudit() }, [loadAudit])

  return { auditLogs, loading, loadAudit }
}
