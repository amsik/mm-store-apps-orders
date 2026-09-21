import type { Order } from '../domain/order.js';

/** What a new order needs; the store assigns `id` and the timestamps. */
export type NewOrder = Pick<Order, 'state' | 'customer' | 'lineItems'>;

/** Persistence port for orders. Bound to `ORDER_REPOSITORY`; the application never sees the concrete store. */
export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  /** `null` when no order has this id. */
  findById(id: string): Promise<Order | null>;
}
