import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.js'],
    include: ['tests/**/*.test.js'],
    // support.js is a generated build artifact — defensive exclude prevents accidental collection
    exclude: ['node_modules/**', 'support.js'],
  },
});
