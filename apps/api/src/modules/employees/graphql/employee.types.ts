import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A store employee who can be assigned to orders.' })
export class Employee {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}
