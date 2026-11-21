import { userFromAccessToken } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

/** Require a signed-in, active user; sets `req.user`. */
export const authenticate = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) throw new AppError(401, 'Please log in to continue.');
    req.user = await userFromAccessToken(token);
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
