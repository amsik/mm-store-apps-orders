import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY } from '../../../core/di/tokens.js';
import type { Order } from '../domain/order.js';
import { OrderState } from '../domain/order-state.js';
import { OrderNotFoundError } from './errors.js';
import type { NewOrder, OrderRepository } from './order.repository.js';

export type CreateOrderCommand = Pick<NewOrder, 'customer' | 'lineItems'>;

@Injectable()
export class OrdersService {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  /** Every order starts OPEN and unassigned; an employee is only attached on the move to IN_PROGRESS. */
  create(command: CreateOrderCommand): Promise<Order> {
    return this.orders.create({ ...command, state: OrderState.OPEN });
  }

  async getById(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }
}
