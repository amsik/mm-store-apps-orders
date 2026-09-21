import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'scripts', include: ['scripts/**/*.test.js'] } },
      'apps/*/vitest.config.{js,ts}',
      'apps/*/vitest.int.config.{js,ts}',
    ],
    // Coverage is collected across all projects, so it lives here rather than in the per-app configs.
    coverage: {
      provider: 'v8',
      include: ['apps/api/src/**/*.ts', 'apps/web/src/**/*.{ts,tsx}'],
      exclude: ['**/*.spec.ts', '**/*.test.{ts,tsx}', 'apps/web/src/{gql,test}/**'],
      thresholds: {
        // Domain modules are pure business rules: every line and branch must be exercised.
        'apps/api/src/modules/*/domain/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
