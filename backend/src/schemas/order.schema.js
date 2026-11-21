import { z } from 'zod';
import { EWALLET_PROVIDERS, FULFILLMENT_METHODS, ORDER_STATUSES, PAYMENT_METHODS } from '../constants/orderStatus.js';
import { csvOf, objectIdRule, pageQuery } from './common.schema.js';
import { phoneRule } from './rules.js';

/** POST /orders. Anything else the client sends (fees, totals) is stripped. */
export const placeOrderSchema = z
  .object({
    method: z.enum(FULFILLMENT_METHODS, 'Choose delivery or pickup'),
    addressId: objectIdRule.optional(),
    contactPhone: phoneRule.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS, 'Choose how you’ll pay'),
    provider: z.enum(EWALLET_PROVIDERS, 'Choose GCash or Maya').optional(),
    receipt: z.object({ url: z.url().max(500), publicId: z.string().min(1).max(300) }).optional(),
    note: z.string().trim().max(500, 'Use 500 characters or fewer').optional(),
  })
  .superRefine((body, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (body.method === 'delivery' && !body.addressId) issue('addressId', 'Choose a delivery address');
    if (body.paymentMethod === 'e_wallet') {
      if (!body.provider) issue('provider', 'Choose GCash or Maya');
      if (!body.receipt) issue('receipt', 'Upload your payment receipt');
    }
    if (body.paymentMethod === 'cash' && body.receipt) issue('receipt', 'Cash orders don’t need a receipt');
  });

export const orderListQuery = pageQuery(20, 10).extend({ status: csvOf(ORDER_STATUSES, 'Unknown status') });
