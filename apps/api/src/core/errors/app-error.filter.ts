import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { NotFoundError } from './app-errors.js';
import { ErrorCode } from './error-codes.js';

/** Turns application errors into GraphQL errors with a stable code; graphql-js reports the returned error on the field. */
@Catch(NotFoundError)
export class AppErrorFilter implements GqlExceptionFilter {
  catch(error: NotFoundError): GraphQLError {
    return new GraphQLError(error.message, { extensions: { code: ErrorCode.NOT_FOUND } });
  }
}
