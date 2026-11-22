import { z } from 'zod';
import { objectIdRule } from './common.schema.js';

// The unit's step (0.5 kg / whole packs) is checked in the service, where the product is known.
const quantity = z.number('Enter a quantity').positive('Enter a quantity').max(1000, 'That is more than we can pack');

export const addItemSchema = z.object({ productId: objectIdRule, quantity });
export const setQuantitySchema = z.object({ quantity });
export const productIdParams = z.object({ productId: objectIdRule });

export const uploadSignatureSchema = z.object({ purpose: z.enum(['avatar', 'receipt'], 'Choose avatar or receipt') });
