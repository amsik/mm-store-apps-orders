import { Inject, Injectable } from '@nestjs/common';
import type { Clock } from '../../../core/clock/clock.js';
import { CLOCK, EMPLOYEE_DIRECTORY, ORDER_REPOSITORY } from '../../../core/di/tokens.js';
import type { EmployeeDirectory } from '../../employees/application/employee-directory.js';
import type { EmployeeSnapshot, Order } from '../domain/order.js';
import { OrderState } from '../domain/order-state.js';
import { assertTransition } from '../domain/state-machine.js';
import { ConcurrentModificationError, EmployeeNotFoundError, OrderNotFoundError } from './errors.js';
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

export interface TransitionOrderCommand {
  orderId: string;
  targetState: OrderState;
  /** Required to start an order; ignored otherwise (the employee assigned on start stays). */
  employeeId?: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(EMPLOYEE_DIRECTORY) private readonly employees: EmployeeDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

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

  /**
   * Check, then compare-and-set: the domain decides whether the move is legal for the order as read, and the
   * repository writes it only if the order is still at that version. A concurrent request that got there first
   * makes the write match nothing, which is reported instead of silently overwriting its result.
   */
  async transition({ orderId, targetState, employeeId }: TransitionOrderCommand): Promise<Order> {
    const order = await this.getById(orderId);
    assertTransition(order, targetState, employeeId);

    const assignedEmployee =
      targetState === OrderState.IN_PROGRESS && employeeId
        ? await this.findEmployee(employeeId)
        : order.assignedEmployee;

    const updated = await this.orders.transition(orderId, {
      expectedVersion: order.version,
      assignedEmployee,
      change: {
        from: order.state,
        to: targetState,
        at: this.clock.now(),
        employeeId: assignedEmployee?.id ?? null,
      },
    });
    // Orders are never deleted, so a miss can only mean another write happened in between.
    if (!updated) throw new ConcurrentModificationError(orderId);
    return updated;
  }

  private async findEmployee(id: string): Promise<EmployeeSnapshot> {
    const employee = await this.employees.getById(id);
    if (!employee) throw new EmployeeNotFoundError(id);
    return { id: employee.id, name: employee.name };
  }
}
