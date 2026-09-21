import type { ArgumentsHost } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import { AppErrorFilter } from './app-error.filter.js';
import { NotFoundError } from './app-errors.js';
import { ErrorCode } from './error-codes.js';

const REQUEST_ID = 'req-123';

/** The `ArgumentsHost` Nest hands a filter for a GraphQL resolver: `[root, args, context, info]`. */
const host = {
  getType: () => 'graphql',
  getArgs: () => [undefined, {}, { req: { id: REQUEST_ID } }, {}],
} as unknown as ArgumentsHost;

function setup(nodeEnv: AppConfig['nodeEnv']) {
  const logger = { error: vi.fn(), setContext: vi.fn() };
  const filter = new AppErrorFilter(logger as unknown as PinoLogger, { nodeEnv } as AppConfig);
  return { filter, logger };
}

describe('AppErrorFilter', () => {
  it('passes GraphQL errors (e.g. from the ValidationPipe) through untouched', () => {
    const { filter, logger } = setup('production');
    const error = new GraphQLError('Invalid input', { extensions: { code: ErrorCode.BAD_USER_INPUT } });

    expect(filter.catch(error, host)).toBe(error);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps a NotFoundError to NOT_FOUND with its message', () => {
    const { filter } = setup('production');

    const result = filter.catch(new NotFoundError('Order 1 not found'), host);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result).toMatchObject({ message: 'Order 1 not found', extensions: { code: ErrorCode.NOT_FOUND } });
  });

  it('masks an unexpected error in production and logs it with the request id', () => {
    const { filter, logger } = setup('production');
    const error = new Error('connection string mongodb://user:secret@db leaked');

    const result = filter.catch(error, host);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result?.message).toBe('Internal server error');
    expect(result?.extensions).toEqual({ code: ErrorCode.INTERNAL_SERVER_ERROR, requestId: REQUEST_ID });
    expect(logger.error).toHaveBeenCalledWith({ err: error, requestId: REQUEST_ID }, 'Unhandled error');
  });

  it('keeps the original message outside production to ease debugging', () => {
    const { filter, logger } = setup('development');

    const result = filter.catch(new Error('boom'), host);

    expect(result).toMatchObject({
      message: 'boom',
      extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR, requestId: REQUEST_ID },
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('treats a thrown non-Error value as unexpected', () => {
    const { filter } = setup('production');

    expect(filter.catch('a string', host)).toMatchObject({
      message: 'Internal server error',
      extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR },
    });
  });
});
