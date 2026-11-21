import { z } from 'zod'
import { cancelReasonRule, phoneRule } from './rules'

/** Checkout form; same rules as the backend's placeOrderSchema. */
export const checkoutSchema = z
  .object({
    method: z.enum(['delivery', 'pickup']),
    addressId: z.string().optional(),
    contactPhone: z.string().optional(),
    paymentMethod: z.enum(['e_wallet', 'cash']),
    provider: z.string().optional(),
    receipt: z.object({ url: z.string(), publicId: z.string(), name: z.string().optional() }).nullable(),
    note: z.string().trim().max(500, 'Use 500 characters or fewer').optional(),
  })
  .superRefine((value, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (value.method === 'delivery' && !value.addressId) issue('addressId', 'Choose a delivery address')
    if (value.method === 'pickup') {
      const phone = phoneRule.safeParse(value.contactPhone ?? '')
      if (!phone.success) issue('contactPhone', value.contactPhone ? phone.error.issues[0].message : 'Enter a contact number so Kaluppa can reach you about your pickup')
    }
    if (value.paymentMethod === 'e_wallet' && !value.receipt) issue('receipt', 'Upload your payment receipt')
  })

/** Buyer cancel: a reason, with details required for "Other". */
export const cancelOrderSchema = z
  .object({ reasonCode: z.string().min(1, 'Choose a reason'), reason: z.string().trim().optional() })
  .superRefine((value, ctx) => {
    if (value.reasonCode !== 'other' && !value.reason) return
    const parsed = cancelReasonRule.safeParse(value.reason ?? '')
    if (!parsed.success) ctx.addIssue({ code: 'custom', path: ['reason'], message: value.reason ? parsed.error.issues[0].message : 'Tell us why you’re cancelling' })
  })
