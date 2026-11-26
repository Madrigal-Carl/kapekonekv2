import { z } from 'zod';
import { EXPORT_SECTIONS, REPORT_SECTIONS } from '../services/report.service.js';
import { REPORT_PERIODS } from '../utils/period.js';
import { objectIdRule } from './common.schema.js';

const filters = {
  period: z.enum(REPORT_PERIODS, 'Choose a period').default('last_12_months'),
  association: objectIdRule.optional(),
};

/** GET /reports/:section?period&association (PHASE-2-SPEC §3.12). */
export const reportParams = z.object({ section: z.enum(REPORT_SECTIONS, 'Unknown report section') });
export const reportQuery = z.object(filters);
/** GET /reports/export.csv?section=&period&association */
export const reportExportQuery = z.object({ ...filters, section: z.enum(EXPORT_SECTIONS, 'Unknown report section') });
