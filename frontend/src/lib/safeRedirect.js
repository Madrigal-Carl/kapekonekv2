/**
 * Follow `?redirect=` only for internal paths, so links can't bounce users to another site.
 * @param {string | null | undefined} value
 * @param {string} fallback
 */
export function safeRedirect(value, fallback) {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const url = new URL(value, 'http://kapekonek.local')
    return url.origin === 'http://kapekonek.local' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
