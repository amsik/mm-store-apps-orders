import type { Order } from '../domain/order.js';
import type { OrderState } from '../domain/order-state.js';

/** What a new order needs; the store assigns `id` and the timestamps. */
export type NewOrder = Pick<Order, 'state' | 'customer' | 'lineItems'>;

/** Persistence port for orders. Bound to `ORDER_REPOSITORY`; the application never sees the concrete store. */
export interface ListOrdersQuery {
  state?: OrderState;
  /** Only orders strictly older than this id (the cursor of the previous page). */
  before?: string;
  limit: number;
}

export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  /** `null` when no order has this id. */
  findById(id: string): Promise<Order | null>;
  /** Newest first, i.e. by id descending: ids grow with insertion time, so pages stay stable under inserts. */
  list(query: ListOrdersQuery): Promise<Order[]>;
}
