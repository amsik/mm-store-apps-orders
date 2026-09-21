import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { requestId } from './request-id.js';

function call(header?: string | string[]) {
  const req = { headers: header === undefined ? {} : { 'x-request-id': header } } as IncomingMessage;
  const res = { setHeader: vi.fn() };
  const id = requestId(req, res as unknown as ServerResponse);
  return { id, res };
}

describe('requestId', () => {
  it('generates a UUID and echoes it in the x-request-id response header', () => {
    const { id, res } = call();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', id);
  });

  it('reuses a well-formed incoming x-request-id so a client can correlate its logs', () => {
    const { id, res } = call('web-7f3a9c');

    expect(id).toBe('web-7f3a9c');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'web-7f3a9c');
  });

  it.each([
    ['a value that could forge log lines', 'abc\n{"level":60}'],
    ['an overlong value', 'a'.repeat(129)],
    ['an empty value', ''],
    ['a repeated header', ['a', 'b']],
  ])('replaces %s with a fresh id', (_case, header) => {
    expect(call(header).id).not.toEqual(header);
  });
});
