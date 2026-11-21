import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** Allow the request only with `x-cron-secret: <CRON_SECRET>` (constant-time compare). */
export function requireCronSecret(req, _res, next) {
  const expected = Buffer.from(env.CRON_SECRET);
  const supplied = Buffer.from(req.get('x-cron-secret') ?? '');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return next(new AppError(401, 'Invalid cron secret'));
  }
  next();
}
