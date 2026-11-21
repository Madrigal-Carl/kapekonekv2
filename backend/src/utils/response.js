/**
 * Send the standard success envelope.
 * @param {import('express').Response} res
 * @param {{ data?: unknown, message?: string, meta?: object, status?: number }} [body]
 */
export const sendSuccess = (res, { data = null, message, meta, status = 200 } = {}) =>
  res.status(status).json({ success: true, ...(message && { message }), data, ...(meta && { meta }) });
