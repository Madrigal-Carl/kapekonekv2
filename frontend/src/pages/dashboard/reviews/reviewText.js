import { COFFEE_TYPES, VARIETIES } from '@/constants/catalog'

export const reviewTitle = (r) => `${r.rating}-star review of ${r.product?.name ?? 'a deleted product'}`

/** "Liberica · Roasted beans" for coffee, the size label for the rest. */
export const productLine = (p) =>
  !p ? '' : p.coffeeType ? [VARIETIES[p.variety], COFFEE_TYPES[p.coffeeType]?.long].filter(Boolean).join(' · ') : (p.unitLabel ?? VARIETIES[p.variety] ?? '')

/** The table's review excerpt: 70 characters, then an ellipsis. */
export const excerpt = (text) => (text.length > 70 ? `${text.slice(0, 70).trimEnd()}…` : text)
