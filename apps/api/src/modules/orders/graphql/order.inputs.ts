import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// GraphQL types check the shape; these decorators check the values (run by the global ValidationPipe).
export const MAX_LINE_ITEMS = 100;
export const MAX_QUANTITY = 1_000;

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
