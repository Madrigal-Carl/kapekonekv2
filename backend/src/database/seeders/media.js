import { createRequire } from 'node:module';
import { uploadFromUrl } from '../../clients/cloudinary.client.js';

const MEDIA = createRequire(import.meta.url)('./data/media.json');

/**
 * Does the URL answer 200/206 with an image or video? Reads only the first bytes.
 * @returns {Promise<{ ok: boolean, contentType: string|null }>}
 */
export async function verifyMediaUrl(url) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(20_000) });
    const contentType = res.headers.get('content-type');
    await res.body?.cancel();
    return { ok: (res.status === 200 || res.status === 206) && /^(image|video)\//.test(contentType ?? ''), contentType };
  } catch {
    return { ok: false, contentType: null };
  }
}

/**
 * Upload to Cloudinary as `seed/<key>` (kept if it already exists); on failure keep the remote URL.
 * @returns {Promise<{ url: string, publicId: string|null, width?: number, height?: number, durationSec?: number }>}
 */
export async function uploadSeedMedia(key, url, resourceType = 'image') {
  try {
    return await uploadFromUrl(url, { path: `seed/${key}`, resourceType });
  } catch (error) {
    console.warn(`[seed] media ${key}: upload failed (${error.message ?? error.error?.message}); using the remote URL`);
    return { url, publicId: null };
  }
}

let resolved;

/**
 * Every seed photo/video, verified and uploaded once per process.
 * @returns {Promise<Record<string, { type: 'image'|'video', url: string, publicId: string|null, alt: string, posterUrl?: string, width?: number, height?: number, durationSec?: number }>>}
 */
export function seedMedia() {
  resolved ??= (async () => {
    const entries = await Promise.all(MEDIA.map(async (m) => {
      const check = await verifyMediaUrl(m.url);
      if (!check.ok) {
        console.warn(`[seed] media ${m.key}: ${m.url} is not reachable as an image or video (${check.contentType}); skipped`);
        return null;
      }
      const uploaded = await uploadSeedMedia(m.key, m.url, m.type);
      return [m.key, { type: m.type, alt: m.alt, posterUrl: m.posterUrl, ...uploaded }];
    }));
    return Object.fromEntries(entries.filter(Boolean));
  })();
  return resolved;
}

/**
 * Product/slide image shape for the given keys, skipping any that failed.
 * @param {Record<string, { url: string, publicId: string|null, alt: string }>} media
 * @param {string[]} keys
 */
export const imagesFor = (media, keys) =>
  keys.filter((k) => media[k]).map((k) => ({ url: media[k].url, publicId: media[k].publicId, alt: media[k].alt }));
