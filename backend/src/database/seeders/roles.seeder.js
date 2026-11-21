import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '../../constants/permissions.js';
import { countRolesAndPermissions, upsertPermissions, upsertRoles } from '../../repositories/role.repository.js';
import { clearAllPermissionCaches } from '../../services/permission.service.js';

/** Upsert every permission and role by slug, then drop cached permission lists. */
export async function seedRoles() {
  await upsertPermissions(Object.entries(PERMISSIONS).map(([slug, p]) => ({ slug, ...p })));
  await upsertRoles(Object.entries(ROLE_PERMISSIONS).map(([slug, permissions]) => ({ slug, name: ROLE_LABELS[slug], permissions })));
  await clearAllPermissionCaches();
  const { roles, permissions } = await countRolesAndPermissions();
  return `${roles} roles, ${permissions} permissions`;
}
