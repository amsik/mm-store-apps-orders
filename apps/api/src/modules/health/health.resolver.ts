import { Field, ObjectType, Query, registerEnumType, ResolveField, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export enum ComponentStatus {
  UP = 'UP',
  DOWN = 'DOWN',
}

registerEnumType(ComponentStatus, { name: 'ComponentStatus' });

@ObjectType()
export class Health {
  @Field({ description: 'Liveness of the API process: `OK` whenever it can answer.' })
  status!: string;

  @Field(() => ComponentStatus, {
    description: 'Whether MongoDB answers a ping. Only checked when requested.',
  })
  db!: ComponentStatus;
}

@Resolver(() => Health)
export class HealthResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => Health, { description: 'Liveness of the API and reachability of its dependencies.' })
  health(): Pick<Health, 'status'> {
    return { status: 'OK' };
  }

  @ResolveField(() => ComponentStatus)
  async db(): Promise<ComponentStatus> {
    return (await this.prisma.isReachable()) ? ComponentStatus.UP : ComponentStatus.DOWN;
  }
}
