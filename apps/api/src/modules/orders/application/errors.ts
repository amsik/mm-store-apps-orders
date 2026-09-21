import { NotFoundError } from '../../../core/errors/app-errors.js';

/** No order exists with the requested id. */
export class OrderNotFoundError extends NotFoundError {
  override readonly name = 'OrderNotFoundError';

  constructor(readonly id: string) {
    super(`Order ${id} not found`);
  }
}
