import { describe, expect, it } from 'vitest';
import { formatPeso } from './format.js';

describe('formatPeso', () => {
  it('formats integer centavos as PHP', () => {
    expect(formatPeso(123456)).toBe('₱1,234.56');
    expect(formatPeso(5000)).toBe('₱50.00');
  });
});
