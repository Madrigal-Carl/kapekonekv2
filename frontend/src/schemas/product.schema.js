import { z } from 'zod'
import { PRODUCT_CATEGORIES, productPhotosRule, productPriceRule, productStockRule, refineProductCategory } from './rules.js'

// Mirror backend/src/schemas/product.schema.js. Kaluppa types pesos; the API takes integer centavos.
const pick = (message) => z.string(message).min(1, message)

/** Inventory add/edit (InventoryForm.dc.html). Submits `price` as `priceCentavos`. */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the product name').max(80, 'Use 80 characters or fewer'),
    category: z.enum(Object.keys(PRODUCT_CATEGORIES), 'Choose a category'),
    variety: z.string().nullable(),
    coffeeType: z.string().nullable(),
    unit: pick('Choose a unit'),
    price: z.number('Enter the price').transform((p) => Math.round(p * 100)).pipe(productPriceRule),
    stock: productStockRule,
    description: z.string().trim().max(2000, 'Use 2,000 characters or fewer'),
    photos: productPhotosRule,
    isFeatured: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine(refineProductCategory)
