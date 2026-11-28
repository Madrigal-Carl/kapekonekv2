import { mustVerifyEmail } from '../services/policy.service.js';
import { AppError } from '../utils/AppError.js';

/** Buyers, farmers and accounts made by Kaluppa or a Group Manager verify their email first (`mustVerifyEmail`). Use after `authenticate`. */
export const verified = (req, _res, next) => {
  next(mustVerifyEmail(req.user) ? new AppError(403, 'Please verify your email to continue.', { code: 'EMAIL_NOT_VERIFIED' }) : undefined);
};
