import { tooLargeLines, UPLOAD_RULES, uploadRule } from '@/schemas/rules'

export const extension = (file) => (file.name.includes('.') ? file.name.split('.').pop() : (file.type.split('/')[1] ?? '')).toLowerCase()

/**
 * What is wrong with a file for this kind of upload, or null when it may upload (the server checks it again).
 * @param {'image'|'file'|'video'} kind
 * @param {File} file
 * @param {string} [tip] added after the limit, e.g. "Try a screenshot instead."
 * @returns {{ title: string, detail: string } | null}
 */
export function checkFile(kind, file, tip) {
  const result = uploadRule(kind).safeParse({ name: file.name, size: file.size, format: extension(file) })
  if (result.success) return null
  if (result.error.issues[0].params?.code === 'FILE_TOO_LARGE') {
    const [title, limit] = tooLargeLines(kind, file.name, file.size)
    return { title, detail: tip ? `${limit} ${tip}` : limit }
  }
  return { title: `${file.name} isn’t a supported type.`, detail: `Use ${UPLOAD_RULES[kind].hint.split(' · ')[0]}.` }
}

/** A problem from `checkFile` or a server message, as one line (for hints under a button). */
export const problemText = (problem) => (typeof problem === 'string' ? problem : problem && `${problem.title} ${problem.detail}`)
