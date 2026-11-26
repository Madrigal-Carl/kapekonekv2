import { z } from 'zod';
import { AUDIT_AREAS, AUDIT_ROLES, HISTORY_TYPES } from '../services/auditLog.service.js';
import { objectIdRule, pageQuerySchema } from './common.schema.js';

/** GET /audit-logs/entity/:entityType/:entityId (PHASE-2-SPEC §3.15). */
export const entityHistoryParams = z.object({ entityType: z.enum(HISTORY_TYPES, 'Unknown record type'), entityId: objectIdRule });
export const entityHistoryQuery = z.object({ cursor: z.string().max(500).optional(), limit: z.coerce.number().int().min(1).max(20, 'At most 20 per page').default(5) });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Use a real date');
const auditFilters = {
  area: z.enum(AUDIT_AREAS, 'Unknown area').optional(),
  role: z.enum(AUDIT_ROLES, 'Unknown role').optional(),
  from: day.optional(),
  to: day.optional(),
  entity: objectIdRule.optional(),
  q: z.string().trim().max(80).optional(),
};
/** GET /audit-logs?area&role&from&to&entity&q&page (PHASE-2-SPEC §5). */
export const auditListQuery = pageQuerySchema.extend(auditFilters);
/** GET /audit-logs/export.csv with the same filters. */
export const auditExportQuery = z.object(auditFilters);
