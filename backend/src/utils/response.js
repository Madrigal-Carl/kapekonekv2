/**
 * Send the standard success envelope.
 * @param {import('express').Response} res
 * @param {{ data?: unknown, message?: string, meta?: object, status?: number }} [body]
 */
export const sendSuccess = (res, { data = null, message, meta, status = 200 } = {}) =>
  res.status(status).json({ success: true, ...(message && { message }), data, ...(meta && { meta }) });

/** A downloaded file (exports): `Content-Disposition: attachment` with its name. */
export const sendFile = (res, { filename, type, body }) => res.attachment(filename).type(type).send(body);
