import dotenv from 'dotenv';
import { z } from 'zod';

const required = z.string().min(1, 'is required');
const positiveInt = (fallback) => z.coerce.number().int().positive().default(fallback);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: positiveInt(5000),
    CLIENT_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
    MONGO_URI: required,

    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES: z.string().default('15m'),

    MAIL_TRANSPORT: z.enum(['brevo', 'log']).default('log'),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.email().optional(),
    EMAIL_FROM_NAME: z.string().default('KapeKonek'),
    KALUPPA_ORDERS_EMAIL: z.email(),

    VALKEY_HOST: required,
    VALKEY_PORT: positiveInt(6379),
    VALKEY_USERNAME: z.string().default('default'),
    VALKEY_PASSWORD: z.string().optional(),
    VALKEY_TLS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

    CLOUDINARY_CLOUD_NAME: required,
    CLOUDINARY_API_KEY: required,
    CLOUDINARY_API_SECRET: required,
    CLOUDINARY_ROOT_FOLDER: z.string().default('kapekonek'),

    // Optional: without it, delivery quotes use the straight-line fallback (PRODUCT-SPEC §3).
    MAPBOX_ACCESS_TOKEN: z.string().optional(),

    ORDER_EXPIRY_DAYS: positiveInt(3),
    ORDER_EXPIRY_INTERVAL_MINUTES: positiveInt(5),
    CRON_SECRET: z.string().min(16, 'must be at least 16 characters'),
    SEED_DEFAULT_PASSWORD: z.string().default('Password123!'),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT !== 'brevo') return;
    for (const key of ['BREVO_API_KEY', 'EMAIL_FROM']) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when MAIL_TRANSPORT=brevo' });
    }
  });

/**
 * Validate environment variables. Blank values count as missing.
 * @param {Record<string, string | undefined>} source
 * @returns {z.infer<typeof schema>}
 * @throws {Error} listing every invalid variable
 */
export function parseEnv(source) {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment variables (check backend/.env):\n${lines.join('\n')}`);
}

if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });

/** Validated configuration. Mutable only so tests can flip NODE_ENV. */
export const env = parseEnv(process.env);
