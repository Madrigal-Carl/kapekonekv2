import { Permission } from '../models/permission.model.js';
import { Role } from '../models/role.model.js';

/**
 * Union of the permission slugs of these roles.
 * @param {string[]} roleSlugs
 * @returns {Promise<string[]>}
 */
export async function findPermissionSlugsForRoles(roleSlugs) {
  const roles = await Role.find({ slug: { $in: roleSlugs } }, { permissions: 1 }).lean();
  return [...new Set(roles.flatMap((r) => r.permissions))];
}

/** @param {{ slug: string, name: string, group: string }[]} permissions */
export const upsertPermissions = (permissions) =>
  Permission.bulkWrite(permissions.map((p) => ({ updateOne: { filter: { slug: p.slug }, update: { $set: p }, upsert: true } })));

/** @param {{ slug: string, name: string, permissions: string[] }[]} roles */
export const upsertRoles = (roles) =>
  Role.bulkWrite(roles.map((r) => ({ updateOne: { filter: { slug: r.slug }, update: { $set: r }, upsert: true } })));

export const countRolesAndPermissions = async () => ({ roles: await Role.countDocuments(), permissions: await Permission.countDocuments() });
