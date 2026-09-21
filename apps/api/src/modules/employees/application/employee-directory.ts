import type { Employee } from '../domain/employee.js';

/**
 * What other modules may ask of employees. `EmployeesModule` exports only this, bound to
 * `EMPLOYEE_DIRECTORY`, so consumers never reach its repository.
 */
export interface EmployeeDirectory {
  /** `null` when the employee does not exist; the caller decides whether that is an error. */
  getById(id: string): Promise<Employee | null>;
}
