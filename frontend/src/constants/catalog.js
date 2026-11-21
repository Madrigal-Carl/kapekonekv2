/** Display labels (the backend sends slugs). */
export const VARIETIES = { liberica: 'Liberica', excelsa: 'Excelsa', arabica: 'Arabica', robusta: 'Robusta' }

/** Short labels on cards and filters; the product page uses `long`. */
export const COFFEE_TYPES = {
  green_beans: { short: 'Green beans', long: 'Green beans' },
  roasted_beans: { short: 'Roasted', long: 'Roasted beans' },
  ground: { short: 'Ground', long: 'Ground' },
}

export const PRODUCT_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

export const LOW_STOCK = 5

/** "Liberica · Roasted beans · 250 g" under a product name in the cart, checkout and order pages. */
export const productMeta = ({ variety, coffeeType, unitLabel }) =>
  [VARIETIES[variety], COFFEE_TYPES[coffeeType]?.long, unitLabel].filter(Boolean).join(' · ')
