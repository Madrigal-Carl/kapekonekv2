import { ROLES } from '../constants/permissions.js';
import { AppError } from '../utils/AppError.js';

const MUST_VERIFY = [ROLES.BUYER, ROLES.FARMER];

/** Buyers and farmers must verify their email before any account action; Group Managers and Kaluppa may act unverified. Use after `authenticate`. */
export const verified = (req, _res, next) => {
  const blocked = req.user.roles.some((role) => MUST_VERIFY.includes(role)) && !req.user.emailVerifiedAt;
  next(blocked ? new AppError(403, 'Please verify your email to continue.', { code: 'EMAIL_NOT_VERIFIED' }) : undefined);
};
