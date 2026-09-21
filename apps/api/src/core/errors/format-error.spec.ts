import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-codes.js';
import { createFormatError } from './format-error.js';

const leaked: GraphQLFormattedError = {
  message: 'Cannot serialize value: secret internals',
  path: ['order', 'createdAt'],
  extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR, stacktrace: ['at secret.ts:1'] },
};

describe('createFormatError', () => {
  it('masks internal errors that never reached the exception filter in production', () => {
    expect(createFormatError('production')(leaked)).toEqual({
      message: 'Internal server error',
      path: ['order', 'createdAt'],
      extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR },
    });
  });

  it('treats an error without a code as internal', () => {
    expect(createFormatError('production')({ message: 'secret' })).toEqual({
      message: 'Internal server error',
      extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR },
    });
  });

  it('keeps the request id the exception filter attached', () => {
    const masked = createFormatError('production')({
      message: 'Internal server error',
      extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR, requestId: 'r1' },
    });
    expect(masked.extensions).toEqual({ code: ErrorCode.INTERNAL_SERVER_ERROR, requestId: 'r1' });
  });

  it('leaves client errors alone in production', () => {
    const error: GraphQLFormattedError = {
      message: 'Cannot move an order from COMPLETE to OPEN',
      extensions: { code: ErrorCode.INVALID_TRANSITION, from: 'COMPLETE', to: 'OPEN' },
    };
    expect(createFormatError('production')(error)).toBe(error);
  });

  it('changes nothing outside production', () => {
    expect(createFormatError('development')(leaked)).toBe(leaked);
  });
});
