import { z } from 'zod';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { cancelReasonRule } from './rules.js';

/** Kaluppa's Reviews table (PHASE-2-SPEC §3.8b): Status (all by default), product, stars, reply state, search. */
export const adminReviewListQuery = pageQuerySchema.extend({
  status: z.enum(['visible', 'hidden'], 'Unknown status').optional(),
  product: objectIdRule.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  reply: z.enum(['needs', 'replied'], 'Unknown reply filter').optional(),
  q: z.string().trim().max(80).default(''),
});

export const replySchema = z.object({
  body: z.string('Write a reply').trim().min(1, 'Write a reply').max(1000, 'Use 1,000 characters or fewer'),
});

export const hideReviewSchema = z.object({ reason: cancelReasonRule });
