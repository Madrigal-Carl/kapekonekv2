import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Every file shares one in-memory replica set; more workers than this time out its hooks on a 12-thread machine.
    maxWorkers: 6,
  },
});
