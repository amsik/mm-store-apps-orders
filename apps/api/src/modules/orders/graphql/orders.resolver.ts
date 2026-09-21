import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrdersService } from '../application/orders.service.js';
import type { Order as OrderModel } from '../domain/order.js';
import { CreateOrderInput, OrderArgs, OrdersArgs } from './order.inputs.js';
import { Order, OrderConnection, type PageInfo } from './order.types.js';

@Resolver(() => Order)
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
}
