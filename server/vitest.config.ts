import { defineConfig } from 'vitest/config';

// TZ is forced to Asia/Bangkok via the npm script so date/time math in the
// pricing engine is deterministic regardless of the host machine's locale.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Force test mode so the db layer uses in-process pglite, not a real PG.
    env: { NODE_ENV: 'test' },
  },
});
