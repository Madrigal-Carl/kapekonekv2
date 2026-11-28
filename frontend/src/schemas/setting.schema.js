import { z } from 'zod'
import { emailRule, openingHoursRule, phoneRule, walletAccountsRule } from './rules.js'

// Mirror backend/src/schemas/setting.schema.js. Kaluppa types pesos; the API takes integer centavos.
const pesos = (label, min = 0) =>
  z.number(`Enter the ${label}`).min(min / 100, `Enter at least ₱${min / 100}`).max(100_000, 'Enter ₱100,000 or less').transform((p) => Math.round(p * 100))
const km = (label, min = 0) => z.number(`Enter the ${label}`).min(min, `Enter at least ${min} km`).max(200, 'Enter 200 km or less')
const days = z.number('Enter the days').int('Use whole days').min(1, 'Enter at least 1 day').max(30, 'Enter 30 days or less')

export const branchFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the branch name').max(80, 'Use 80 characters or fewer'),
  phone: phoneRule,
  contactEmail: z.union([z.literal(''), emailRule]).nullish().transform((v) => v || null),
  street: z.string().trim().max(120, 'Use 120 characters or fewer'),
  municipality: z.string().min(1, 'Choose a municipality'),
  barangay: z.string().min(1, 'Choose a barangay'),
  location: z.object({ lat: z.number(), lng: z.number() }, 'Pin the branch on the map'),
  hours: openingHoursRule,
})

/** Fees in pesos; submits `baseFeeCentavos`, `perKmCentavos`, `roundUpToCentavos`. */
export const deliveryFormSchema = z
  .object({
    baseFee: pesos('base fee'),
    baseKm: km('distance the base fee covers'),
    perKm: pesos('fee per km'),
    roundUpTo: pesos('rounding step', 100),
    maxKm: km('maximum distance', 1),
    minBusinessDays: days,
    maxBusinessDays: days,
  })
  .refine((v) => v.maxBusinessDays >= v.minBusinessDays, { path: ['maxBusinessDays'], message: 'End on or after the first day' })

export const ewalletFormSchema = z.object({ accounts: walletAccountsRule })
