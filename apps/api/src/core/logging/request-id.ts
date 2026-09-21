import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Anything else (newlines, JSON, huge values) could forge or bloat log lines, so it is replaced.
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

/** pino-http `genReqId`: reuses a safe incoming `x-request-id` or creates one, and echoes it to the client. */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}
