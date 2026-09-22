// Post-deploy check for the CI/CD pipeline (T15): the health query is retried to ride out a
// Cloud Run cold start, then one real query is run once to prove the whole graph (resolver,
// Prisma, Mongo) actually works. Called against a --no-traffic tagged revision URL before the
// deploy workflow shifts production traffic to it.
import { pathToFileURL } from 'node:url';

/** @typedef {{ health?: { status?: string, db?: string } }} HealthData */

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} url GraphQL endpoint
 * @param {string} queryText
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<unknown>} `data`
 */
async function query(url, queryText, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: queryText }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  const body = /** @type {{ data?: unknown, errors?: { message: string }[] }} */ (await response.json());
  if (body.errors && body.errors.length > 0) {
    throw new Error(`GraphQL error from ${url}: ${body.errors.map((error) => error.message).join('; ')}`);
  }
  return body.data;
}

/**
 * Polls `health` until both the process and its Mongo connection report ready, or throws once
 * `retries` attempts are exhausted. Every failure (network error, non-2xx, not-yet-ready) is
 * treated the same way here, since a cold start can surface as any of the three.
 * @param {string} url
 * @param {{ fetchImpl: typeof fetch, retries: number, delayMs: number, sleep: (ms: number) => Promise<void> }} options
 */
async function waitForHealthy(url, { fetchImpl, retries, delayMs, sleep }) {
  /** @type {unknown} */
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = /** @type {HealthData} */ (await query(url, '{ health { status db } }', fetchImpl));
      if (data.health?.status === 'OK' && data.health?.db === 'UP') return;
      lastError = new Error(`health not ready yet: ${JSON.stringify(data.health)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(delayMs);
  }
  throw new Error(`API at ${url} did not become healthy after ${retries} attempts: ${messageOf(lastError)}`);
}

/**
 * @param {string} url the GraphQL endpoint of the revision under test
 * @param {{ fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, retries?: number, delayMs?: number }} [options]
 */
export async function smokeTest(
  url,
  { fetch: fetchImpl = globalThis.fetch, sleep = defaultSleep, retries = 10, delayMs = 3000 } = {},
) {
  await waitForHealthy(url, { fetchImpl, retries, delayMs, sleep });
  await query(url, '{ orders(first: 1) { edges { node { id } } } }', fetchImpl);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/smoke-test.js <graphql-url>');
    process.exit(1);
  }
  const startedAt = Date.now();
  try {
    await smokeTest(url);
    console.log(`✔ ${url} is healthy (${Date.now() - startedAt}ms, including cold-start retries)`);
  } catch (error) {
    console.error(`✖ smoke test failed for ${url}: ${messageOf(error)}`);
    process.exit(1);
  }
}
