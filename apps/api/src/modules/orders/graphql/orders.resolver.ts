import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrdersService } from '../application/orders.service.js';
import type { Order as OrderModel } from '../domain/order.js';
import { CreateOrderInput, OrderArgs } from './order.inputs.js';
import { Order } from './order.types.js';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(private readonly orders: OrdersService) {}

  @Query(() => Order, { description: 'One order by id. Fails with NOT_FOUND if it does not exist.' })
  order(@Args() { id }: OrderArgs): Promise<OrderModel> {
    return this.orders.getById(id);
  }

  @Mutation(() => Order, { description: 'Creates an order in state OPEN, with no employee assigned.' })
  createOrder(@Args('input') input: CreateOrderInput): Promise<OrderModel> {
    return this.orders.create(input);
  }
}
