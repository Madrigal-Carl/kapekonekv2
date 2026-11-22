import { z } from 'zod'
import { emailRule, nameRule, optionalNameRule, passwordRule, phoneRule, usernameRule } from './rules.js'

const currentPassword = z.string().min(1, 'Enter your current password')

// Mirrors backend/src/schemas/account.schema.js.
export const profileSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  contactNumber: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .pipe(phoneRule.nullable()),
})

export const changeEmailSchema = z.object({ email: emailRule, currentPassword })

export const changePasswordSchema = z
  .object({ currentPassword, password: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" })
