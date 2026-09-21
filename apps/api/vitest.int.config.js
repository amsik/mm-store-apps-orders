import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest.shared.js';

// Integration specs boot the real Nest app against a MongoDB replica set started once per run
// (Prisma needs a replica set on MongoDB). Each worker gets its own database, emptied before every test.
export default defineConfig({
  plugins: [swcPlugin()],
  test: {
    name: 'api-int',
    root: import.meta.dirname,
    include: ['test/**/*.int-spec.ts'],
    globalSetup: ['test/setup/mongo-replset.ts'],
    setupFiles: ['test/setup/database.ts'],
    env: { LOG_LEVEL: 'silent' },
    // The first run downloads the mongod binary.
    hookTimeout: 120_000,
  },
});
