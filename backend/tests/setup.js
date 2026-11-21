// Runs before each test file's imports, so config/env.js parses these values (dotenv is skipped in tests).
Object.assign(process.env, {
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  MONGO_URI: 'mongodb://127.0.0.1:27017/kapekonek-test',
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123',
  JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-0123',
  MAIL_TRANSPORT: 'log',
  KALUPPA_ORDERS_EMAIL: 'orders@kapekonek.test',
  VALKEY_HOST: '127.0.0.1',
  VALKEY_PORT: '6379',
  VALKEY_TLS: 'false',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
  CRON_SECRET: 'test-cron-secret-0123456789',
});
