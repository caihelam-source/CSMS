import { useState, useCallback } from 'react'

/**
 * useAsyncAction — unified loading/error state for async operations
 * Eliminates duplicated try/catch + setLoading/setError patterns across pages.
 *
 * @param {Function} asyncFn — the async function to wrap
 * @param {Object} options — { onSuccess, onError, toastSuccess, toastError }
 *
 * @returns { execute, loading, error, clearError }
 */
export const useAsyncAction = (asyncFn, options = {}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError('')
    try {
      const result = await asyncFn(...args)
      if (options.onSuccess) options.onSuccess(result)
      return result
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '操作失败'
      setError(msg)
      if (options.onError) options.onError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [asyncFn, options.onSuccess, options.onError])

  const clearError = useCallback(() => setError(''), [])

  return { execute, loading, error, clearError }
}

export default useAsyncAction
