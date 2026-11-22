const UPLOAD = '/image/upload/'
const isCloudinary = (url) => Boolean(url?.startsWith('https://res.cloudinary.com/') && url.includes(UPLOAD))
const resized = (url, px) => url.replace(UPLOAD, `${UPLOAD}f_auto,q_auto,c_limit,w_${Math.round(px)}/`)

/**
 * A Cloudinary image URL resized to `width` CSS px (2× for sharp screens), in the best format and quality
 * the browser takes. Other URLs (seed fallbacks, previews) come back unchanged.
 * @param {string | null | undefined} url
 * @param {number} width rendered width in CSS px
 */
export const imageUrl = (url, width) => (isCloudinary(url) ? resized(url, width * 2) : (url ?? undefined))

/**
 * `srcSet` for full-width photos (hero), so phones don't download the desktop size.
 * @param {string | null | undefined} url
 * @param {number[]} widths image widths in px
 */
export const imageSrcSet = (url, widths) => (isCloudinary(url) ? widths.map((w) => `${resized(url, w)} ${w}w`).join(', ') : undefined)

/**
 * A square, subject-centred crop (thumbnails), at 2× `size` CSS px. Other URLs come back unchanged.
 * @param {string | null | undefined} url
 * @param {number} size rendered side in CSS px
 */
export const squareUrl = (url, size) =>
  isCloudinary(url) ? url.replace(UPLOAD, `${UPLOAD}f_auto,q_auto,c_fill,g_auto,w_${size * 2},h_${size * 2}/`) : (url ?? undefined)
