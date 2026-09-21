import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '.yarn/**', 'apps/web/src/gql/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Nest modules are intentionally empty classes carrying a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    // Config is read once through ConfigModule and injected as APP_CONFIG; nothing else touches the env.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Inject APP_CONFIG instead of reading process.env.' },
      ],
    },
  },
  {
    // Domain code is plain TypeScript: business rules stay testable without a container, database or schema.
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                '@prisma/*',
                '@apollo/*',
                'graphql',
                'class-validator',
                'class-transformer',
              ],
              message: 'The domain layer must not depend on frameworks or infrastructure.',
            },
            {
              group: ['**/application/**', '**/infrastructure/**', '**/graphql/**', '**/core/**'],
              message: 'The domain layer must not import outer layers.',
            },
          ],
        },
      ],
    },
  },
  {
    // Application services depend on ports (repository interfaces bound to DI tokens), never on the database client.
    files: ['apps/api/src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/*', '**/core/prisma/**', '**/infrastructure/**', '**/graphql/**'],
              message:
                'The application layer depends on ports, not on Prisma, adapters or the GraphQL layer.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
