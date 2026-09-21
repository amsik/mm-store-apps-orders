import { Module } from '@nestjs/common';
import { ORDER_REPOSITORY } from '../../core/di/tokens.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { OrdersService } from './application/orders.service.js';
import { OrdersResolver } from './graphql/orders.resolver.js';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository.js';

@Module({
  // Gives access to EMPLOYEE_DIRECTORY only; the employees repository stays private to its module.
  imports: [EmployeesModule],
  providers: [
    OrdersResolver,
    OrdersService,
    // The one place the repository port is bound to its Prisma adapter.
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
  ],
})
export class OrdersModule {}
