import { api } from '@/api/axios'

/**
 * GET a file export as a Blob. A failed export comes back as a JSON Blob: it's parsed back into the usual error body
 * so `errorMessage` shows the server's text (e.g. the 5-a-minute limit).
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function fetchFile(url, params) {
  try {
    const res = await api.get(url, { params, responseType: 'blob' })
    const filename = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'kapekonek-export'
    return { blob: res.data, filename }
  } catch (error) {
    const body = error.response?.data
    if (body instanceof Blob) error.response.data = await body.text().then(JSON.parse).catch(() => ({}))
    throw error
  }
}

/** Save a fetched file with its server-given name. */
export function saveDownload({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
