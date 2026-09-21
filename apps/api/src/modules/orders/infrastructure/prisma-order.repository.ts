import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type {
  ListOrdersQuery,
  NewOrder,
  OrderRepository,
  OrderTransition,
} from '../application/order.repository.js';
import type { Order } from '../domain/order.js';

// Only the fields of the domain `Order`, so storage-only fields never leak past the repository.
const ORDER_SELECT = {
  id: true,
  state: true,
  customer: true,
  lineItems: true,
  assignedEmployee: true,
  history: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(order: NewOrder): Promise<Order> {
    return this.prisma.order.create({
      data: { state: order.state, customer: order.customer, lineItems: [...order.lineItems] },
      select: ORDER_SELECT,
    });
  }

  findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id }, select: ORDER_SELECT });
  }

  // Served by the `{ state: 1, _id: -1 }` index when filtered, and by the `_id` index otherwise.
  list({ state, before, limit }: ListOrdersQuery): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { state, id: before ? { lt: before } : undefined },
      orderBy: { id: 'desc' },
      take: limit,
      select: ORDER_SELECT,
    });
  }

  /**
   * One conditional `updateMany` is the compare-and-set: MongoDB applies a single-document update atomically, so
   * of two requests that checked the same version only the first to write matches. The re-read afterwards is only
   * for the response; the write itself never depends on it.
   */
  async transition(
    id: string,
    { expectedVersion, change, assignedEmployee }: OrderTransition,
  ): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, state: change.from, version: expectedVersion },
      data: {
        state: change.to,
        assignedEmployee,
        history: { push: change },
        version: { increment: 1 },
        updatedAt: change.at,
      },
    });
    return count === 0 ? null : this.findById(id);
  }
}
