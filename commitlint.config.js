import { findAttribution } from './scripts/attribution.js';

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-attribution': ({ raw }) => {
          const lines = findAttribution(raw ?? '');
          return [
            lines.length === 0,
            `remove attribution lines (disclose AI usage in AI_USAGE.md): ${lines.join(' | ')}`,
          ];
        },
      },
    },
  ],
  rules: {
    'no-attribution': [2, 'always'],
  },
};
