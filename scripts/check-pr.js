// CI gate for pull requests: the title must be a Conventional Commit (it becomes the squash commit)
// and the body must not carry attribution lines. Reads PR_TITLE / PR_BODY from the environment.
import { pathToFileURL } from 'node:url';
import load from '@commitlint/load';
import lint from '@commitlint/lint';
import { findAttribution } from './attribution.js';

/**
 * @param {{ title: string, body: string }} pr
 * @returns {Promise<string[]>} human-readable errors, empty when the PR passes
 */
export async function checkPullRequest({ title, body }) {
  const config = await load();
  const result = await lint(title, config.rules, { plugins: config.plugins });
  const errors = result.errors.map((error) => `PR title "${title}": ${error.message}`);
  for (const line of findAttribution(body)) {
    errors.push(`PR body contains an attribution line: "${line}"`);
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const errors = await checkPullRequest({
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
  });
  for (const error of errors) console.error(`✖ ${error}`);
  if (errors.length > 0) process.exit(1);
  console.log('✔ PR title and body OK');
}
