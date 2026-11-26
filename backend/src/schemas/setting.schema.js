import { z } from 'zod';
import { insideMarinduque } from '../services/boundary.service.js';
import { getLocations, isValidBarangay } from '../services/location.service.js';
import { openingHoursRule, phoneRule, walletAccountsRule } from './rules.js';

const MUNICIPALITIES = getLocations().map((m) => m.name);
const whole = (label, max) => z.number(`Enter the ${label}`).int('Use whole numbers').min(0, 'Enter 0 or more').max(max, `Enter ${max.toLocaleString('en-PH')} or less`);
const km = (label) => z.number(`Enter the ${label}`).min(0, 'Enter 0 or more').max(200, 'Enter 200 km or less');

/** Settings → Branch (SettingsKaluppa.dc.html): the delivery-fee origin, the pickup card, bean drop-off. */
export const branchSettingSchema = z
  .object({
    name: z.string('Enter the branch name').trim().min(2, 'Enter the branch name').max(80, 'Use 80 characters or fewer'),
    phone: phoneRule,
    street: z.string().trim().max(120, 'Use 120 characters or fewer').default(''),
    municipality: z.enum(MUNICIPALITIES, 'Choose a municipality in Marinduque'),
    barangay: z.string('Choose a barangay').trim().min(1, 'Choose a barangay'),
    location: z.object({ lat: z.number(), lng: z.number() }, 'Pin the branch on the map').refine(insideMarinduque, 'Put the pin on the branch, inside Marinduque'),
    hours: openingHoursRule,
  })
  .superRefine((value, ctx) => {
    if (!isValidBarangay(value.municipality, value.barangay)) ctx.addIssue({ code: 'custom', path: ['barangay'], message: `Choose a barangay in ${value.municipality}` });
  });

/** Settings → Delivery fee: fee rules (centavos) and the delivery estimate in business days. */
export const deliverySettingSchema = z
  .object({
    baseFeeCentavos: whole('base fee', 10_000_000),
    baseKm: km('distance the base fee covers'),
    perKmCentavos: whole('fee per km', 10_000_000),
    roundUpToCentavos: whole('rounding step', 100_000).min(100, 'Round to at least ₱1'),
    maxKm: km('maximum distance').min(1, 'Enter at least 1 km'),
    minBusinessDays: z.number('Enter the days').int('Use whole days').min(1, 'Enter at least 1 day').max(30, 'Enter 30 days or less'),
    maxBusinessDays: z.number('Enter the days').int('Use whole days').min(1, 'Enter at least 1 day').max(30, 'Enter 30 days or less'),
  })
  .refine((v) => v.maxBusinessDays >= v.minBusinessDays, { path: ['maxBusinessDays'], message: 'End on or after the first day' });

/** Settings → E-wallet: one account per provider, its QR code and whether checkout shows it. */
export const ewalletSettingSchema = z.object({ accounts: walletAccountsRule });
