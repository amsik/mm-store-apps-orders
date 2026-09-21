import { NotFoundError } from '../../../core/errors/app-errors.js';

/** No order exists with the requested id. */
export class OrderNotFoundError extends NotFoundError {
  override readonly name = 'OrderNotFoundError';

  constructor(readonly id: string) {
    super(`Order ${id} not found`);
  }
}

/** The employee to assign when starting an order does not exist. */
export class EmployeeNotFoundError extends NotFoundError {
  override readonly name = 'EmployeeNotFoundError';

  constructor(readonly id: string) {
    super(`Employee ${id} not found`);
  }
}

/** The order changed between being checked and being written; the caller should re-read it and decide again. */
export class ConcurrentModificationError extends Error {
  override readonly name = 'ConcurrentModificationError';

  constructor(readonly id: string) {
    super(`Order ${id} was modified by another request; reload it and try again`);
  }
}
