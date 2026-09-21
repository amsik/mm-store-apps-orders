import { randomBytes } from 'node:crypto';
import { type Clock, systemClock } from '../../../core/clock/clock.js';
import type { NewOrder, OrderRepository } from '../application/order.repository.js';
import type { Order } from '../domain/order.js';

/** Fake `OrderRepository` for application-layer unit tests: same contract as the Prisma one, kept in a Map. */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  constructor(private readonly clock: Clock = systemClock) {}

  create(order: NewOrder): Promise<Order> {
    const now = this.clock.now();
    // 24 hex chars, the same shape as a MongoDB ObjectId.
    const created: Order = { ...order, id: randomBytes(12).toString('hex'), createdAt: now, updatedAt: now };
    this.orders.set(created.id, created);
    return Promise.resolve(created);
  }

  findById(id: string): Promise<Order | null> {
    return Promise.resolve(this.orders.get(id) ?? null);
  }
}
