const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** Format integer centavos as PHP, e.g. 123456 → "₱1,234.56". */
export const formatPeso = (centavos) => peso.format(centavos / 100);

/** Quantity in a stepper or table: "1.5 kg", or a bare count for packs and pieces. */
export const quantityShort = (quantity, unit) => (unit === 'kg' ? `${quantity} kg` : String(quantity));

/** Quantity in words: "1.5 kg", "2 packs", "1 piece". */
export const quantityWords = (quantity, unit) => (unit === 'kg' ? `${quantity} kg` : `${quantity} ${unit}${quantity === 1 ? '' : 's'}`);

/** "09171234567" → "0917 123 4567"; anything else is returned as-is. */
export const formatPhone = (phone) => (/^09\d{9}$/.test(phone ?? '') ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : (phone ?? ''));

const wholePeso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
/** Like formatPeso, without “.00” on whole pesos (the bean screens): 45000 → “₱450”, 89650 → “₱896.50”. */
export const formatPesoShort = (centavos) => (centavos % 100 === 0 ? wholePeso.format(centavos / 100) : formatPeso(centavos));

/** Kilograms with grouping: 1250.25 → “1,250.25 kg”. */
export const formatKg = (kg) => `${kg.toLocaleString('en-PH', { maximumFractionDigits: 2 })} kg`;

/** Delivery fee in centavos: base, plus per km past the first `baseKm`, rounded up (mirrors backend utils/deliveryFee.js). */
export function feeForDistance(distanceKm, { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos }) {
  const raw = baseFeeCentavos + Math.max(0, distanceKm - baseKm) * perKmCentavos
  return Math.ceil(Math.round(raw) / roundUpToCentavos) * roundUpToCentavos
}
