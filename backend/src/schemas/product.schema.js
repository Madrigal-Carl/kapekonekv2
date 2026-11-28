import { z } from 'zod';
import { COFFEE_TYPES, UNITS, VARIETIES } from '../constants/catalog.js';
import { pageQuerySchema } from './common.schema.js';
import { PRODUCT_CATEGORIES, productPhotosRule, productPriceRule, productStockRule, refineProductCategory, refineStartingStock } from './rules.js';

/** Inventory add/edit (InventoryForm.dc.html). Category-dependent fields are checked by refineProductCategory. */
export const productSchema = z
  .object({
    name: z.string('Enter the product name').trim().min(2, 'Enter the product name').max(80, 'Use 80 characters or fewer'),
    category: z.enum(Object.keys(PRODUCT_CATEGORIES), 'Choose a category'),
    variety: z.enum(Object.keys(VARIETIES), 'Choose a variety').nullable().default(null),
    coffeeType: z.enum(Object.keys(COFFEE_TYPES), 'Choose a coffee type').nullable().default(null),
    unit: z.enum(UNITS, 'Choose a unit'),
    priceCentavos: productPriceRule,
    stock: productStockRule,
    description: z.string().trim().max(2000, 'Use 2,000 characters or fewer').default(''),
    photos: productPhotosRule.default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine(refineProductCategory);

/** Adding a product: the same fields, and the stock starts above the low-stock line (Change 08). */
export const productCreateSchema = productSchema.superRefine(refineStartingStock);

/** Inventory table: Status (Active by default), category, stock state, name search. */
export const productListQuery = pageQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'archived'], 'Unknown status').default('active'),
  category: z.enum(Object.keys(PRODUCT_CATEGORIES), 'Unknown category').optional(),
  stock: z.enum(['low', 'out', 'in'], 'Unknown stock filter').optional(),
  q: z.string().trim().max(80).default(''),
});
