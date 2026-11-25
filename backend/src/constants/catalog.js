/** Product facets (PRODUCT-SPEC §2). Labels are the storefront copy. */
export const VARIETIES = { liberica: 'Liberica', excelsa: 'Excelsa', arabica: 'Arabica', robusta: 'Robusta' };
export const COFFEE_TYPES = { green_beans: 'Green beans', roasted_beans: 'Roasted beans', ground: 'Ground' };
export const UNITS = ['kg', 'pack', 'piece', 'sack'];

/** Products-page sort key → field and direction. */
export const PRODUCT_SORTS = {
  newest: { sortField: 'createdAt', direction: 'desc' },
  price_asc: { sortField: 'priceCentavos', direction: 'asc' },
  price_desc: { sortField: 'priceCentavos', direction: 'desc' },
  rating: { sortField: 'ratingAverage', direction: 'desc' },
  popular: { sortField: 'soldCount', direction: 'desc' },
};
