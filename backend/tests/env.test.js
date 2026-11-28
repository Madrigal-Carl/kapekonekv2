import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const minimal = {
  CLIENT_URL: 'http://localhost:5173/',
  MONGO_URI: 'mongodb://localhost/kk',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  KALUPPA_ORDERS_EMAIL: 'orders@kapekonek.test',
  VALKEY_HOST: 'localhost',
  VALKEY_PORT: '6379',
  CLOUDINARY_CLOUD_NAME: 'c',
  CLOUDINARY_API_KEY: 'k',
  CLOUDINARY_API_SECRET: 's',
  CRON_SECRET: 'c'.repeat(16),
};

describe('parseEnv', () => {
  it('names every missing variable', () => {
    expect(() => parseEnv({})).toThrow(/MONGO_URI[\s\S]*JWT_ACCESS_SECRET|JWT_ACCESS_SECRET[\s\S]*MONGO_URI/);
  });

  it('treats blank values (from .env.example) as missing', () => {
    expect(() => parseEnv({ ...minimal, MONGO_URI: '' })).toThrow(/MONGO_URI/);
  });

  it('applies the spec defaults', () => {
    const env = parseEnv(minimal);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      ACCESS_TOKEN_EXPIRES: '15m',
      MAIL_TRANSPORT: 'log',
      EMAIL_FROM_NAME: 'KapeKonek',
      VALKEY_USERNAME: 'default',
      VALKEY_TLS: true,
      CLOUDINARY_ROOT_FOLDER: 'kapekonek',
      ORDER_EXPIRY_DAYS: 3,
      ORDER_EXPIRY_INTERVAL_MINUTES: 5,
      SEED_DEFAULT_PASSWORD: 'KapeKonek@123',
    });
    expect(env.VALKEY_PORT).toBe(6379);
    expect(env.CLIENT_URL).toBe('http://localhost:5173'); // trailing slash removed for CORS
  });

  it('refuses short secrets', () => {
    expect(() => parseEnv({ ...minimal, JWT_ACCESS_SECRET: 'a'.repeat(31) })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => parseEnv({ ...minimal, JWT_REFRESH_SECRET: 'b'.repeat(31) })).toThrow(/JWT_REFRESH_SECRET/);
    expect(() => parseEnv({ ...minimal, CRON_SECRET: 'c'.repeat(15) })).toThrow(/CRON_SECRET/);
  });

  it('parses VALKEY_TLS=false', () => {
    expect(parseEnv({ ...minimal, VALKEY_TLS: 'false' }).VALKEY_TLS).toBe(false);
  });

  it('requires Brevo settings only when MAIL_TRANSPORT=brevo', () => {
    expect(() => parseEnv({ ...minimal, MAIL_TRANSPORT: 'brevo' })).toThrow(/BREVO_API_KEY[\s\S]*EMAIL_FROM/);
    expect(() => parseEnv({ ...minimal, MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'x', EMAIL_FROM: 'hi@kapekonek.test' })).not.toThrow();
  });
});
