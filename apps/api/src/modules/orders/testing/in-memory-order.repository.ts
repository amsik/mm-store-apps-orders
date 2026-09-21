import { type Clock, systemClock } from '../../../core/clock/clock.js';
import type {
  ListOrdersQuery,
  NewOrder,
  OrderRepository,
  OrderTransition,
} from '../application/order.repository.js';
import type { Order } from '../domain/order.js';

/** Fake `OrderRepository` for application-layer unit tests: same contract as the Prisma one, kept in a Map. */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private sequence = 0;

  constructor(private readonly clock: Clock = systemClock) {}

  create(order: NewOrder): Promise<Order> {
    const now = this.clock.now();
    // 24 hex chars that grow with every insert, like a MongoDB ObjectId, so string order is insertion order.
    const id = (++this.sequence).toString(16).padStart(24, '0');
    const created: Order = {
      ...order,
      id,
      assignedEmployee: null,
      history: [],
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(created.id, created);
    return Promise.resolve(created);
  }

  findById(id: string): Promise<Order | null> {
    return Promise.resolve(this.orders.get(id) ?? null);
  }

  list({ state, before, limit }: ListOrdersQuery): Promise<Order[]> {
    const matching = [...this.orders.values()]
      .filter(
        (order) =>
          (state === undefined || order.state === state) && (before === undefined || order.id < before),
      )
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    return Promise.resolve(matching.slice(0, limit));
  }

  // Synchronous between the check and the write, so it is atomic in a single-threaded event loop.
  transition(
    id: string,
    { expectedVersion, change, assignedEmployee }: OrderTransition,
  ): Promise<Order | null> {
    const order = this.orders.get(id);
    if (order?.state !== change.from || order.version !== expectedVersion) return Promise.resolve(null);
    const updated: Order = {
      ...order,
      state: change.to,
      assignedEmployee,
      history: [...order.history, change],
      version: order.version + 1,
      updatedAt: change.at,
    };
    this.orders.set(id, updated);
    return Promise.resolve(updated);
  }
}
