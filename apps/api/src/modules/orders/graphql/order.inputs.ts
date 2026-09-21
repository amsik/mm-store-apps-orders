import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderState } from '../domain/order-state.js';

// GraphQL types check the shape; these decorators check the values (run by the global ValidationPipe).
export const MAX_LINE_ITEMS = 100;
export const MAX_QUANTITY = 1_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

@InputType()
export class CustomerInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Field()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

@InputType()
export class LineItemInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @Field()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;

  @Field(() => Int, { description: 'Price of one unit in cents.' })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}

@InputType()
export class CreateOrderInput {
  @Field(() => CustomerInput)
  @ValidateNested()
  @Type(() => CustomerInput)
  customer!: CustomerInput;

  @Field(() => [LineItemInput])
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => LineItemInput)
  lineItems!: LineItemInput[];
}

@ArgsType()
export class OrderArgs {
  @Field(() => ID)
  @IsMongoId()
  id!: string;
}

@InputType()
export class OrderFilter {
  @Field(() => OrderState, { nullable: true, description: 'Only orders in this state.' })
  @IsOptional()
  state?: OrderState;
}

@ArgsType()
export class OrdersArgs {
  @Field(() => OrderFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderFilter)
  filter?: OrderFilter;

  @Field(() => Int, {
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `Page size, 1 to ${String(MAX_PAGE_SIZE)}.`,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  first: number = DEFAULT_PAGE_SIZE;

  @Field(() => ID, { nullable: true, description: '`pageInfo.endCursor` of the previous page.' })
  @IsOptional()
  @IsMongoId()
  after?: string;
}

@InputType()
export class TransitionOrderInput {
  @Field(() => ID)
  @IsMongoId()
  orderId!: string;

  @Field(() => OrderState, { description: 'Must be the next state: OPEN → IN_PROGRESS → COMPLETE.' })
  @IsEnum(OrderState)
  targetState!: OrderState;

  @Field(() => ID, {
    nullable: true,
    description: 'Required to move to IN_PROGRESS; ignored otherwise (the employee assigned on start stays).',
  })
  @IsOptional()
  @IsMongoId()
  employeeId?: string;
}
