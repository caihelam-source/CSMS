import { useState, useMemo, useCallback, useRef } from 'react'

/**
 * useSearchFilter — reusable search + filter logic for list pages
 * Eliminates duplicated search/filter state and filtered computation across pages.
 *
 * @param {Array} items — full data array
 * @param {Function} filterFn — (item, searchLower, filters) => boolean
 *   - searchLower: lowercase search term
 *   - filters: object of active filter values
 *   NOTE: filterFn is stored via ref, so inline functions won't cause re-computation.
 * @param {Object} initialFilters — e.g. { status: '', priority: '' }
 *
 * @returns { search, setSearch, filters, setFilter, resetFilters, filtered, count }
 */
export const useSearchFilter = (items, filterFn, initialFilters = {}) => {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(initialFilters)

  // Use ref to avoid filterFn causing useMemo to recalculate on every render
  const filterFnRef = useRef(filterFn)
  filterFnRef.current = filterFn

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setSearch('')
    setFilters(initialFilters)
  }, [initialFilters])

  const searchLower = search.toLowerCase()

  const filtered = useMemo(() => {
    if (!searchLower && Object.values(filters).every(v => !v || v === 'all')) return items
    return items.filter(item => filterFnRef.current(item, searchLower, filters))
  }, [items, searchLower, filters])

  return { search, setSearch, filters, setFilter, resetFilters, filtered, count: filtered.length }
}

export default useSearchFilter
