import { z } from 'zod';
import { EXPORT_FORMATS } from '../services/export.service.js';
import { EXPORT_SCOPES, REPORT_SECTIONS } from '../services/report.service.js';
import { REPORT_PERIODS } from '../utils/period.js';
import { objectIdRule } from './common.schema.js';

const filters = {
  period: z.enum(REPORT_PERIODS, 'Choose a period').default('last_12_months'),
  association: objectIdRule.optional(),
};

/** GET /reports/:section?period&association (PHASE-2-SPEC §3.12). */
export const reportParams = z.object({ section: z.enum(REPORT_SECTIONS, 'Unknown report section') });
export const reportQuery = z.object(filters);
/** GET /reports/export?format=csv|pdf&scope=all|table&period&association (PHASE-2-SPEC §3.17). */
export const reportExportQuery = z.object({
  ...filters,
  format: z.enum(EXPORT_FORMATS, 'Choose CSV or PDF'),
  scope: z.enum(EXPORT_SCOPES, 'Choose the whole report or the table').default('all'),
});
