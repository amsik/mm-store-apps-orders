import type { GraphQLFormattedError } from 'graphql';
import type { AppConfig } from '../config/app-config.js';
import { ErrorCode } from './error-codes.js';

/**
 * Apollo `formatError` backstop for errors raised outside resolvers (e.g. scalar serialization), which never
 * reach the exception filters: in production an internal error keeps only its code and request id.
 */
export function createFormatError(nodeEnv: AppConfig['nodeEnv']) {
  return (formatted: GraphQLFormattedError): GraphQLFormattedError => {
    const code = formatted.extensions?.code ?? ErrorCode.INTERNAL_SERVER_ERROR;
    if (nodeEnv !== 'production' || code !== ErrorCode.INTERNAL_SERVER_ERROR) return formatted;

    const requestId = formatted.extensions?.requestId;
    return {
      message: 'Internal server error',
      ...(formatted.locations && { locations: formatted.locations }),
      ...(formatted.path && { path: formatted.path }),
      extensions: { code, ...(requestId !== undefined && { requestId }) },
    };
  };
}
