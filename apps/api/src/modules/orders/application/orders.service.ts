import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY } from '../../../core/di/tokens.js';
import type { Order } from '../domain/order.js';
import { OrderState } from '../domain/order-state.js';
import { OrderNotFoundError } from './errors.js';
import type { NewOrder, OrderRepository } from './order.repository.js';

export type CreateOrderCommand = Pick<NewOrder, 'customer' | 'lineItems'>;

export interface ListOrdersCommand {
  state?: OrderState;
  first: number;
  /** `endCursor` of the previous page. */
  after?: string;
}

export interface OrderPage {
  nodes: Order[];
  /** Pass as `after` to get the next page; `null` when the page is empty. */
  endCursor: string | null;
  hasNextPage: boolean;
}

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

  /** Cursor pagination: the cursor is the id of the last order on the page. */
  async list({ state, first, after }: ListOrdersCommand): Promise<OrderPage> {
    // One extra row tells whether another page exists without a separate count query.
    const rows = await this.orders.list({ state, before: after, limit: first + 1 });
    const nodes = rows.slice(0, first);
    return { nodes, endCursor: nodes.at(-1)?.id ?? null, hasNextPage: rows.length > first };
  }
}
