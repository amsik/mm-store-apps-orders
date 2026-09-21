import { UseFilters } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrdersService } from '../application/orders.service.js';
import type { Order as OrderModel } from '../domain/order.js';
import { CreateOrderInput, OrderArgs, OrdersArgs, TransitionOrderInput } from './order.inputs.js';
import { Order, OrderConnection, type PageInfo } from './order.types.js';
import { OrdersErrorFilter } from './orders-error.filter.js';

@Resolver(() => Order)
@UseFilters(OrdersErrorFilter)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => Order, { description: 'One order by id. Fails with NOT_FOUND if it does not exist.' })
  order(@Args() { id }: OrderArgs): Promise<OrderModel> {
    return this.ordersService.getById(id);
  }

  @Query(() => OrderConnection, {
    description: 'Orders newest first, optionally filtered by state, with cursor pagination.',
  })
  async orders(
    @Args() { filter, first, after }: OrdersArgs,
  ): Promise<{ nodes: OrderModel[]; pageInfo: PageInfo }> {
    const { nodes, endCursor, hasNextPage } = await this.ordersService.list({
      state: filter?.state,
      first,
      after,
    });
    return { nodes, pageInfo: { endCursor, hasNextPage } };
  }

  @Mutation(() => Order, { description: 'Creates an order in state OPEN, with no employee assigned.' })
  createOrder(@Args('input') input: CreateOrderInput): Promise<OrderModel> {
    return this.ordersService.create(input);
  }

  @Mutation(() => Order, {
    description:
      'Moves an order to the next state. Skips, reverts and repeats fail with INVALID_TRANSITION, starting without ' +
      'an employee with EMPLOYEE_REQUIRED, and losing a race with another request with CONCURRENT_MODIFICATION.',
  })
  transitionOrder(@Args('input') input: TransitionOrderInput): Promise<OrderModel> {
    return this.ordersService.transition(input);
  }
}
