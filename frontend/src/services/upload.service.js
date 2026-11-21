import axios from 'axios'
import { api } from '@/api/axios'

/**
 * Signed direct upload to Cloudinary (the API signs, the browser uploads).
 * @param {File} file
 * @param {'avatar'|'receipt'} type
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function uploadImage(file, type, onProgress) {
  const sig = (await api.post('/uploads/signature', { type })).data.data
  if (file.size > sig.maxBytes) throw new Error(`That file is over ${Math.round(sig.maxBytes / 1024 / 1024)} MB. Choose a smaller one.`)
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  form.append('allowed_formats', sig.allowedFormats)
  form.append('unique_filename', String(sig.uniqueFilename))
  form.append('use_filename', String(sig.useFilename))
  const { data } = await axios.post(sig.url, form, {
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  })
  return { url: data.secure_url, publicId: data.public_id }
}
