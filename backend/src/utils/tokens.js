import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

export const REFRESH_TTL = { remember: '30d', session: '1d' };

/** @param {{ _id: unknown, tokenVersion?: number }} user */
export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES });

/** The remember-me choice rides in the token so a refresh keeps it. */
export const signRefreshToken = (user, { remember = false } = {}) =>
  jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0, rem: remember }, env.JWT_REFRESH_SECRET, {
    expiresIn: remember ? REFRESH_TTL.remember : REFRESH_TTL.session,
  });

const verify = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch {
    throw new AppError(401, 'Your session has expired. Please log in again.');
  }
};

/** @returns {{ sub: string, tv: number }} */
export const verifyAccessToken = (token) => verify(token, env.JWT_ACCESS_SECRET);
/** @returns {{ sub: string, tv: number, rem: boolean }} */
export const verifyRefreshToken = (token) => verify(token, env.JWT_REFRESH_SECRET);
