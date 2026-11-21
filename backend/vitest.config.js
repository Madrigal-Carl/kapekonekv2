import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
