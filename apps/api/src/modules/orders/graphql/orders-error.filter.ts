import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ErrorCode } from '../../../core/errors/error-codes.js';
import { ConcurrentModificationError } from '../application/errors.js';
import { EmployeeRequiredError, InvalidTransitionError } from '../domain/errors.js';

type OrderError = InvalidTransitionError | EmployeeRequiredError | ConcurrentModificationError;

/**
 * Maps the order rules' errors to stable codes at the API edge, so the domain stays unaware of GraphQL.
 * Scoped to the orders resolver; anything it does not catch falls through to the global filter.
 */
@Catch(InvalidTransitionError, EmployeeRequiredError, ConcurrentModificationError)
export class OrdersErrorFilter implements GqlExceptionFilter {
  catch(error: OrderError): GraphQLError {
    if (error instanceof InvalidTransitionError) {
      return new GraphQLError(error.message, {
        extensions: { code: ErrorCode.INVALID_TRANSITION, from: error.from, to: error.to },
      });
    }
    const code =
      error instanceof EmployeeRequiredError
        ? ErrorCode.EMPLOYEE_REQUIRED
        : ErrorCode.CONCURRENT_MODIFICATION;
    return new GraphQLError(error.message, { extensions: { code } });
  }
}
