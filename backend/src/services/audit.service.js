import { insertAuditEntry } from '../repositories/audit.repository.js';

/** Never stored, even when a caller lists them. */
export const AUDIT_DENY = new Set(['password', 'tokenVersion', 'documents', 'receipt']);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Record a Phase 2 change. Only the listed `fields` that changed between `before` and `after` are stored.
 * @param {{ actor: { _id: unknown, roles: string[] }|null, area: string, action: string,
 *   entity: { type: string, id: unknown, label?: string }, before?: object, after?: object, fields?: string[] }} entry
 */
export async function record({ actor, area, action, entity, before = {}, after = {}, fields = [] }) {
  const changes = fields
    .filter((field) => !AUDIT_DENY.has(field) && !same(before[field], after[field]))
    .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }));
  await insertAuditEntry({
    actor: actor?._id ?? null,
    actorRole: actor?.roles[0] ?? 'system',
    area,
    action,
    entityType: entity.type,
    entityId: entity.id,
    entityLabel: entity.label ?? '',
    changes,
  });
}
