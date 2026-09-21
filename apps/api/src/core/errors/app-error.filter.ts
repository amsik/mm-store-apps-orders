import { type ArgumentsHost, Catch, Inject } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlArgumentsHost, type GqlContextType, type GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../di/tokens.js';
import { NotFoundError } from './app-errors.js';
import { ErrorCode } from './error-codes.js';

interface GqlContext {
  req?: { id?: string };
}

/**
 * Last line of the resolver error handling: every error leaves with a code from the catalog. Feature filters
 * (e.g. `OrdersErrorFilter`) map their own errors first; this one passes GraphQL errors through, maps the shared
 * application errors, and turns anything else into INTERNAL_SERVER_ERROR, logged with the request id and masked
 * in production. graphql-js reports the returned error on the field.
 *
 * Nest also routes HTTP-level errors (e.g. body-parser's 413) to global filters; those have no GraphQL response
 * to return into, so they go to Nest's default HTTP handling.
 */
@Catch()
export class AppErrorFilter extends BaseExceptionFilter implements GqlExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
    this.logger.setContext(AppErrorFilter.name);
  }

  override catch(error: unknown, host: ArgumentsHost): GraphQLError | undefined {
    if (host.getType<GqlContextType>() !== 'graphql') {
      super.catch(error, host);
      return undefined;
    }
    if (error instanceof GraphQLError) return error;
    if (error instanceof NotFoundError) {
      return new GraphQLError(error.message, { extensions: { code: ErrorCode.NOT_FOUND } });
    }

    const requestId = GqlArgumentsHost.create(host).getContext<GqlContext>().req?.id;
    this.logger.error({ err: error, requestId }, 'Unhandled error');
    const message =
      this.config.nodeEnv === 'production' || !(error instanceof Error)
        ? 'Internal server error'
        : error.message;
    return new GraphQLError(message, { extensions: { code: ErrorCode.INTERNAL_SERVER_ERROR, requestId } });
  }
}
