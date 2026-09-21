import { ORDER_TRANSITIONS, type OrderState } from './order-state.js';

/** The requested state is not the next one in the sequence (a skip, a revert or a repeat). */
export class InvalidTransitionError extends Error {
  override readonly name = 'InvalidTransitionError';

  constructor(
    readonly from: OrderState,
    readonly to: OrderState,
  ) {
    const next = ORDER_TRANSITIONS[from];
    super(
      `Cannot move an order from ${from} to ${to}; ${next ? `the next state must be ${next}` : `${from} is final`}`,
    );
  }
}

/** An order can only be IN_PROGRESS with an employee assigned to it. */
export class EmployeeRequiredError extends Error {
  override readonly name = 'EmployeeRequiredError';

  constructor() {
    super('An employee must be assigned to move an order to IN_PROGRESS');
  }
}
