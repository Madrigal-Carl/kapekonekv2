import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const label = (field) => {
  const words = field.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Turn any thrown value into an AppError. */
function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? err.keyValue ?? { value: 1 })[0];
    return new AppError(409, `${label(field)} is already taken`, { code: field === 'username' ? 'USERNAME_TAKEN' : 'CONFLICT', errors: { [field]: `${label(field)} is already taken` } });
  }
  if (err instanceof mongoose.Error.CastError) return new AppError(404, 'Not found');
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'The request body is not valid JSON.');
  if (err?.type === 'entity.too.large') return new AppError(413, 'The request body is too large.', { code: 'VALIDATION_ERROR' });
  return null;
}

export const notFound = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

export const errorHandler = (err, _req, res, _next) => {
  const appError = toAppError(err);
  if (!appError) {
    if (env.NODE_ENV !== 'test') console.error(err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.', code: 'SERVER_ERROR', errors: {} });
  }
  res.status(appError.statusCode).json({ success: false, message: appError.message, code: appError.code, errors: appError.errors, ...(appError.data && { data: appError.data }) });
};
