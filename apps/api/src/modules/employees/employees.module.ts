import { Module } from '@nestjs/common';
import { EMPLOYEE_DIRECTORY, EMPLOYEE_REPOSITORY } from '../../core/di/tokens.js';
import { EmployeesService } from './application/employees.service.js';
import { EmployeesResolver } from './graphql/employees.resolver.js';
import { PrismaEmployeeRepository } from './infrastructure/prisma-employee.repository.js';

@Module({
  providers: [
    EmployeesResolver,
    EmployeesService,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    // Same singleton as EmployeesService, seen by other modules only through the narrow directory port.
    { provide: EMPLOYEE_DIRECTORY, useExisting: EmployeesService },
  ],
  exports: [EMPLOYEE_DIRECTORY],
})
export class EmployeesModule {}
