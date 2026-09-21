import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { EmployeeRepository } from '../application/employee.repository.js';
import type { Employee } from '../domain/employee.js';

const EMPLOYEE_SELECT = { id: true, name: true } as const;

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Employee[]> {
    return this.prisma.employee.findMany({ orderBy: { name: 'asc' }, select: EMPLOYEE_SELECT });
  }

  findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { id }, select: EMPLOYEE_SELECT });
  }
}
