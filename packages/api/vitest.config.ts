import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'default'],
    alias: {
      // Resolve workspace packages from source during tests (no build required)
      '@par-tee/db': path.resolve(__dirname, '../db/src/index.ts'),
      '@par-tee/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
