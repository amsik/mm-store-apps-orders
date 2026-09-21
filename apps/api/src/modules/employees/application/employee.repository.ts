import type { Employee } from '../domain/employee.js';

/** Persistence port for employees. Bound to `EMPLOYEE_REPOSITORY` and private to `EmployeesModule`. */
export interface EmployeeRepository {
  /** Sorted by name, for pickers. */
  findAll(): Promise<Employee[]>;
  /** `null` when no employee has this id. */
  findById(id: string): Promise<Employee | null>;
}
