import { z } from 'zod';
import { emailRule, nameRule, optionalNameRule, passwordRule, phoneRule, usernameRule } from './rules.js';

const currentPassword = z.string('Enter your current password').min(1, 'Enter your current password');

export const profileSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  // Optional here; checkout asks for it if it's missing.
  contactNumber: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .pipe(phoneRule.nullable()),
});

export const avatarSchema = z.object({ url: z.url().max(500), publicId: z.string().min(1).max(300) });

export const changeEmailSchema = z.object({ email: emailRule, currentPassword });

export const changePasswordSchema = z.object({ currentPassword, password: passwordRule });
