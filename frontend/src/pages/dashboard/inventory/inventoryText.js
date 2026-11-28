import { COFFEE_TYPES, VARIETIES } from '@/constants/catalog'

export const CATEGORY_OPTIONS = [
  { value: 'coffee', label: 'Coffee' },
  { value: 'beans', label: 'Beans' },
  { value: 'fertilizer', label: 'Fertilizer' },
]
export const CATEGORY_TONES = { coffee: 'roast', fertilizer: 'green', beans: 'blue' }

/** "pack (250 g)" for coffee packs; other units as they are. */
export const unitText = (unit) => (unit === 'pack' ? 'pack (250 g)' : unit)

/** "38 packs", "6 sacks", "40 pcs", "12.5 kg" (Inventory.dc.html Stock column). */
export function stockText(stock, unit) {
  if (unit === 'kg') return `${stock} kg`
  if (unit === 'piece') return `${stock} pcs`
  return `${stock} ${unit}${stock === 1 ? '' : 's'}`
}

/** Under the name: "Liberica · Roasted beans" for coffee, the size label for the rest. */
export const productSub = (p) =>
  p.category?.slug === 'coffee' ? [VARIETIES[p.variety], COFFEE_TYPES[p.coffeeType]?.long].filter(Boolean).join(' · ') : (p.unitLabel ?? VARIETIES[p.variety] ?? '')

export const STOCK_STATES = { out: 'Out of stock', low: 'Low stock', in: 'In stock' }
