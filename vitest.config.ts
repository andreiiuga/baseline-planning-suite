import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/*/tests/**/*.test.{ts,tsx}', 'integration/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
