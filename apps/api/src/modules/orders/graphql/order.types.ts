import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Employee } from '../../employees/graphql/employee.types.js';
import { OrderState } from '../domain/order-state.js';

registerEnumType(OrderState, {
  name: 'OrderState',
  description: 'OPEN → IN_PROGRESS → COMPLETE, no skipping or reverting.',
});

@ObjectType()
export class Customer {
  @Field()
  name!: string;

  @Field()
  email!: string;
}

@ObjectType()
export class LineItem {
  @Field()
  sku!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int, { description: 'Price of one unit in cents.' })
  unitPriceCents!: number;
}

@ObjectType({ description: 'One step of an order through its lifecycle.' })
export class OrderStateChange {
  @Field(() => OrderState)
  from!: OrderState;

  @Field(() => OrderState)
  to!: OrderState;

  @Field()
  at!: Date;

  @Field(() => ID, { nullable: true, description: 'The employee working on the order at that moment.' })
  employeeId!: string | null;
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string;

  @Field(() => OrderState)
  state!: OrderState;

  @Field(() => Customer)
  customer!: Customer;

  @Field(() => [LineItem])
  lineItems!: LineItem[];

  @Field(() => Employee, {
    nullable: true,
    description: 'Assigned when the order is started and kept once it is complete; null while OPEN.',
  })
  assignedEmployee!: Employee | null;

  @Field(() => [OrderStateChange], { description: 'Every transition so far, oldest first.' })
  history!: OrderStateChange[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class PageInfo {
  @Field(() => ID, {
    nullable: true,
    description: 'Pass as `after` to fetch the next page; null when the page is empty.',
  })
  endCursor!: string | null;

  @Field()
  hasNextPage!: boolean;
}

@ObjectType({ description: 'A page of orders, newest first.' })
export class OrderConnection {
  @Field(() => [Order])
  nodes!: Order[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}
