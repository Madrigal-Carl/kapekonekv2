import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/utils/csv.js';

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks, and ends rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], ['two\nlines', null]])).toBe('a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",\r\n');
  });

  it('keeps a cell that looks like a formula as text', () => {
    expect(toCsv(['name'], [['=HYPERLINK("x")'], ['-5'], ['@me']])).toBe('name\r\n"\'=HYPERLINK(""x"")"\r\n\'-5\r\n\'@me\r\n');
  });
});
