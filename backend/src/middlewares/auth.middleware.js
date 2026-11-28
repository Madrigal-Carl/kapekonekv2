import { userFromAccessToken } from '../services/auth.service.js';
import { mustAgreeFirst } from '../services/policy.service.js';
import { AppError } from '../utils/AppError.js';

// Change 09: until a user agrees to the current terms, only these stay open (GET /legal/current is public).
const TERMS_FREE = new Set(['GET /auth/me', 'POST /auth/logout', 'POST /legal/accept']);
const routeOf = (req) => `${req.method} ${req.originalUrl.split('?')[0].replace(/^\/api/, '')}`;

/** Require a signed-in, active user who agreed to the current terms; sets `req.user`. */
export const authenticate = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) throw new AppError(401, 'Please log in to continue.');
    req.user = await userFromAccessToken(token);
    if (mustAgreeFirst(req.user) && !TERMS_FREE.has(routeOf(req))) {
      throw new AppError(403, 'Please agree to the Terms and Conditions to continue.', { code: 'TERMS_REQUIRED' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Set `req.user` when a valid session exists; otherwise continue as a guest. */
export const optionalAuth = async (req, _res, next) => {
  const token = req.cookies?.accessToken;
  if (token) req.user = await userFromAccessToken(token).catch(() => undefined);
  next();
};

/** Refuse routes like login and register for someone already signed in. */
export const guestOnly = async (req, _res, next) => {
  const token = req.cookies?.accessToken;
  const user = token && (await userFromAccessToken(token).catch(() => undefined));
  next(user ? new AppError(403, 'You are already signed in.') : undefined);
};
