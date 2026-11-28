import axios from 'axios'
import { api } from '@/api/axios'
import { checkFile, extension, problemText } from '@/lib/fileCheck'
import { kindForFormat } from '@/schemas/rules'

/**
 * Signed direct upload to Cloudinary (the API signs, the browser uploads).
 * @param {File} file
 * @param {'avatar'|'receipt'|'farmer_document'} purpose
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function uploadImage(file, purpose, onProgress) {
  const sig = (await api.post('/uploads/signature', { purpose })).data.data
  const problem = checkFile(kindForFormat(purpose, extension(file)) ?? sig.kinds[0], file)
  if (problem) throw new Error(problemText(problem))
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
