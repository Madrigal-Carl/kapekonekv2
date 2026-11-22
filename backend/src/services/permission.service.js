import { getValkey } from '../config/valkey.js';
import { ROLES } from '../constants/permissions.js';
import { findPermissionSlugsForRoles } from '../repositories/role.repository.js';
import { whenReady } from '../utils/lock.js';

const TTL_SECONDS = 600;
const key = (userId) => `perm:user:${userId}`;

/**
 * Permission slugs of a user: their roles' permissions plus direct ones, cached 10 minutes.
 * A Valkey outage falls back to Mongo instead of failing the request.
 * @param {{ _id: unknown, roles: string[], permissions?: string[] }} user
 * @returns {Promise<string[]>}
 */
export async function resolvePermissions(user) {
  const valkey = getValkey();
  try {
    const cached = await valkey.get(key(user._id));
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error(`[permissions] cache read failed: ${error.message}`);
  }
  const slugs = [...new Set([...(await findPermissionSlugsForRoles(user.roles)), ...(user.permissions ?? [])])].sort();
  valkey.set(key(user._id), JSON.stringify(slugs), 'EX', TTL_SECONDS).catch(() => {});
  return slugs;
}

/** Call after a user's roles or direct permissions change. */
export const clearPermissionCache = (userId) => getValkey().del(key(userId));

/** Call after the role/permission seeder runs. */
export async function clearAllPermissionCaches() {
  const valkey = getValkey();
  await whenReady(valkey);
  let cursor = '0';
  do {
    const [next, keys] = await valkey.scan(cursor, 'MATCH', 'perm:user:*', 'COUNT', 500);
    if (keys.length) await valkey.del(...keys);
    cursor = next;
  } while (cursor !== '0');
}

export const isSuperAdmin = (user) => user.roles.includes(ROLES.KALUPPA);

/**
 * Does the user hold every one of these permissions? Kaluppa always does.
 * @param {{ _id: unknown, roles: string[], permissions?: string[] }} user
 * @param {...string} slugs
 */
export async function userCan(user, ...slugs) {
  if (isSuperAdmin(user)) return true;
  const held = await resolvePermissions(user);
  return slugs.every((slug) => held.includes(slug));
}

/** Does the user hold at least one of these permissions? */
export async function userCanAny(user, ...slugs) {
  if (isSuperAdmin(user)) return true;
  const held = await resolvePermissions(user);
  return slugs.some((slug) => held.includes(slug));
}
