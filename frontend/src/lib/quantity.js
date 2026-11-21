/** Quantity step by unit: kg sells in half kilos, packs and pieces whole (same rule as the backend). */
export const stepFor = (unit) => (unit === 'kg' ? 0.5 : 1)

/**
 * Snap a quantity to the unit's step and keep it between one step and the stock.
 * @param {number} value
 * @param {string} unit
 * @param {number} stock
 */
export function clampQuantity(value, unit, stock) {
  const step = stepFor(unit)
  const max = Math.floor(stock / step) * step
  const snapped = Math.round(value / step) * step
  return Math.max(step, Math.min(snapped, max))
}
