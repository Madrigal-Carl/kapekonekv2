// Cells a spreadsheet would run as a formula start with one of these; a leading ' keeps them text.
const FORMULA = /^[=+\-@\t\r]/;

const cell = (value) => {
  const text = value == null ? '' : String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/**
 * A CSV document (RFC 4180, CRLF rows) with a header row.
 * @param {string[]} header @param {unknown[][]} rows
 */
export const toCsv = (header, rows) => `${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
