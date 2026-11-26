import { z } from 'zod';
import { HISTORY_TYPES } from '../services/auditLog.service.js';
import { objectIdRule } from './common.schema.js';

/** GET /audit-logs/entity/:entityType/:entityId (PHASE-2-SPEC §3.15). */
export const entityHistoryParams = z.object({ entityType: z.enum(HISTORY_TYPES, 'Unknown record type'), entityId: objectIdRule });
export const entityHistoryQuery = z.object({ cursor: z.string().max(500).optional(), limit: z.coerce.number().int().min(1).max(20, 'At most 20 per page').default(5) });
