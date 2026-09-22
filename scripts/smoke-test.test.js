import { describe, expect, it, vi } from 'vitest';
import { smokeTest } from './smoke-test.js';

/** @param {unknown} body */
function jsonResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

const healthyOnce = jsonResponse({ data: { health: { status: 'OK', db: 'UP' } } });
const ordersOnce = jsonResponse({ data: { orders: { nodes: [], pageInfo: { hasNextPage: false } } } });

describe('smokeTest', () => {
  it('resolves once health is UP and the orders query succeeds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(healthyOnce).mockResolvedValueOnce(ordersOnce);
    await expect(
      smokeTest('https://api.example/graphql', { fetch, sleep: vi.fn() }),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example/graphql',
      expect.objectContaining({ method: 'POST', body: expect.stringMatching(/health/) }),
    );
    // OrderConnection exposes `nodes`, not the Relay `edges { node }` shape — matching
    // apps/api/schema.gql's `type OrderConnection { nodes: [Order!]! pageInfo: PageInfo! }`
    // is what this test would have caught before the first real deploy did instead.
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example/graphql',
      expect.objectContaining({ body: expect.stringMatching(/orders\(first: 1\) \{ nodes \{ id \}/) }),
    );
  });

  it('retries the health check until the API becomes ready (cold start), without retrying the orders query', async () => {
    const notReady = jsonResponse({ data: { health: { status: 'OK', db: 'DOWN' } } });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(notReady)
      .mockResolvedValueOnce(healthyOnce)
      .mockResolvedValueOnce(ordersOnce);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await smokeTest('https://api.example/graphql', { fetch, sleep, retries: 5, delayMs: 1000 });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('throws after exhausting retries when the API never becomes healthy', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      smokeTest('https://api.example/graphql', { fetch, sleep, retries: 3, delayMs: 500 }),
    ).rejects.toThrow(/did not become healthy/);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a GraphQL error from the orders query, with no retry', async () => {
    const ordersError = jsonResponse({ errors: [{ message: 'boom' }] });
    const fetch = vi.fn().mockResolvedValueOnce(healthyOnce).mockResolvedValueOnce(ordersError);

    await expect(
      smokeTest('https://api.example/graphql', { fetch, sleep: vi.fn(), retries: 5 }),
    ).rejects.toThrow(/boom/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a non-2xx HTTP response from the orders query', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(healthyOnce).mockResolvedValueOnce(jsonResponse({}, false));

    await expect(
      smokeTest('https://api.example/graphql', { fetch, sleep: vi.fn(), retries: 5 }),
    ).rejects.toThrow(/HTTP 500/);
  });
});
