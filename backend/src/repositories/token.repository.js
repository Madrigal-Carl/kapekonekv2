import { Token } from '../models/token.model.js';

/** @param {{ user: unknown, purpose: string, tokenHash: string, email: string, expiresAt: Date }} data */
export const createToken = (data) => Token.create(data);

/** Drop a user's unused links of one purpose, so only the newest link works. */
export const deleteUnusedTokens = (user, purpose) => Token.deleteMany({ user, purpose, usedAt: null });

/**
 * Atomically mark a valid, unused, unexpired token as used.
 * @returns {Promise<{ user: unknown, email: string } | null>} null when the link is invalid, used or expired
 */
export const consumeToken = (tokenHash, purpose) =>
  Token.findOneAndUpdate(
    { tokenHash, purpose, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { returnDocument: 'after' },
  ).lean();
