import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

@ObjectType()
export class Health {
  @Field()
  status!: string;
}

@Resolver(() => Health)
export class HealthResolver {
  @Query(() => Health, { description: 'Liveness of the API.' })
  health(): Health {
    return { status: 'OK' };
  }
}
