import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { NewOrder, OrderRepository } from '../application/order.repository.js';
import type { Order } from '../domain/order.js';

// Only the fields of the domain `Order`, so storage-only fields never leak past the repository.
const ORDER_SELECT = {
  id: true,
  state: true,
  customer: true,
  lineItems: true,
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
}
