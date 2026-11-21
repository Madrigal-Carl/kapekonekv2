import { ROLES } from '../constants/permissions.js';
import { AppError } from '../utils/AppError.js';

/** Buyers must verify their email before any account action; other roles may act unverified. Use after `authenticate`. */
export const verified = (req, _res, next) => {
  const blocked = req.user.roles.includes(ROLES.BUYER) && !req.user.emailVerifiedAt;
  next(blocked ? new AppError(403, 'Please verify your email to continue.', { code: 'EMAIL_NOT_VERIFIED' }) : undefined);
};
