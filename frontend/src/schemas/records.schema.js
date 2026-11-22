import { z } from 'zod'
import { associationDescriptionRule, associationNameRule, emailRule, nameRule, optionalNameRule, phoneRule, usernameRule } from './rules.js'

// Mirror backend/src/schemas/{farmer,groupManager,association}.schema.js. Documents and pickers are sent beside these.

/** A Group Manager adds or edits a farmer. Email is optional: without one, a temporary password is shown once. */
export const farmerFormSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  contactNumber: phoneRule,
  email: z.union([z.literal(''), emailRule]).nullish().transform((v) => v || null),
})

export const groupManagerFormSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  contactNumber: phoneRule,
  email: emailRule,
  associationId: z.string().nullable(),
})

export const associationFormSchema = z.object({
  name: associationNameRule,
  municipality: z.string().min(1, 'Choose a municipality in Marinduque'),
  description: associationDescriptionRule,
  groupManagerId: z.string().nullable(),
})

/** "Rodel Mendoza" → "rodel.mendoza" (the screens' "Suggested from the name"). */
export const suggestUsername = (first = '', last = '') =>
  [first, last]
    .map((part) => part.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('.')
    .slice(0, 30)
