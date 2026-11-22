import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

// Keys that aren't filters: Clear filters keeps them, and changing them keeps the page.
const NOT_FILTERS = new Set(['q', 'page', 'open', 'mode'])
const KEEPS_PAGE = new Set(['page', 'open', 'mode'])

/**
 * Table state in the URL (DESIGN §8.5): `?status=&q=&<filter>=&page=` (+ `open`/`mode` for drawers).
 * `set({ q })` is debounced 300 ms; any filter or search change goes back to page 1; a default value leaves the URL.
 * @param {Record<string, string>} [defaults] e.g. `{ status: 'active' }`
 * @returns {{ params: Record<string, any> & { q: string, page: number }, set: (patch: Record<string, any>) => void, clear: () => void }}
 */
export function useTableParams(defaults = {}) {
  const [search, setSearch] = useSearchParams()
  const defaultsRef = useRef(defaults)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const params = useMemo(() => {
    const out = { q: '', page: 1, ...defaultsRef.current }
    for (const [key, value] of search) out[key] = key === 'page' ? Math.max(1, Number(value) || 1) : value
    return out
  }, [search])

  const apply = useCallback(
    (patch) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            const blank = value === '' || value == null || value === defaultsRef.current[key] || (key === 'page' && Number(value) <= 1)
            if (blank) next.delete(key)
            else next.set(key, String(value))
          }
          if (Object.keys(patch).some((key) => !KEEPS_PAGE.has(key))) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setSearch],
  )

  const set = useCallback(
    (patch) => {
      clearTimeout(timer.current)
      if ('q' in patch) timer.current = setTimeout(() => apply(patch), 300)
      else apply(patch)
    },
    [apply],
  )

  const clear = useCallback(
    () =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const key of [...next.keys()]) if (!NOT_FILTERS.has(key) || key === 'page') next.delete(key)
          return next
        },
        { replace: true },
      ),
    [setSearch],
  )

  return { params, set, clear }
}
