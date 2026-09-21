import type { Server } from 'node:http';
import { Inject, Injectable, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { SEED_EMPLOYEES, seed } from '../prisma/seed.js';
import { AppConfigModule } from '../src/core/config/config.module.js';
import { EMPLOYEE_DIRECTORY, EMPLOYEE_REPOSITORY } from '../src/core/di/tokens.js';
import { PrismaModule } from '../src/core/prisma/prisma.module.js';
import type { EmployeeDirectory } from '../src/modules/employees/application/employee-directory.js';
import { EmployeesService } from '../src/modules/employees/application/employees.service.js';
import { EmployeesModule } from '../src/modules/employees/employees.module.js';
import { createTestApp } from './setup/create-test-app.js';
import { testDatabaseUrl } from './setup/database.js';

const LIST_EMPLOYEES = '{ employees { id name } }';

describe('employees (integration)', () => {
  let app: INestApplication<Server>;
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('employees', () => {
    it('returns the seeded employees sorted by name', async () => {
      await seed(prisma);

      const res = await request(app.getHttpServer()).post('/graphql').send({ query: LIST_EMPLOYEES });

      const expected = [...SEED_EMPLOYEES].sort((a, b) => a.name.localeCompare(b.name));
      expect(res.body).toEqual({ data: { employees: expected } });
    });

    it('returns an empty list when there are no employees', async () => {
      const res = await request(app.getHttpServer()).post('/graphql').send({ query: LIST_EMPLOYEES });

      expect(res.body).toEqual({ data: { employees: [] } });
    });
  });

  describe('EMPLOYEE_DIRECTORY', () => {
    it('finds an employee by id', async () => {
      await seed(prisma);
      const directory = app.get<EmployeeDirectory>(EMPLOYEE_DIRECTORY);
      const [employee] = SEED_EMPLOYEES;
      assert(employee);

      expect(await directory.getById(employee.id)).toEqual(employee);
    });

    it('returns null for an unknown id, leaving the error to the caller', async () => {
      const directory = app.get<EmployeeDirectory>(EMPLOYEE_DIRECTORY);

      expect(await directory.getById('665f1c2b8a1e4d0012345678')).toBeNull();
    });
  });

  describe('module boundary', () => {
    // A consumer of EmployeesModule, like OrdersModule, sees only what the module exports.
    async function compileConsumerOf(token: symbol | typeof EmployeesService): Promise<unknown> {
      @Injectable()
      class Consumer {
        constructor(@Inject(token) readonly dependency: unknown) {}
      }
      const moduleRef = await Test.createTestingModule({
        imports: [AppConfigModule, PrismaModule, EmployeesModule],
        providers: [Consumer],
      }).compile();
      const { dependency } = moduleRef.get(Consumer);
      await moduleRef.close();
      return dependency;
    }

    it('exports the employee directory', async () => {
      expect(await compileConsumerOf(EMPLOYEE_DIRECTORY)).toBeInstanceOf(EmployeesService);
    });

    it.each([
      ['the repository', EMPLOYEE_REPOSITORY],
      ['the service class', EmployeesService],
    ])('does not export %s', async (_case, token) => {
      await expect(compileConsumerOf(token)).rejects.toThrow(/can't resolve dependencies/);
    });
  });
});
