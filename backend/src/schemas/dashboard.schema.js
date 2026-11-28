import { z } from 'zod';
import { PERIODS } from '../utils/period.js';

/** GET /dashboard/overview?period= (PHASE-2-SPEC §3.14). */
export const overviewQuery = z.object({ period: z.enum(PERIODS, 'Choose today, week, month or year').default('month') });
