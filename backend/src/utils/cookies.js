import { env } from '../config/env.js';
import { signAccessToken, signRefreshToken } from './tokens.js';

const ACCESS_MAX_AGE = 15 * 60 * 1000; // matches ACCESS_TOKEN_EXPIRES=15m
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

/** The one place cookie options are built. */
export const cookieOptions = ({ maxAge } = {}) => {
  const production = env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', path: '/', ...(maxAge && { maxAge }) };
};

/** Sign and set both auth cookies. Without remember me the refresh cookie is a session cookie. */
export function setAuthCookies(res, user, { remember = false } = {}) {
  res.cookie('accessToken', signAccessToken(user), cookieOptions({ maxAge: ACCESS_MAX_AGE }));
  res.cookie('refreshToken', signRefreshToken(user, { remember }), cookieOptions(remember ? { maxAge: REMEMBER_MAX_AGE } : {}));
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieOptions());
  res.clearCookie('refreshToken', cookieOptions());
}
