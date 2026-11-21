import { getValkey } from '../config/valkey.js';
import { AppError } from '../utils/AppError.js';

/**
 * Fixed-window limiter in Valkey. Fails open (logs) if Valkey is unreachable.
 * @param {{ name: string, limit: number, windowSec: number, key?: (req: import('express').Request) => string, message?: string }} options
 */
export const rateLimit = ({ name, limit, windowSec, key = (req) => req.ip, message = 'Too many attempts. Please wait a moment and try again.' }) =>
  async (req, res, next) => {
    const redisKey = `rl:${name}:${key(req)}`;
    let count;
    let ttl;
    try {
      const valkey = getValkey();
      [[, count], [, ttl]] = await valkey.multi().incr(redisKey).ttl(redisKey).exec();
      if (ttl < 0) {
        await valkey.expire(redisKey, windowSec);
        ttl = windowSec;
      }
    } catch (error) {
      console.error(`[rate-limit:${name}] ${error.message}`);
      return next();
    }
    if (count <= limit) return next();
    res.set('Retry-After', String(ttl));
    next(new AppError(429, message));
  };
