import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAIL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../backend/storage/mail')

/**
 * Wait for the newest logged email to `to` and return the first link whose path starts with `pathPrefix`.
 * @param {string} to
 * @param {string} pathPrefix e.g. '/verify-email/confirm'
 * @param {{ timeout?: number }} [options]
 */
export async function latestMailLink(to, pathPrefix, { timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout
  const safeTo = to.toLowerCase().replace(/[^a-z0-9@._-]/gi, '_')
  while (Date.now() < deadline) {
    const files = (await readdir(MAIL_DIR).catch(() => [])).filter((f) => f.endsWith(`-${safeTo}.json`)).sort()
    for (const file of files.reverse()) {
      const { text } = JSON.parse(await readFile(path.join(MAIL_DIR, file), 'utf8'))
      const link = text.match(/https?:\/\/\S+/g)?.find((url) => new URL(url).pathname.startsWith(pathPrefix))
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`No email to ${to} with a ${pathPrefix} link within ${timeout} ms`)
}
