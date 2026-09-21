import type { ValidationError } from 'class-validator';
import { GraphQLError } from 'graphql';
import { ErrorCode } from './error-codes.js';

export interface FieldError {
  /** Dotted path inside the validated argument, e.g. `lineItems.0.quantity`. */
  path: string;
  messages: string[];
}

function flatten(errors: ValidationError[], prefix = ''): FieldError[] {
  return errors.flatMap((error) => {
    const path = prefix + error.property;
    const own = error.constraints ? [{ path, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], `${path}.`)];
  });
}

/** `ValidationPipe` exception factory: one `BAD_USER_INPUT` error listing every invalid field. */
export function validationException(errors: ValidationError[]): GraphQLError {
  return new GraphQLError('Invalid input', {
    extensions: { code: ErrorCode.BAD_USER_INPUT, fields: flatten(errors) },
  });
}
