import swc from 'unplugin-swc';

// Nest resolves constructor dependencies from `design:paramtypes` metadata, which esbuild (Vitest's
// default transformer) does not emit. SWC does, so every API test goes through it.
export const swcPlugin = () =>
  swc.vite({
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  });
