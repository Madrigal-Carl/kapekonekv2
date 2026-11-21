import { AppError } from '../utils/AppError.js';

/**
 * Validate and replace req.body / req.params / req.query with Zod-parsed data.
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = {};
  const parsed = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) parsed[part] = result.data;
    else for (const issue of result.error.issues) errors[issue.path.join('.') || 'root'] ??= issue.message;
  }
  if (Object.keys(errors).length) {
    return next(new AppError(400, 'Please check the highlighted fields.', { errors }));
  }
  if (parsed.body) req.body = parsed.body;
  if (parsed.params) req.params = parsed.params;
  // Express 5 makes req.query a getter, so redefine it.
  if (parsed.query) Object.defineProperty(req, 'query', { value: parsed.query, writable: true, configurable: true, enumerable: true });
  next();
};
