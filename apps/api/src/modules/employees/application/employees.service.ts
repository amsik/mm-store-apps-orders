import { Inject, Injectable } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../../../core/di/tokens.js';
import type { Employee } from '../domain/employee.js';
import type { EmployeeDirectory } from './employee-directory.js';
import type { EmployeeRepository } from './employee.repository.js';

@Injectable()
export class EmployeesService implements EmployeeDirectory {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  list(): Promise<Employee[]> {
    return this.employees.findAll();
  }

  getById(id: string): Promise<Employee | null> {
    return this.employees.findById(id);
  }
}
