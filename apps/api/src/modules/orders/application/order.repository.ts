import type { EmployeeSnapshot, Order, StateChange } from '../domain/order.js';
import type { OrderState } from '../domain/order-state.js';

/** What a new order needs; the store assigns `id`, `version`, the timestamps and an empty history. */
export type NewOrder = Pick<Order, 'state' | 'customer' | 'lineItems'>;

export interface ListOrdersQuery {
  state?: OrderState;
  /** Only orders strictly older than this id (the cursor of the previous page). */
  before?: string;
  limit: number;
}

/** A checked transition, written only if the order is still at `expectedVersion`. */
export interface OrderTransition {
  expectedVersion: number;
  change: StateChange;
  assignedEmployee: EmployeeSnapshot | null;
}

/** Persistence port for orders. Bound to `ORDER_REPOSITORY`; the application never sees the concrete store. */
export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  /** `null` when no order has this id. */
  findById(id: string): Promise<Order | null>;
  /** Newest first, i.e. by id descending: ids grow with insertion time, so pages stay stable under inserts. */
  list(query: ListOrdersQuery): Promise<Order[]>;
  /**
   * Atomic compare-and-set: moves the order to `change.to`, sets the employee, appends `change` to the history,
   * sets `updatedAt` to `change.at` and increments `version`, but only if the order is still in `change.from`
   * at `expectedVersion`. Returns the updated order, or `null` when nothing matched.
   */
  transition(id: string, transition: OrderTransition): Promise<Order | null>;
}
