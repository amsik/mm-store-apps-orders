// Detects tool/AI attribution lines in commit messages and PR bodies.
// Project rule: AI usage is disclosed in AI_USAGE.md, never via trailers or footers.

const AI_TOOL = String.raw`(?:claude|anthropic|chatgpt|openai|copilot|gemini|cursor|codex|gpt-?\d*|ai|bot)\b`;

const PATTERNS = [
  /^co-authored-by:/i,
  new RegExp(String.raw`^(?:🤖\s*)?generated (?:with|by)\b.*?\b${AI_TOOL}`, 'i'),
  new RegExp(String.raw`^signed-off-by:.*?\b${AI_TOOL}`, 'i'),
];

/**
 * @param {string} text commit message or PR body
 * @returns {string[]} the trimmed offending lines, empty when clean
 */
export function findAttribution(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => PATTERNS.some((pattern) => pattern.test(line)));
}
