import { EmployeeRequiredError, InvalidTransitionError } from './errors.js';
import { ORDER_TRANSITIONS, OrderState } from './order-state.js';

/** The state an order in `state` may move to next, or `null` if it is final. */
export function nextState(state: OrderState): OrderState | null {
  return ORDER_TRANSITIONS[state];
}

/**
 * Throws unless moving `order` to `target` is allowed. Checks the sequence first, then the employee rule,
 * so an illegal move is reported as such even when the employee is missing too. Whether the employee
 * exists is not a domain concern; the application layer resolves it after this check.
 */
export function assertTransition(
  order: { readonly state: OrderState },
  target: OrderState,
  employeeId?: string | null,
): void {
  if (nextState(order.state) !== target) {
    throw new InvalidTransitionError(order.state, target);
  }
  if (target === OrderState.IN_PROGRESS && !employeeId) {
    throw new EmployeeRequiredError();
  }
}
