import { describe, expect, it } from 'vitest';
import { checkPullRequest } from './check-pr.js';

const cleanBody = '## Context\nScaffold.\n\n## Outcome\nCI green.';

describe('checkPullRequest', () => {
  it('accepts a conventional title and a clean body', async () => {
    expect(await checkPullRequest({ title: 'chore: scaffold yarn monorepo', body: cleanBody })).toEqual([]);
  });

  it('accepts an empty body', async () => {
    expect(await checkPullRequest({ title: 'feat(api): add health query', body: '' })).toEqual([]);
  });

  it.each(['Scaffold the monorepo', 'feature: add thing', 'feat: '])(
    'rejects a non-conventional title: %s',
    async (title) => {
      const errors = await checkPullRequest({ title, body: cleanBody });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join('\n')).toMatch(/title/i);
    },
  );

  it('rejects a body with attribution lines and names them', async () => {
    const body = `${cleanBody}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
    const errors = await checkPullRequest({ title: 'chore: x', body });
    expect(errors).toEqual([
      'PR body contains an attribution line: "🤖 Generated with [Claude Code](https://claude.com/claude-code)"',
    ]);
  });

  it('rejects a title carrying attribution', async () => {
    const errors = await checkPullRequest({ title: 'Co-Authored-By: bot', body: '' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
