const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** Format integer centavos as PHP, e.g. 123456 → "₱1,234.56". */
export const formatPeso = (centavos) => peso.format(centavos / 100);
