import { z } from 'zod';
import { EWALLET_PROVIDERS, FULFILLMENT_METHODS, ORDER_GROUPS, ORDER_STATUSES, PAYMENT_METHODS } from '../constants/orderStatus.js';
import { csvOf, objectIdRule, pageQuery, pageQuerySchema } from './common.schema.js';
import { phoneRule } from './rules.js';

const reasonCode = z.string().trim().max(40).optional();
const reason = z.string().trim().max(300, 'Use 300 characters or fewer').optional();

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

/** Dashboard table filters: a status group and a search (order number, item, and for Kaluppa the customer). */
export const orderTableFilters = z.object({
  group: z.enum([...Object.keys(ORDER_GROUPS), 'all'], 'Unknown status').default('all'),
  q: z.string().trim().max(80).default(''),
});

/** Kaluppa's Orders table (GET /admin/orders): Status group (To confirm by default), customer type, method, payment, search. */
export const adminOrderFilters = z.object({
  status: z.enum([...Object.keys(ORDER_GROUPS), 'all'], 'Unknown status').default('to_confirm'),
  q: z.string().trim().max(80).default(''),
  type: z.enum(['buyer', 'farmer'], 'Unknown customer type').optional(),
  method: z.enum(FULFILLMENT_METHODS, 'Unknown delivery method').optional(),
  payment: z.enum(PAYMENT_METHODS, 'Unknown payment').optional(),
});
export const adminOrderListQuery = adminOrderFilters.extend(pageQuerySchema.shape);

/** Buyer pages page by cursor; the farmer's dashboard table sends `page` for numbered pages. */
export const orderListQuery = pageQuery(20, 10).extend({
  status: csvOf(ORDER_STATUSES, 'Unknown status'),
  page: z.coerce.number().int().min(1).optional(),
}).extend(orderTableFilters.shape);

/** Buyer cancel; the reason code list and "other" text are checked by the status service. */
export const cancelOrderSchema = z.object({ reasonCode: z.string('Choose a reason').trim().min(1, 'Choose a reason').max(40), reason });

/** Staff status change (no UI in Phase 1). */
export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES, 'Unknown status'),
  reasonCode,
  reason,
  note: z.string().trim().max(300, 'Use 300 characters or fewer').optional(),
  rider: z.object({ name: z.string().trim().min(2, 'Enter the rider name').max(60, 'Use 60 characters or fewer'), phone: phoneRule }).optional(),
});

export const refundSchema = z.object({ referenceNumber: z.string('Enter the reference number').trim().min(4, 'Enter the reference number').max(40) });
