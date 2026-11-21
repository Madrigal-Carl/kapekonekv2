import { describe, expect, it } from 'vitest';
import { formatPeso, formatPhone, quantityShort, quantityWords } from './format.js';

describe('formatPeso', () => {
  it('formats integer centavos as PHP', () => {
    expect(formatPeso(123456)).toBe('₱1,234.56');
    expect(formatPeso(5000)).toBe('₱50.00');
  });
});

describe('quantity labels', () => {
  it('formats kg with the unit and counts without it', () => {
    expect(quantityShort(1.5, 'kg')).toBe('1.5 kg');
    expect(quantityShort(2, 'pack')).toBe('2');
    expect(quantityWords(2, 'pack')).toBe('2 packs');
    expect(quantityWords(1, 'piece')).toBe('1 piece');
    expect(quantityWords(3, 'kg')).toBe('3 kg');
  });
});

describe('formatPhone', () => {
  it('groups PH mobile numbers 4-3-4', () => {
    expect(formatPhone('09175550102')).toBe('0917 555 0102');
    expect(formatPhone('+63 917')).toBe('+63 917');
  });
});
