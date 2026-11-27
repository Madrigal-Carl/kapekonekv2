import PDFDocument from 'pdfkit';

// The coffee palette (frontend/src/index.css), for the printed report.
const C = { ink: '#2B1A12', ink2: '#4A3A30', ink3: '#6B5A4E', roast: '#7B4A2A', caramel: '#C8925A', crema: '#F7EFE4', cream: '#FBF8F4', sand: '#E7DCCD' };
const GAP = 12;

/**
 * The built-in Helvetica is WinAnsi only (no ₱ or →, and Poppins has neither): spell those out and mark anything else.
 * @param {unknown} value
 */
export const pdfText = (value) =>
  String(value ?? '')
    .replaceAll('₱', 'PHP ')
    .replaceAll('→', '->')
    .replace(/[^\x20-\xFF‘’“”–—…•€™\n]/g, '?');

const isNumberLike = (v) => v === '' || v == null || /^-?[\d,]+(\.\d+)?%?$/.test(String(v));

function startBlock(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function header(doc, { title, subtitle, filters = [], generatedAt }) {
  const { left } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.roast).text('KAPEKONEK', left, doc.y, { characterSpacing: 1.6 });
  doc.moveDown(0.3).font('Helvetica-Bold').fontSize(20).fillColor(C.ink).text(pdfText(title));
  if (subtitle) doc.moveDown(0.15).font('Helvetica').fontSize(10).fillColor(C.ink2).text(pdfText(subtitle));
  doc.moveDown(0.6).font('Helvetica').fontSize(9).fillColor(C.ink3);
  const line = filters.length ? filters.map(([k, v]) => `${k}: ${v}`).join('   ·   ') : 'No filters: every record';
  doc.text(pdfText(`Filters  ${line}`));
  doc.text(pdfText(`Generated ${generatedAt} (Asia/Manila)`));
  const y = doc.y + 8;
  doc.moveTo(left, y).lineTo(doc.page.width - doc.page.margins.right, y).lineWidth(1).strokeColor(C.sand).stroke();
  doc.y = y + 14;
}

function kpiTiles(doc, kpis) {
  const { left } = doc.page.margins;
  const width = doc.page.width - left - doc.page.margins.right;
  const perRow = Math.min(4, kpis.length);
  const w = (width - GAP * (perRow - 1)) / perRow;
  const h = 58;
  for (let i = 0; i < kpis.length; i += perRow) {
    startBlock(doc, h + GAP);
    const top = doc.y;
    kpis.slice(i, i + perRow).forEach(({ label, value, sub }, j) => {
      const x = left + j * (w + GAP);
      doc.roundedRect(x, top, w, h, 6).fillAndStroke(C.cream, C.sand);
      const one = { width: w - 20, height: 11, ellipsis: true }; // one line, cut with …
      doc.font('Helvetica').fontSize(8).fillColor(C.ink3).text(pdfText(label), x + 10, top + 9, one);
      let size = 15; // shrink a long value ("PHP 1,234,567.00") to fit its tile
      doc.font('Helvetica-Bold');
      while (size > 9 && doc.fontSize(size).widthOfString(pdfText(value)) > w - 20) size -= 0.5;
      doc.fillColor(C.ink).text(pdfText(value), x + 10, top + 21 + (15 - size) / 2, { ...one, height: 18 });
      if (sub) doc.font('Helvetica').fontSize(7.5).fillColor(C.ink3).text(pdfText(sub), x + 10, top + 41, { ...one, height: 9 });
    });
    doc.y = top + h + GAP;
  }
  doc.x = left;
}

/** One bar chart drawn as vector shapes: a bar per label, its value above, the label below. */
function barChart(doc, { title, labels, values, format = String }, x, top, w, h) {
  doc.roundedRect(x, top, w, h, 6).lineWidth(1).stroke(C.sand);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(pdfText(title), x + 12, top + 10, { width: w - 24, lineBreak: false, ellipsis: true });
  const plot = { x: x + 12, y: top + 40, w: w - 24, h: h - 70 };
  const max = Math.max(...values, 0) || 1;
  const slot = plot.w / values.length;
  const bar = Math.max(2, Math.min(28, slot * 0.6));
  const base = plot.y + plot.h;
  doc.moveTo(plot.x, base).lineTo(plot.x + plot.w, base).lineWidth(0.75).stroke(C.sand);
  values.forEach((v, i) => {
    const bh = (v / max) * plot.h;
    const bx = plot.x + i * slot + (slot - bar) / 2;
    if (bh > 0) doc.rect(bx, base - bh, bar, bh).fill(C.roast);
    doc.font('Helvetica').fontSize(6.5).fillColor(C.ink2);
    if (v) doc.text(pdfText(format(v)), plot.x + i * slot - 4, base - bh - 9, { width: slot + 8, align: 'center', lineBreak: false });
    doc.fillColor(C.ink3).text(pdfText(labels[i]), plot.x + i * slot - 4, base + 4, { width: slot + 8, align: 'center', lineBreak: false, ellipsis: true });
  });
}

function charts(doc, list) {
  const { left } = doc.page.margins;
  const width = doc.page.width - left - doc.page.margins.right;
  const w = (width - GAP) / 2;
  const h = 170;
  for (let i = 0; i < list.length; i += 2) {
    startBlock(doc, h + GAP);
    const top = doc.y;
    list.slice(i, i + 2).forEach((chart, j) => barChart(doc, chart, left + j * (w + GAP), top, list.length === 1 ? width : w, h));
    doc.y = top + h + GAP;
  }
  doc.x = left;
}

/** Columns sized by their content (capped), text wrapped in each cell, the header row repeated on each new page. */
function table(doc, { title, header: head, rows }) {
  const { left } = doc.page.margins;
  const width = doc.page.width - left - doc.page.margins.right;
  const pad = 5;
  doc.font('Helvetica').fontSize(8);
  const sample = rows.slice(0, 300);
  const cells = head.map((h, c) => [h, ...sample.map((r) => r[c])].map(pdfText));
  // Measured in bold (the header row is): a little room to spare for the body.
  doc.font('Helvetica-Bold');
  const natural = cells.map((col) => Math.min(220, Math.max(36, ...col.map((t) => doc.widthOfString(t) + pad * 2))));
  // Never narrower than the longest word (an order number, "Payment"), so nothing breaks mid-word.
  const least = cells.map((col, c) => Math.min(natural[c], Math.max(...col.flatMap((t) => t.split(/\s+/)).map((w) => doc.widthOfString(w) + pad * 2 + 1))));
  const sum = natural.reduce((a, b) => a + b, 0);
  const sumLeast = least.reduce((a, b) => a + b, 0);
  const widths = sum <= width || sumLeast >= width
    ? natural.map((n) => (n / sum) * width)
    : natural.map((n, c) => least[c] + (n - least[c]) * ((width - sumLeast) / (sum - sumLeast)));
  const right = head.map((_, c) => c > 0 && rows.length > 0 && rows.every((r) => isNumberLike(r[c])));

  const drawRow = (cells, { bold = false, fill = null } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    const h = Math.max(...cells.map((cell, c) => doc.heightOfString(pdfText(cell), { width: widths[c] - pad * 2 }))) + pad * 2;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      if (!bold) drawRow(head, { bold: true, fill: C.crema });
    }
    const top = doc.y;
    if (fill) doc.rect(left, top, width, h).fill(fill);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8); // a repeated header above may have switched it
    let x = left;
    cells.forEach((cell, c) => {
      doc.fillColor(bold ? C.ink : C.ink2).text(pdfText(cell), x + pad, top + pad, { width: widths[c] - pad * 2, align: right[c] ? 'right' : 'left' });
      x += widths[c];
    });
    doc.moveTo(left, top + h).lineTo(left + width, top + h).lineWidth(0.5).stroke(C.sand);
    doc.y = top + h;
  };

  startBlock(doc, 60);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink).text(pdfText(title), left, doc.y);
  doc.moveDown(0.4);
  drawRow(head, { bold: true, fill: C.crema });
  if (rows.length === 0) doc.font('Helvetica').fontSize(8.5).fillColor(C.ink3).text('Nothing matches these filters.', left + pad, doc.y + pad);
  for (const row of rows) drawRow(row);
  doc.x = left;
  doc.y += GAP + 4;
}

function pageNumbers(doc, title) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    const { left, right, bottom } = doc.page.margins;
    doc.page.margins.bottom = 0; // writing in the margin must not add a page
    const y = doc.page.height - 34;
    const w = doc.page.width - left - right;
    doc.font('Helvetica').fontSize(8).fillColor(C.ink3);
    doc.text(pdfText(`KapeKonek · ${title}`), left, y, { width: w / 2, lineBreak: false });
    doc.text(`Page ${i + 1} of ${count}`, left + w / 2, y, { width: w / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

/**
 * A4 report: KapeKonek header, the filters, generated-at, KPI tiles, bar charts, tables and page numbers.
 * @param {{ title: string, subtitle?: string, filters?: [string, string][], generatedAt: string, landscape?: boolean,
 *   kpis?: { label: string, value: string, sub?: string }[],
 *   charts?: { title: string, labels: string[], values: number[], format?: (v: number) => string }[],
 *   tables: { title: string, header: string[], rows: unknown[][] }[] }} report
 * @returns {Promise<Buffer>}
 */
export function renderPdf(report) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: report.landscape ? 'landscape' : 'portrait',
    margins: { top: 44, bottom: 52, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: pdfText(`KapeKonek · ${report.title}`), Author: 'KapeKonek' },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  header(doc, report);
  if (report.kpis?.length) kpiTiles(doc, report.kpis);
  if (report.charts?.length) charts(doc, report.charts);
  for (const t of report.tables) table(doc, t);
  pageNumbers(doc, report.title);
  doc.end();
  return done;
}
