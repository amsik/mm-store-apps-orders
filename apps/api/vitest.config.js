import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Nest resolves constructor dependencies from `design:paramtypes` metadata, which esbuild (Vitest's
// default transformer) does not emit. SWC does, so every API test goes through it.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    name: 'api',
    root: import.meta.dirname,
    // Unit specs sit next to the code; integration specs boot the Nest app and live in test/.
    include: ['src/**/*.spec.ts', 'test/**/*.int-spec.ts'],
    env: { LOG_LEVEL: 'silent' },
  },
});
