import type { CodegenConfig } from '@graphql-codegen/cli';

// Types come from the API's committed SDL, so the web app never needs a running API to build.
// The output is committed too: CI regenerates it and fails on a diff (codegen drift).
const config: CodegenConfig = {
  schema: '../api/schema.gql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**'],
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        // Apollo's cache adds __typename to every object, so the types (and test fixtures) carry it too.
        nonOptionalTypename: true,
        scalars: { DateTime: 'string' },
      },
    },
  },
};

export default config;
