import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Test against proto-manifest source so a stale dist/ can never skew results.
      '@sherizan/proto-manifest': fileURLToPath(
        new URL('../proto-manifest/src/index.ts', import.meta.url),
      ),
    },
  },
});
