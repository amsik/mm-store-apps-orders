import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'scripts', include: ['scripts/**/*.test.js'] } },
      'apps/*/vitest.config.{js,ts}',
      'apps/*/vitest.int.config.{js,ts}',
    ],
  },
});
