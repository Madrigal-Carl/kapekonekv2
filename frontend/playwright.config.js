import { defineConfig, devices } from '@playwright/test'

// E2E runs its own API (5100) and web server (5174) so it never depends on, or disturbs, `npm run dev`.
// The API uses backend/.env (seeded database) with emails logged to backend/storage/mail.
const API_PORT = 5100
const WEB_PORT = 5174

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 }, // the dev database is on Atlas (Singapore): a write can take a few seconds
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), CLIENT_URL: `http://localhost:${WEB_PORT}`, MAIL_TRANSPORT: 'log' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}/api`, VITE_SOCKET_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
})
