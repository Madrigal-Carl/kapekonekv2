import { toCsv } from '../utils/csv.js';
import { renderPdf } from '../utils/pdf.js';
import { record } from './audit.service.js';

export const EXPORT_FORMATS = ['csv', 'pdf'];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
const manilaStamp = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

/** One table as plain rows; several stacked under their titles with a blank line between. */
const csvOf = (tables) =>
  tables.length === 1
    ? toCsv(tables[0].header, tables[0].rows)
    : tables.map((t) => toCsv([t.title], []) + toCsv(t.header, t.rows)).join('\r\n');

/**
 * The file for an Export (PHASE-2-SPEC §3.17): CSV (UTF-8 with a BOM, so Excel reads it as UTF-8) or an A4 PDF.
 * Every export is audited with its format and the filters it used.
 * @param {object} actor
 * @param {'csv'|'pdf'} format
 * @param {{ name: string, title: string, subtitle?: string, filters: [string, string][], landscape?: boolean,
 *   kpis?: object[], charts?: object[], tables: { title: string, header: string[], rows: unknown[][] }[] }} report
 * @param {string} area the audit area of what was exported
 * @returns {Promise<{ filename: string, type: string, body: Buffer }>}
 */
export async function buildExport(actor, format, report, area) {
  const now = new Date();
  const body = format === 'pdf'
    ? await renderPdf({ ...report, generatedAt: manilaStamp.format(now) })
    : Buffer.concat([UTF8_BOM, Buffer.from(csvOf(report.tables), 'utf8')]);
  await record({
    actor,
    area,
    action: 'export',
    entity: { type: 'export', id: actor._id, label: `${report.title} (${format.toUpperCase()})` },
    after: { format, filters: report.filters.map(([k, v]) => `${k}: ${v}`).join('; ') || 'none' },
    fields: ['format', 'filters'],
  });
  return { filename: `kapekonek-${report.name}-${manilaDay.format(now)}.${format}`, type: format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8', body };
}
