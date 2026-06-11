import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Test against workspace source so a stale dist/ can't skew results.
      '@sherizan/proto-compile': fileURLToPath(
        new URL('../proto-compile/src/index.ts', import.meta.url),
      ),
      '@sherizan/proto-manifest': fileURLToPath(
        new URL('../proto-manifest/src/index.ts', import.meta.url),
      ),
    },
  },
});
