import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches, kept live. False where `matchMedia` doesn't exist (tests).
 * @param {string} query e.g. '(max-width: 720px)'
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
  )
}
