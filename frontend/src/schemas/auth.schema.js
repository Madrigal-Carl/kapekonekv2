import { z } from 'zod'
import { emailRule, nameRule, optionalNameRule, passwordRule, usernameRule } from './rules.js'

const matching = (schema) =>
  schema.refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" })

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})

export const registerSchema = matching(
  z.object({
    role: z.enum(['buyer', 'farmer']),
    firstName: nameRule,
    middleName: optionalNameRule,
    lastName: nameRule,
    username: usernameRule,
    email: emailRule,
    password: passwordRule,
    confirmPassword: z.string(),
  }),
)

export const forgotPasswordSchema = z.object({ email: emailRule })

export const resetPasswordSchema = matching(z.object({ password: passwordRule, confirmPassword: z.string() }))
