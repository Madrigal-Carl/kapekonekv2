/**
 * Put an API error's `errors` map onto react-hook-form fields.
 * @param {unknown} error axios error
 * @param {(name: string, error: { type: string, message: string }) => void} setError
 * @param {string[]} [fields] only map these fields (others are ignored)
 * @returns {boolean} true when at least one field error was set
 */
export function applyServerErrors(error, setError, fields) {
  const errors = error?.response?.data?.errors ?? {}
  let applied = false
  for (const [name, message] of Object.entries(errors)) {
    if (fields && !fields.includes(name)) continue
    setError(name, { type: 'server', message })
    applied = true
  }
  return applied
}

/** The API's human message, or a generic one for network failures. */
export const errorMessage = (error) =>
  error?.response?.data?.message ?? 'Something went wrong. Please check your connection and try again.'
