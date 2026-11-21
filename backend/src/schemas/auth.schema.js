import { z } from 'zod';
import { SIGNUP_ROLES } from '../constants/permissions.js';
import { emailRule, nameRule, optionalNameRule, passwordRule, usernameRule } from './rules.js';

export const registerSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  email: emailRule,
  password: passwordRule,
  role: z.enum(SIGNUP_ROLES, 'Choose how you want to use KapeKonek'),
});

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean().default(false),
});

export const tokenSchema = z.object({ token: z.string().trim().min(1, 'This link is incomplete') });

export const forgotPasswordSchema = z.object({ email: emailRule });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'This link is incomplete'),
  password: passwordRule,
});

export const usernameQuerySchema = z.object({ username: usernameRule });

export const suggestionsQuerySchema = z.object({
  firstName: z.string().trim().max(50).default(''),
  lastName: z.string().trim().max(50).default(''),
});
