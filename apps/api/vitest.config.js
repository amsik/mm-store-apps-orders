import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest.shared.js';

// Unit specs sit next to the code and need no database; integration specs live in test/ (vitest.int.config.js).
export default defineConfig({
  plugins: [swcPlugin()],
  test: {
    name: 'api',
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    env: { LOG_LEVEL: 'silent' },
  },
});
