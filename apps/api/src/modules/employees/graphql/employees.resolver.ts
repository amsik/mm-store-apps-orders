import { Query, Resolver } from '@nestjs/graphql';
import { EmployeesService } from '../application/employees.service.js';
import type { Employee as EmployeeModel } from '../domain/employee.js';
import { Employee } from './employee.types.js';

@Resolver(() => Employee)
export class EmployeesResolver {
  constructor(private readonly employeesService: EmployeesService) {}

  @Query(() => [Employee], { description: 'All employees sorted by name, e.g. to pick who starts an order.' })
  employees(): Promise<EmployeeModel[]> {
    return this.employeesService.list();
  }
}
